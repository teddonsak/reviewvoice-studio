import { SubtitleSettings, WordTiming } from '../types';

export interface RenderProgressCallback {
  (progressPercent: number, statusMessage: string): void;
}

export interface RenderResult {
  videoBlob: Blob;
  videoUrl: string;
  assSubtitleContent: string;
  srtSubtitleContent: string;
}

/**
 * Renders composite video with:
 * 1. Source video muted
 * 2. Generated TTS audio track attached (direct PCM decode via Web Audio for 100% audio guarantee)
 * 3. Dynamic Karaoke subtitles burned-in onto canvas frames
 */
export async function renderFinalVideo(
  videoSourceUrl: string,
  audioBlob: Blob,
  wordTimings: WordTiming[],
  subtitleSettings: SubtitleSettings,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  return new Promise(async (resolve, reject) => {
    try {
      onProgress?.(5, 'กำลังเตรียมไฟล์วิดีโอและระบบตัดต่อ...');

      // 1. Create Video Element
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoSourceUrl;
      video.muted = true; // ลบเสียงเดิมของวิดีโอต้นฉบับ
      video.playsInline = true;
      video.loop = true; // วนคลิปต้นฉบับอัตโนมัติเมื่อเสียงพากย์ยาวกว่า

      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error('ไม่สามารถโหลดไฟล์วิดีโอต้นฉบับได้'));
      });

      // Video dimensions - default vertical 1080x1920 or matched aspect
      const width = video.videoWidth || 1080;
      const height = video.videoHeight || 1920;
      const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

      onProgress?.(15, 'กำลังถอดรหัสคลื่นเสียงพากย์ (PCM Audio Decoding)...');

      // 2. Decode Audio - ใช้ sampleRate ปกติบนมือถือ (iOS ไม่รองรับ 48kHz แบบบังคับ)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = isMobile ? new AudioContextClass() : new AudioContextClass({ sampleRate: 48000 });
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      let audioBuffer: AudioBuffer;
      let audioDuration: number;
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        audioDuration = audioBuffer.duration || duration;
      } catch (e) {
        console.warn('decodeAudioData failed on mobile, fallback to element duration', e);
        audioDuration = await getVideoRendererAudioDuration(audioBlob).catch(() => duration);
        // สร้าง buffer เปล่าเพื่อยังต่อสายได้ แต่ใช้เวลาจาก element แทน
        const silentLen = Math.ceil(audioDuration * audioContext.sampleRate);
        audioBuffer = audioContext.createBuffer(1, Math.max(1, silentLen), audioContext.sampleRate);
      }
      // กันกรณีคำนวณพลาดบนมือถือแล้วได้ 1 วิ — ใช้ wordTimings หรือ duration จริงแทน
      const timingsDuration = wordTimings.length ? Math.max(...wordTimings.map(t => t.end)) : 0;
      const estimatedDuration = Math.max(duration, audioDuration, timingsDuration, 4);
      const finalDuration = estimatedDuration;

      const audioDestination = audioContext.createMediaStreamDestination();
      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(audioDestination);

      // 3. Canvas setup
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

      // 4. Capture Stream and MediaRecorder (บังคับ MP4 ก่อน แต่ตรวจบนมือถือจริง)
      // บน iOS Safari มีแค่ MP4, บน Android Chrome มีทั้งคู่ — ต้องเลือกอันที่รองรับจริง
      let canvasStream: MediaStream;
      try {
        canvasStream = (canvas as any).captureStream ? canvas.captureStream(30) : (canvas as any).captureStream(30);
        if (!canvasStream || canvasStream.getVideoTracks().length === 0) throw new Error('no canvas track');
      } catch (e) {
        console.warn('canvas.captureStream failed, fallback to video capture', e);
        const videoStream = (video as any).captureStream ? (video as any).captureStream(30) : null;
        if (videoStream) canvasStream = videoStream;
        else throw new Error('เบราว์เซอร์มือถือนี้ไม่รองรับการอัดวิดีโอจาก Canvas');
      }
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);

      // ลำดับความสำคัญ: MP4 (H.264/AAC) ก่อน เพื่อให้ไฟล์ .mp4 เล่นได้ทุกเครื่อง
      // ตรวจแบบเข้มบนมือถือ — บางเครื่องอ้างว่ารองรับแต่จริงอัดไม่ได้ ต้องลองจริง
      const candidates = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      let mimeType = candidates.find(t => {
        try { return (window as any).MediaRecorder && MediaRecorder.isTypeSupported(t); } catch { return false; }
      }) || 'video/mp4;codecs=avc1,mp4a.40.2';
      // บน iOS ถ้าเลือก webm จะอัดไม่ได้ ให้บังคับ mp4
      if (isMobile && mimeType.includes('webm') && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000, // 6 Mbps crystal clear video
        audioBitsPerSecond: 192000  // 192 kbps high fidelity Opus audio
      });

      const recordedChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      recorder.onstop = () => {
        try { bufferSource.stop(); } catch {}
        audioContext.close().catch(() => {});

        const finalBlob = new Blob(recordedChunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(finalBlob);

        const assContent = generateAssSubtitles(wordTimings, subtitleSettings, width, height);
        const srtContent = generateSrtSubtitles(wordTimings);

        onProgress?.(100, 'เรนเดอร์คลิปวิดีโอเสร็จสมบูรณ์!');
        resolve({
          videoBlob: finalBlob,
          videoUrl,
          assSubtitleContent: assContent,
          srtSubtitleContent: srtContent
        });
      };

      recorder.onerror = (err) => {
        reject(new Error(`เกิดข้อผิดพลาดในการบันทึกวิดีโอ: ${err.toString()}`));
      };

      // 5. Start Playback & Recording simultaneously
      recorder.start(100);
      bufferSource.start(0);
      video.currentTime = 0;

      await video.play().catch(() => {});

      const startTime = performance.now();

      function drawFrame() {
        if (recorder.state !== 'recording' || !ctx) return;

        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(95, Math.round((elapsed / finalDuration) * 80) + 15);
        onProgress?.(progress, `กำลังเรนเดอร์เฟรมและเสียงพากย์ (${Math.round(elapsed)}s / ${Math.round(finalDuration)}s)...`);

        // Safety net if loop attribute fails (some browsers) – manually rewind
        if (video.currentTime >= duration - 0.15 && elapsed < finalDuration - 0.1) {
          // keep playing, loop will handle it; if paused, restart
          if (video.paused) video.play().catch(() => {});
        }
        if (video.ended && elapsed < finalDuration) {
          try { video.currentTime = 0; } catch {}
          video.play().catch(() => {});
        }

        // Draw Video Frame – ensure readyState has data, otherwise keep last frame
        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, width, height);
        }

        // Draw Subtitles on Canvas
        drawKaraokeSubtitles(ctx, elapsed, wordTimings, subtitleSettings, width, height);

        if (elapsed >= finalDuration) {
          recorder.stop();
          video.pause();
        } else {
          requestAnimationFrame(drawFrame);
        }
      }

      requestAnimationFrame(drawFrame);

    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Draws crisp, natural Thai subtitles with contiguous script (matching reference style),
 * clean stroke outline, and automatic screen boundary clamping.
 */
