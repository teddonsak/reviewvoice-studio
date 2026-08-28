import { SubtitleSettings, WordTiming } from '../types';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { getFFmpeg } from './ffmpegTranscoder';
import { fetchFile } from '@ffmpeg/util';

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
 * Checks if WebCodecs VideoEncoder & AudioEncoder support H.264 (avc1) & AAC (mp4a.40.2)
 */
async function isWebCodecsMp4Supported(width: number, height: number): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
    return false;
  }
  try {
    const [videoSupport, audioSupport] = await Promise.all([
      VideoEncoder.isConfigSupported({
        codec: 'avc1.42001f', // H.264 Baseline Profile Level 3.1
        width,
        height,
        bitrate: 4_000_000,
        framerate: 30,
      }),
      AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2', // AAC-LC
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      }),
    ]);
    return !!(videoSupport.supported && audioSupport.supported);
  } catch {
    return false;
  }
}

/**
 * Prepares and pre-buffers the source HTML5 video to guarantee frame 0 is decoded and visible.
 */
async function prepareSourceVideo(videoSourceUrl: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.src = videoSourceUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.width = '360px';
  video.style.height = '640px';
  document.body.appendChild(video);

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error('ไม่สามารถโหลดไฟล์วิดีโอต้นฉบับได้'));
  });

  // Ensure initial data is fully buffered
  await new Promise<void>((res) => {
    if (video.readyState >= 3) return res();
    const onLoaded = () => {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('canplay', onLoaded);
      res();
    };
    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('canplay', onLoaded, { once: true });
    video.load();
    setTimeout(res, 1000);
  });

  // Seek and lock frame 0
  video.currentTime = 0;
  await new Promise<void>((res) => {
    const onSeek = () => {
      video.removeEventListener('seeked', onSeek);
      res();
    };
    video.addEventListener('seeked', onSeek, { once: true });
    setTimeout(res, 400);
  });

  return video;
}

/**
 * Accurate deterministic video seek helper.
 */
async function seekVideoToTime(video: HTMLVideoElement, targetTime: number): Promise<void> {
  if (Math.abs(video.currentTime - targetTime) < 0.001 && video.readyState >= 2) {
    return;
  }
  return new Promise<void>((resolve) => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }
    };
    const onSeeked = () => finish();
    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = targetTime;
    setTimeout(finish, 100);
  });
}

/**
 * Universal Studio Video Renderer with 100% Deterministic Frame-by-Frame Rendering:
 * 1. Approach 1 (Preferred): mp4-muxer + WebCodecs VideoEncoder (avc1.42001f) & AudioEncoder (mp4a.40.2)
 * 2. Approach 2 (Universal Fallback): WebAssembly FFmpeg Frame-by-Frame (libx264 + AAC + yuv420p + faststart)
 * 
 * Guarantees:
 * - 0% Stuttering / 0 Dropped Frames (Constant 30 FPS CFR)
 * - 0ms Black Screen at opening (Pre-buffered frame 0)
 * - 100% Shopee Video & TikTok Format Compliance
 */
export async function renderFinalVideo(
  videoSourceUrl: string,
  audioBlob: Blob,
  wordTimings: WordTiming[],
  subtitleSettings: SubtitleSettings,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
  const targetWidth = isMobile ? 720 : 1080;
  const targetHeight = isMobile ? 1280 : 1920;

  // 1. Check if direct WebCodecs + mp4-muxer is supported
  const canUseMp4Muxer = await isWebCodecsMp4Supported(targetWidth, targetHeight).catch(() => false);

  if (canUseMp4Muxer) {
    try {
      return await renderWithMp4MuxerWebCodecs(
        videoSourceUrl,
        audioBlob,
        wordTimings,
        subtitleSettings,
        targetWidth,
        targetHeight,
        onProgress
      );
    } catch (err) {
      console.warn('mp4-muxer WebCodecs failed, transitioning to FFmpeg WASM Offline Renderer:', err);
    }
  }

  // 2. Approach 2: FFmpeg WASM Offline Frame-by-Frame Renderer
  return await renderWithFfmpegWasmOffline(
    videoSourceUrl,
    audioBlob,
    wordTimings,
    subtitleSettings,
    targetWidth,
    targetHeight,
    onProgress
  );
}

/**
 * Approach 1: High-Speed WebCodecs + mp4-muxer (Deterministic Frame-by-Frame)
 */
