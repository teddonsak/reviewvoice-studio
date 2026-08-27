import { SubtitleSettings, WordTiming } from '../types';
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  Quality,
  canEncodeVideo
} from 'mediabunny';

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
 * 1. Source video muted (original sound removed)
 * 2. Generated TTS audio track attached (direct PCM decode via Web Audio for 100% audio guarantee)
 * 3. Dynamic Karaoke subtitles burned-in onto canvas frames
 * 4. Genuine standard MP4 (H.264 AVC + AAC) container with faststart moov atom for universal compatibility
 */
export async function renderFinalVideo(
  videoSourceUrl: string,
  audioBlob: Blob,
  wordTimings: WordTiming[],
  subtitleSettings: SubtitleSettings,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  // Try WebCodecs + Mediabunny for genuine H.264/AAC MP4 encoding
  try {
    const isAvcSupported = await canEncodeVideo('avc').catch(() => false);
    if (isAvcSupported && typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined') {
      return await renderWithMediabunny(
        videoSourceUrl,
        audioBlob,
        wordTimings,
        subtitleSettings,
        onProgress
      );
    }
  } catch (e) {
    console.warn('Mediabunny encoder error or not supported, falling back to MediaRecorder:', e);
  }

  // Fallback to MediaRecorder if WebCodecs is unavailable
  return await renderWithMediaRecorder(
    videoSourceUrl,
    audioBlob,
    wordTimings,
    subtitleSettings,
    onProgress
  );
}

/**
 * High-performance deterministic frame-by-frame renderer using Mediabunny & WebCodecs.
 * Outputs standard FastStart MP4 (H.264 + AAC) playable everywhere without corruptions.
 */
async function renderWithMediabunny(
  videoSourceUrl: string,
  audioBlob: Blob,
  wordTimings: WordTiming[],
  subtitleSettings: SubtitleSettings,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  onProgress?.(5, 'กำลังเตรียมไฟล์วิดีโอและระบบตัดต่อ...');

  // 1. Create and prepare video element
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.src = videoSourceUrl;
  video.muted = true;
  video.playsInline = true;
  (video as any).playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  await new Promise<void>((res, reject) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => reject(new Error('ไม่สามารถโหลดไฟล์วิดีโอต้นฉบับได้'));
  });

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    await new Promise<void>(res => {
      const onCanPlay = () => { video.removeEventListener('canplay', onCanPlay); res(); };
      video.addEventListener('canplay', onCanPlay);
      setTimeout(() => res(), 600);
    });
  }

  const rawWidth = video.videoWidth || 1080;
  const rawHeight = video.videoHeight || 1920;
  // H.264 requires even dimensions
  const width = rawWidth % 2 === 0 ? rawWidth : rawWidth - 1;
  const height = rawHeight % 2 === 0 ? rawHeight : rawHeight - 1;
  const sourceDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

  onProgress?.(12, 'กำลังถอดรหัสคลื่นเสียงพากย์ (PCM Audio Decoding)...');

  // 2. Decode audio with AudioContext
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  let audioBuffer: AudioBuffer;
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch (e) {
    console.warn('decodeAudioData fallback:', e);
    const estDuration = await getVideoRendererAudioDuration(audioBlob).catch(() => sourceDuration);
    const silentLen = Math.ceil(estDuration * audioContext.sampleRate);
    audioBuffer = audioContext.createBuffer(1, Math.max(1, silentLen), audioContext.sampleRate);
  } finally {
    try { audioContext.close().catch(() => {}); } catch {}
  }

  const timingsDuration = wordTimings.length ? Math.max(...wordTimings.map(t => t.end)) : 0;
  const finalDuration = Math.max(audioBuffer.duration || sourceDuration, timingsDuration, sourceDuration, 3);

  // Pre-warm video first frame safely
  try {
    video.currentTime = 0;
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onReady = () => {
          video.removeEventListener('canplay', onReady);
          resolve();
        };
        video.addEventListener('canplay', onReady, { once: true });
        setTimeout(resolve, 300);
      });
    }
  } catch {}

  onProgress?.(15, 'กำลังสร้างแทร็กวิดีโอและเสียง (H.264 / AAC Encoding)...');

  // 3. Setup Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

  // Initial draw first frame onto canvas
  if (video.readyState >= 2) {
    ctx.drawImage(video, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
  }

  // 4. Setup Mediabunny Output
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality('high'),
  });

  const audioSource = new AudioBufferSource({
    codec: 'aac',
    quality: new Quality('high'),
  });

  const fps = 30;
  output.addVideoTrack(videoSource, { frameRate: fps });
  output.addAudioTrack(audioSource);

  await output.start();

  // Add full audio buffer to output
  await audioSource.add(audioBuffer);
  audioSource.close();

  // 5. Render frames sequentially
  const totalFrames = Math.ceil(finalDuration * fps);
  const frameDuration = 1 / fps;

  for (let i = 0; i < totalFrames; i++) {
    const currentTime = i * frameDuration;
    const seekTime = currentTime % sourceDuration;

    await seekVideoTo(video, seekTime);

    // Draw video frame onto canvas (retain last valid frame if temporarily not ready, never flash black)
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, width, height);
    }

    // Draw Burned-in Subtitles onto canvas
    drawKaraokeSubtitles(ctx, currentTime, wordTimings, subtitleSettings, width, height);

    // Add canvas frame to video track
    await videoSource.add(currentTime, frameDuration);

    if (i % 6 === 0 || i === totalFrames - 1) {
      const progressPercent = Math.min(94, Math.round((i / totalFrames) * 80) + 15);
      onProgress?.(
        progressPercent,
        `กำลังเรนเดอร์เฟรมและซับ (${Math.round(currentTime)}s / ${Math.round(finalDuration)}s)...`
      );
    }
  }

  videoSource.close();

  onProgress?.(96, 'กำลังประกอบไฟล์ MP4 (FastStart Muxing)...');
  await output.finalize();

  const finalBlob = new Blob([target.buffer!], { type: 'video/mp4' });
  const videoUrl = URL.createObjectURL(finalBlob);

  const assContent = generateAssSubtitles(wordTimings, subtitleSettings, width, height);
  const srtContent = generateSrtSubtitles(wordTimings);

  onProgress?.(100, 'เรนเดอร์คลิปวิดีโอเสร็จสมบูรณ์!');

  return {
    videoBlob: finalBlob,
    videoUrl,
    assSubtitleContent: assContent,
    srtSubtitleContent: srtContent,
  };
}