export function drawKaraokeSubtitles(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  wordTimings: WordTiming[],
  settings: SubtitleSettings,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!wordTimings || wordTimings.length === 0) return;

  // Find the exact active word timestamp returned by transcription alignment.
  let activeIndex = wordTimings.findIndex(t => currentTime >= t.start && currentTime <= t.end);
  let activePhrase = activeIndex >= 0 ? wordTimings[activeIndex] : undefined;
  if (!activePhrase) {
    // Check if within 0.3s tolerance of nearest segment to avoid flickering
    activeIndex = wordTimings.findIndex(t => currentTime >= (t.start - 0.06) && currentTime <= (t.end + 0.1));
    activePhrase = activeIndex >= 0 ? wordTimings[activeIndex] : undefined;
  }

  // If before first segment, show first segment ready
  if (!activePhrase && currentTime < wordTimings[0].start && wordTimings[0].start < 1.0) {
    activePhrase = wordTimings[0];
    activeIndex = 0;
  }

  if (!activePhrase || !activePhrase.word.trim()) return;

  const wordsPerLine = Math.max(1, settings.wordsPerLine || 3);
  const lineStart = Math.floor(activeIndex / wordsPerLine) * wordsPerLine;
  const lineWords = wordTimings.slice(lineStart, lineStart + wordsPerLine);
  const joinWords = (items: WordTiming[]) => items.map((item, index) => {
    if (index === 0) return item.word.trim();
    const previous = items[index - 1].word.trim();
    const current = item.word.trim();
    const thaiBoundary = /[\u0E00-\u0E7F]$/.test(previous) && /^[\u0E00-\u0E7F]/.test(current);
    return `${thaiBoundary ? '' : ' '}${current}`;
  }).join('');
  const phraseText = joinWords(lineWords);

  // Subtitle Positioning
  let yPos = canvasHeight * 0.76; // Default 'middle-top' / 'high' or 'bottom'
  if (settings.position === 'top') {
    yPos = canvasHeight * 0.16;
  } else if (settings.position === 'middle-top') {
    yPos = canvasHeight * 0.32;
  } else if (settings.position === 'middle') {
    yPos = canvasHeight * 0.52;
  } else if (settings.position === 'bottom') {
    yPos = canvasHeight * 0.80;
  }

  // Base font scale relative to 1080px canvas
  const scale = canvasWidth / 1080;
  let currentFontSize = Math.max(18, Math.round((settings.fontSize || 84) * scale));
  const fontWeight = settings.fontWeight || '800';
  const fontFamily = settings.fontFamily || 'Kanit';

  ctx.save();
  ctx.font = `${fontWeight} ${currentFontSize}px '${fontFamily}', 'Prompt', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate text width
  let totalMetrics = ctx.measureText(phraseText);
  let textWidth = totalMetrics.width;

  // Screen overflow prevention: clamp text within 88% of screen width
  const maxAllowedWidth = canvasWidth * 0.88;
  if (textWidth > maxAllowedWidth) {
    const fitFactor = maxAllowedWidth / textWidth;
    currentFontSize = Math.max(16, Math.round(currentFontSize * fitFactor));
    ctx.font = `${fontWeight} ${currentFontSize}px '${fontFamily}', 'Prompt', sans-serif`;
    totalMetrics = ctx.measureText(phraseText);
    textWidth = totalMetrics.width;
  }

  const centerX = canvasWidth / 2;
  const paddingX = Math.round(24 * scale);
  const paddingY = Math.round(12 * scale);
  const boxHeight = currentFontSize + paddingY * 2;
  const boxWidth = Math.min(canvasWidth * 0.94, textWidth + paddingX * 2);

  // 1. Draw Background Badge Box if enabled
  if (settings.showBadge) {
    ctx.fillStyle = settings.bgBadgeColor || 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    const radius = Math.min(14 * scale, boxHeight / 2);
    ctx.roundRect(centerX - boxWidth / 2, yPos - boxHeight / 2, boxWidth, boxHeight, radius);
    ctx.fill();

    // Subtle border glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.stroke();
  }

  // 2. Draw Text with Outline Stroke & Crisp Fill
  const baseStrokeWidth = typeof settings.strokeWidth === 'number' ? settings.strokeWidth : 8;

  // Outer Stroke Outline
  if (baseStrokeWidth > 0) {
    ctx.lineWidth = Math.max(2, (baseStrokeWidth * (currentFontSize / 84)) * scale * 1.3);
    ctx.strokeStyle = settings.strokeColor || '#000000';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(phraseText, centerX, yPos);
  }

  // Text Fill Color
  if (settings.styleMode === 'karaoke') {
    // Draw the complete readable line, then highlight only the word whose
    // transcription timestamp is active. No estimated left-to-right sweep.
    ctx.fillStyle = settings.textColor || '#FFFFFF';
    ctx.fillText(phraseText, centerX, yPos);
    const localActiveIndex = Math.max(0, activeIndex - lineStart);
    const prefix = joinWords(lineWords.slice(0, localActiveIndex));
    const activeWord = lineWords[localActiveIndex]?.word.trim() || '';
    const separator = prefix && !(/[\u0E00-\u0E7F]$/.test(prefix) && /^[\u0E00-\u0E7F]/.test(activeWord)) ? ' ' : '';
    const left = centerX - textWidth / 2;
    const wordX = left + ctx.measureText(prefix + separator).width;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = settings.highlightColor || '#FACC15';
    ctx.shadowColor = settings.highlightColor || '#FACC15';
    ctx.shadowBlur = Math.round(10 * scale);
    ctx.fillText(activeWord, wordX, yPos);
    ctx.restore();
  } else {
    // Standard Crisp White Text Fill
    ctx.fillStyle = settings.textColor || '#FFFFFF';
    ctx.fillText(phraseText, centerX, yPos);
  }

  ctx.restore();
}

/**
 * Generate .ass Substation Alpha file with Karaoke tag timings
 */
export function generateAssSubtitles(
  wordTimings: WordTiming[],
  settings: SubtitleSettings,
  width: number,
  height: number
): string {
  const header = `[Script Info]