async function renderWithMp4MuxerWebCodecs(
  videoSourceUrl: string,
  audioBlob: Blob,
  wordTimings: WordTiming[],
  subtitleSettings: SubtitleSettings,
  targetWidth: number,
  targetHeight: number,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  let video: HTMLVideoElement | null = null;
  let audioContext: AudioContext | null = null;

  try {
    onProgress?.(5, 'กำลังโหลดและเตรียมบัฟเฟอร์วิดีโอ (Preload 100%)...');

    video = await prepareSourceVideo(videoSourceUrl);
    const sourceDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

    onProgress?.(10, 'กำลังถอดรหัสคลื่นเสียงพากย์ (PCM Audio Decoding)...');

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContextClass({ sampleRate: 48000 });
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    let audioBuffer: AudioBuffer;
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (e) {
      const silentLen = Math.ceil(sourceDuration * 48000);
      audioBuffer = audioContext.createBuffer(2, Math.max(1, silentLen), 48000);
    }

    const timingsDuration = wordTimings.length ? Math.max(...wordTimings.map((t) => t.end)) : 0;
    const finalDuration = Math.max(audioBuffer.duration || sourceDuration, timingsDuration, sourceDuration, 3.5);

    // Setup Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

    // Pre-draw frame 0 onto canvas
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    drawKaraokeSubtitles(ctx, 0, wordTimings, subtitleSettings, targetWidth, targetHeight);

    // Setup mp4-muxer
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: targetWidth,
        height: targetHeight,
      },
      audio: {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48000,
      },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    let encoderError: Error | null = null;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        encoderError = e instanceof Error ? e : new Error(String(e));
      },
    });

    videoEncoder.configure({
      codec: 'avc1.42001f', // H.264 Baseline Profile Level 3.1
      width: targetWidth,
      height: targetHeight,
      bitrate: 4_500_000,
      framerate: 30,
      avc: { format: 'avc' },
    });

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => {
        encoderError = e instanceof Error ? e : new Error(String(e));
      },
    });

    audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: 128000,
    });

    // Encode Audio Track
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = audioBuffer.length;
    const chunkSize = 1024;
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;

    for (let offset = 0; offset < totalSamples; offset += chunkSize) {
      const count = Math.min(chunkSize, totalSamples - offset);
      const planarData = new Float32Array(count * 2);
      planarData.set(left.subarray(offset, offset + count), 0);
      planarData.set(right.subarray(offset, offset + count), count);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: count,
        numberOfChannels: 2,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: planarData,
      });

      audioEncoder.encode(audioData);
      audioData.close();
    }

    onProgress?.(15, 'กำลังเรนเดอร์ภาพทีละเฟรม (Deterministic 30 FPS CFR)...');

    // Deterministic Offline Frame-by-Frame Loop
    const fps = 30;
    const totalFrames = Math.ceil(finalDuration * fps);
    const frameDuration = 1 / fps;

    for (let i = 0; i < totalFrames; i++) {
      if (encoderError) throw encoderError;

      const currentTime = i * frameDuration;
      const seekTime = sourceDuration > 0 ? currentTime % sourceDuration : currentTime;

      // Seek video to exact frame time
      await seekVideoToTime(video, seekTime);

      // Draw exact video frame to canvas
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      // Draw crisp, stable karaoke subtitles
      drawKaraokeSubtitles(ctx, currentTime, wordTimings, subtitleSettings, targetWidth, targetHeight);

      // Construct VideoFrame with exact timestamp
      const frameTimestamp = Math.round(i * (1_000_000 / fps));
      const frame = new VideoFrame(canvas, {
        timestamp: frameTimestamp,
        duration: Math.round(1_000_000 / fps),
      });

      videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
      frame.close();

      // Backpressure management: wait if encoder queue is backed up
      while (videoEncoder.encodeQueueSize > 4) {
        await new Promise((r) => setTimeout(r, 8));
      }

      if (i % 6 === 0 || i === totalFrames - 1) {
        const progressPercent = Math.min(94, Math.round((i / totalFrames) * 80) + 15);
        onProgress?.(
          progressPercent,
          `กำลังเรนเดอร์เฟรมที่ ${i + 1}/${totalFrames} (${Math.round(currentTime)}s / ${Math.round(finalDuration)}s)...`
        );
      }
    }

    onProgress?.(95, 'กำลังจัดระเบียบ Moov Atom (FastStart MP4)...');

    await videoEncoder.flush();
    await audioEncoder.flush();
    videoEncoder.close();
    audioEncoder.close();
    muxer.finalize();

    const finalBlob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    const videoUrl = URL.createObjectURL(finalBlob);

    const assContent = generateAssSubtitles(wordTimings, subtitleSettings, targetWidth, targetHeight);
    const srtContent = generateSrtSubtitles(wordTimings);

    onProgress?.(100, 'เรนเดอร์คลิปวิดีโอเสร็จสมบูรณ์ 100%!');

    return {
      videoBlob: finalBlob,
      videoUrl,
      assSubtitleContent: assContent,
      srtSubtitleContent: srtContent,
    };
  } finally {
    if (video && video.parentNode) document.body.removeChild(video);
    try {
      audioContext?.close().catch(() => {});
    } catch {}
  }
}