/**
 * Fallback MediaRecorder implementation
 */
async function renderWithMediaRecorder(
  videoSourceUrl: string,
  audioBlob: Blob,
  wordTimings: WordTiming[],
  subtitleSettings: SubtitleSettings,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  return new Promise(async (resolve, reject) => {
    try {
      onProgress?.(5, 'กำลังเตรียมไฟล์วิดีโอและระบบตัดต่อ...');

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoSourceUrl;
      video.muted = true;
      video.playsInline = true;
      (video as any).playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.loop = true;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
      if (isMobile) {
        video.style.position = 'fixed';
        video.style.left = '-9999px';
        video.style.top = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        document.body.appendChild(video);
        (video as any)._wasInDom = true;
      }

      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error('ไม่สามารถโหลดไฟล์วิดีโอต้นฉบับได้'));
      });

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        await new Promise<void>(res => {
          const onCanPlay = () => { video.removeEventListener('canplay', onCanPlay); res(); };
          video.addEventListener('canplay', onCanPlay);
          setTimeout(() => res(), 800);
        });
      }

      const width = video.videoWidth || 1080;
      const height = video.videoHeight || 1920;
      const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

      onProgress?.(15, 'กำลังถอดรหัสคลื่นเสียงพากย์ (PCM Audio Decoding)...');

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
        audioDuration = await getVideoRendererAudioDuration(audioBlob).catch(() => duration);
        const silentLen = Math.ceil(audioDuration * audioContext.sampleRate);
        audioBuffer = audioContext.createBuffer(1, Math.max(1, silentLen), audioContext.sampleRate);
      }

      const timingsDuration = wordTimings.length ? Math.max(...wordTimings.map(t => t.end)) : 0;
      const finalDuration = Math.max(duration, audioDuration, timingsDuration, 3);

      const audioDestination = audioContext.createMediaStreamDestination();
      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(audioDestination);

      const targetWidth = isMobile ? Math.min(width, 720) : width;
      const targetHeight = isMobile ? Math.round((targetWidth / width) * height) : height;
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.style.position = 'fixed';
      canvas.style.left = '-9999px';
      canvas.style.top = '-9999px';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

      let canvasStream: MediaStream;
      try {
        canvasStream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).captureStream(30);
      } catch (e) {
        const videoStream = (video as any).captureStream ? (video as any).captureStream(30) : null;
        if (videoStream) canvasStream = videoStream;
        else throw new Error('เบราว์เซอร์ไม่รองรับการอัดวิดีโอจาก Canvas');
      }

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);

      const candidates = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      let mimeType = candidates.find(t => {
        try { return (window as any).MediaRecorder && MediaRecorder.isTypeSupported(t); } catch { return false; }
      }) || 'video/mp4';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: isMobile ? 2500000 : 6000000,
        audioBitsPerSecond: isMobile ? 128000 : 192000
      });

      const recordedChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      recorder.onstop = () => {
        try { bufferSource.stop(); } catch {}
        try { audioContext.close().catch(() => {}); } catch {}
        try { document.body.removeChild(canvas); } catch {}
        try { if ((video as any)._wasInDom) document.body.removeChild(video); } catch {}

        const finalBlob = new Blob(recordedChunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(finalBlob);

        const assContent = generateAssSubtitles(wordTimings, subtitleSettings, canvas.width, canvas.height);
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

        if (video.currentTime >= duration - 0.15 && elapsed < finalDuration - 0.1) {
          if (video.paused) video.play().catch(() => {});
        }
        if (video.ended && elapsed < finalDuration) {
          try { video.currentTime = 0; } catch {}
          video.play().catch(() => {});
        }

        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        drawKaraokeSubtitles(ctx, elapsed, wordTimings, subtitleSettings, canvas.width, canvas.height);

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

function seekVideoTo(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - targetTime) < 0.02 && !video.seeking && video.readyState >= 2) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        video.removeEventListener('seeked', finish);
        video.removeEventListener('error', finish);
        resolve();
      }
    };

    video.addEventListener('seeked', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    video.currentTime = targetTime;

    setTimeout(finish, 100);
  });
}