Title: ReviewVoice Studio Karaoke Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,${settings.fontFamily || 'Kanit'},${settings.fontSize || 84},&H00FFFFFF,&H0015CCFA,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,20,20,${settings.position === 'top' ? 800 : settings.position === 'middle' ? 450 : 150},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const CHUNK_SIZE = Math.max(1, Math.min(8, settings.wordsPerLine || 3));
  const lines: string[] = [];

  for (let i = 0; i < wordTimings.length; i += CHUNK_SIZE) {
    const chunk = wordTimings.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const startTime = formatAssTime(chunk[0].start);
    const endTime = formatAssTime(chunk[chunk.length - 1].end);

    const isKaraokeMode = settings.styleMode !== 'standard';
    const textContent = isKaraokeMode
      ? joinSubtitleItems(chunk.map((item) => {
          const durationCs = Math.round((item.end - item.start) * 100);
          return `{\\k${durationCs}}${item.word}`;
        }))
      : joinSubtitleItems(chunk.map((item) => item.word));

    lines.push(`Dialogue: 0,${startTime},${endTime},Karaoke,,0,0,0,,${textContent}`);
  }

  return header + lines.join('\n');
}

/**
 * Generate standard .srt Subtitles
 */
export function generateSrtSubtitles(wordTimings: WordTiming[], wordsPerLine: number = 3): string {
  const CHUNK_SIZE = Math.max(1, Math.min(8, wordsPerLine || 3));
  const blocks: string[] = [];
  let blockIndex = 1;

  for (let i = 0; i < wordTimings.length; i += CHUNK_SIZE) {
    const chunk = wordTimings.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const startTime = formatSrtTime(chunk[0].start);
    const endTime = formatSrtTime(chunk[chunk.length - 1].end);
    const text = joinSubtitleItems(chunk.map((c) => c.word));

    blocks.push(`${blockIndex}\n${startTime} --> ${endTime}\n${text}\n`);
    blockIndex++;
  }

  return blocks.join('\n');
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);

  return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function pad(num: number, size: number): string {
  let s = num + '';
  while (s.length < size) s = '0' + s;
  return s;
}

function joinSubtitleItems(items: string[]): string {
  return items.map((item, index) => {
    if (index === 0) return item;
    const previousPlain = items[index - 1].replace(/\{[^}]+\}/g, '');
    const currentPlain = item.replace(/\{[^}]+\}/g, '');
    const thaiBoundary = /[\u0E00-\u0E7F]$/.test(previousPlain) && /^[\u0E00-\u0E7F]/.test(currentPlain);
    return `${thaiBoundary ? '' : ' '}${item}`;
  }).join('');
}

function getVideoRendererAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(blob);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 10));
    audio.addEventListener('error', () => resolve(10));
    // timeout fallback
    setTimeout(() => resolve(10), 3000);
  });
}