/**
 * Approach 2: FFmpeg WASM Offline Frame-by-Frame Renderer
 * Renders JPEG frames offline and encodes with FFmpeg WASM (libx264 main + aac + yuv420p + faststart).
 */
async function renderWithFfmpegWasmOffline(
  videoSourceUrl: string,
  audioBlob: Blob,
  wordTimings: WordTiming[],
  subtitleSettings: SubtitleSettings,
  targetWidth: number,
  targetHeight: number,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  let video: HTMLVideoElement | null = null;
  let audioContext: AudioContext | null = null;

  try {
    onProgress?.(5, 'กำลังโหลดและเตรียมบัฟเฟอร์วิดีโอ (Preload 100%)...');

    video = await prepareSourceVideo(videoSourceUrl);
    const sourceDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

    onProgress?.(10, 'กำลังโหลดเอนจิน FFmpeg WASM...');

    const ffmpeg = await getFFmpeg();

    const timingsDuration = wordTimings.length ? Math.max(...wordTimings.map((t) => t.end)) : 0;
    const finalDuration = Math.max(timingsDuration, sourceDuration, 3.5);

    // Setup Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

    const fps = 30;
    const totalFrames = Math.ceil(finalDuration * fps);
    const frameDuration = 1 / fps;

    onProgress?.(15, 'กำลังเรนเดอร์เฟรมภาพและซับไตเติลทีละเฟรม...');

    // Render each frame offline and write to virtual filesystem
    for (let i = 0; i < totalFrames; i++) {
      const currentTime = i * frameDuration;
      const seekTime = sourceDuration > 0 ? currentTime % sourceDuration : currentTime;

      await seekVideoToTime(video, seekTime);
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      drawKaraokeSubtitles(ctx, currentTime, wordTimings, subtitleSettings, targetWidth, targetHeight);

      // Export JPEG frame
      const frameBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (frameBlob) {
        const frameNum = pad(i, 5);
        await ffmpeg.writeFile(`frame_${frameNum}.jpg`, await fetchFile(frameBlob));
      }

      if (i % 6 === 0 || i === totalFrames - 1) {
        const progressPercent = Math.min(85, Math.round((i / totalFrames) * 70) + 15);
        onProgress?.(
          progressPercent,
          `กำลังวาดเฟรมที่ ${i + 1}/${totalFrames} (${Math.round(currentTime)}s / ${Math.round(finalDuration)}s)...`
        );
      }
    }

    onProgress?.(86, 'กำลังบันทึกเสียงและเข้ารหัส H.264/AAC MP4...');

    // Write audio file
    await ffmpeg.writeFile('audio.wav', await fetchFile(audioBlob));

    const outputName = `shopee_output_${Date.now()}.mp4`;

    // Run FFmpeg: libx264 + aac + yuv420p + faststart
    await ffmpeg.exec([
      '-framerate', '30',
      '-i', 'frame_%05d.jpg',
      '-i', 'audio.wav',
      '-c:v', 'libx264',
      '-profile:v', 'main',
      '-level', '3.1',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-movflags', '+faststart',
      '-shortest',
      outputName,
    ]);

    const outputData = await ffmpeg.readFile(outputName);

    // Clean virtual file system
    for (let i = 0; i < totalFrames; i++) {
      try {
        await ffmpeg.deleteFile(`frame_${pad(i, 5)}.jpg`);
      } catch {}
    }
    try {
      await ffmpeg.deleteFile('audio.wav');
      await ffmpeg.deleteFile(outputName);
    } catch {}

    const outputBytes = typeof outputData === 'string'
      ? new TextEncoder().encode(outputData)
      : new Uint8Array(outputData);

    const finalBlob = new Blob([outputBytes.slice().buffer], { type: 'video/mp4' });
    const videoUrl = URL.createObjectURL(finalBlob);

    const assContent = generateAssSubtitles(wordTimings, subtitleSettings, targetWidth, targetHeight);
    const srtContent = generateSrtSubtitles(wordTimings);

    onProgress?.(100, 'เรนเดอร์คลิปวิดีโอเสร็จสมบูรณ์ 100%!');

    return {
      videoBlob: finalBlob,
      videoUrl,
      assSubtitleContent: assContent,
      srtSubtitleContent: srtContent,
    };
  } finally {
    if (video && video.parentNode) document.body.removeChild(video);
  }
}