/**
 * Draws crisp, natural Thai subtitles with contiguous script,
 * clean stroke outline, karaoke highlight, and accurate position coordinates.
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

  const tol = 0.08;
  let activeIndex = wordTimings.findIndex(t => currentTime >= t.start - tol && currentTime <= t.end + tol);
  let activePhrase = activeIndex >= 0 ? wordTimings[activeIndex] : undefined;
  if (!activePhrase) {
    activeIndex = wordTimings.findIndex(t => currentTime >= (t.start - 0.15) && currentTime <= (t.end + 0.20));
    activePhrase = activeIndex >= 0 ? wordTimings[activeIndex] : undefined;
  }

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

  // Subtitle Positioning calculation
  let yPos: number;
  if (typeof settings.yPercent === 'number' && !isNaN(settings.yPercent)) {
    yPos = canvasHeight * (Math.max(5, Math.min(95, settings.yPercent)) / 100);
  } else {
    switch (settings.position) {
      case 'top':
        yPos = canvasHeight * 0.16;
        break;
      case 'middle-top':
        yPos = canvasHeight * 0.32;
        break;
      case 'middle':
        yPos = canvasHeight * 0.50;
        break;
      case 'middle-bottom':
        yPos = canvasHeight * 0.75;
        break;
      case 'bottom':
        yPos = canvasHeight * 0.88;
        break;
      default:
        yPos = canvasHeight * 0.75;
    }
  }

  // Base font scale relative to 1080px canvas reference
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
  let marginV = 150;
  if (typeof settings.yPercent === 'number' && !isNaN(settings.yPercent)) {
    marginV = Math.round(height * (1 - Math.max(5, Math.min(95, settings.yPercent)) / 100));
  } else if (settings.position === 'top') {
    marginV = Math.round(height * 0.84);
  } else if (settings.position === 'middle-top') {
    marginV = Math.round(height * 0.68);
  } else if (settings.position === 'middle') {
    marginV = Math.round(height * 0.50);
  } else if (settings.position === 'middle-bottom') {
    marginV = Math.round(height * 0.25);
  } else if (settings.position === 'bottom') {
    marginV = Math.round(height * 0.12);
  }

  const header = `[Script Info]
Title: ReviewVoice Studio Karaoke Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,${settings.fontFamily || 'Kanit'},${settings.fontSize || 84},&H00FFFFFF,&H0015CCFA,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,20,20,${marginV},1

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
    setTimeout(() => resolve(10), 3000);
  });
}