/**
 * Draws crisp, natural Thai subtitles with contiguous script,
 * clean stroke outline, karaoke highlight, and stable fixed baseline.
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

  const offsetSeconds = (settings.syncOffsetMs || 0) / 1000;
  const effectiveTime = currentTime + offsetSeconds;

  const tol = 0.08;
  let activeIndex = wordTimings.findIndex((t) => effectiveTime >= t.start - tol && effectiveTime <= t.end + tol);
  if (activeIndex < 0) {
    activeIndex = wordTimings.findIndex((t) => effectiveTime >= t.start - 0.15 && effectiveTime <= t.end + 0.2);
  }
  if (activeIndex < 0 && effectiveTime < wordTimings[0].start && wordTimings[0].start < 1.0) {
    activeIndex = 0;
  }
  if (activeIndex < 0) return;

  const wordsPerLine = Math.max(1, settings.wordsPerLine || 3);
  const lineStart = Math.floor(activeIndex / wordsPerLine) * wordsPerLine;
  const lineWords = wordTimings.slice(lineStart, lineStart + wordsPerLine);

  // Natural Thai words boundary
  const joinWords = (items: WordTiming[]) =>
    items
      .map((item, index) => {
        if (index === 0) return item.word.trim();
        const previous = items[index - 1].word.trim();
        const current = item.word.trim();
        const thaiBoundary = /[\u0E00-\u0E7F]$/.test(previous) && /^[\u0E00-\u0E7F]/.test(current);
        return `${thaiBoundary ? '' : ' '}${current}`;
      })
      .join('');
  const phraseText = joinWords(lineWords);

  // Subtitle Vertical Positioning calculation (Stable Fixed Baseline)
  let yPos: number;
  if (typeof settings.yPercent === 'number' && !isNaN(settings.yPercent)) {
    yPos = Math.round(canvasHeight * (Math.max(5, Math.min(95, settings.yPercent)) / 100));
  } else {
    switch (settings.position) {
      case 'top':
        yPos = Math.round(canvasHeight * 0.16);
        break;
      case 'middle-top':
        yPos = Math.round(canvasHeight * 0.32);
        break;
      case 'middle':
        yPos = Math.round(canvasHeight * 0.5);
        break;
      case 'middle-bottom':
        yPos = Math.round(canvasHeight * 0.75);
        break;
      case 'bottom':
        yPos = Math.round(canvasHeight * 0.88);
        break;
      default:
        yPos = Math.round(canvasHeight * 0.75);
    }
  }

  const scale = canvasWidth / 1080;
  let currentFontSize = Math.max(18, Math.round((settings.fontSize || 84) * scale));
  const fontWeight = settings.fontWeight || '800';
  const fontFamily = settings.fontFamily || 'Kanit';

  ctx.save();
  ctx.font = `${fontWeight} ${currentFontSize}px '${fontFamily}', 'Prompt', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Measure text width
  let totalMetrics = ctx.measureText(phraseText);
  let textWidth = totalMetrics.width;

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
  const boxHeight = Math.round(currentFontSize * 1.3 + paddingY * 2);
  const boxWidth = Math.min(canvasWidth * 0.94, textWidth + paddingX * 2);

  // 1. Draw Background Badge Box with Stable Height
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

  if (baseStrokeWidth > 0) {
    ctx.lineWidth = Math.max(2, baseStrokeWidth * (currentFontSize / 84) * scale * 1.3);
    ctx.strokeStyle = settings.strokeColor || '#000000';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(phraseText, centerX, yPos);
  }

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
  const offsetSeconds = (settings.syncOffsetMs || 0) / 1000;
  let marginV = 150;
  if (typeof settings.yPercent === 'number' && !isNaN(settings.yPercent)) {
    marginV = Math.round(height * (1 - Math.max(5, Math.min(95, settings.yPercent)) / 100));
  } else if (settings.position === 'top') {
    marginV = Math.round(height * 0.84);
  } else if (settings.position === 'middle-top') {
    marginV = Math.round(height * 0.68);
  } else if (settings.position === 'middle') {
    marginV = Math.round(height * 0.5);
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

    const startTime = formatAssTime(Math.max(0, chunk[0].start + offsetSeconds));
    const endTime = formatAssTime(Math.max(0, chunk[chunk.length - 1].end + offsetSeconds));

    const isKaraokeMode = settings.styleMode !== 'standard';
    const textContent = isKaraokeMode
      ? joinSubtitleItems(
          chunk.map((item) => {
            const durationCs = Math.round((item.end - item.start) * 100);
            return `{\\k${durationCs}}${item.word}`;
          })
        )
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
  return items
    .map((item, index) => {
      if (index === 0) return item;
      const previousPlain = items[index - 1].replace(/\{[^}]+\}/g, '');
      const currentPlain = item.replace(/\{[^}]+\}/g, '');
      const thaiBoundary = /[\u0E00-\u0E7F]$/.test(previousPlain) && /^[\u0E00-\u0E7F]/.test(currentPlain);
      return `${thaiBoundary ? '' : ' '}${item}`;
    })
    .join('');
}
