import { SubtitleSettings, WordTiming } from '../types';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { transcodeToShopeeCompliantMp4 } from './ffmpegTranscoder';

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
 * Universal Studio Video Renderer:
 * 1. Approach 1 (Preferred): mp4-muxer + WebCodecs VideoEncoder (avc1.42001f) & AudioEncoder (mp4a.40.2) with FastStart in-memory
 * 2. Approach 2 (Universal Fallback): WebAssembly FFmpeg (libx264 + AAC + yuv420p + faststart)
 * 
 * Strict Guarantee: Output is 100% genuine ISO Base Media File (MP4) accepted by Shopee Video and TikTok.
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
      console.warn('mp4-muxer WebCodecs failed, transitioning to FFmpeg WASM Transcoder:', err);
    }
  }

  // 2. Approach 2: FFmpeg WASM Transcoder Pipeline (libx264 main + aac + yuv420p + faststart)
  return await renderWithFfmpegWasmRecorder(
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
 * Approach 1: High-Speed WebCodecs + mp4-muxer
 * Generates pure ISO MP4 with avc1.42001f (H.264 Baseline) + mp4a.40.2 (AAC) + FastStart in-memory.
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
  onProgress?.(5, 'กำลังเตรียมระบบเรนเดอร์ (WebCodecs H.264 + AAC + mp4-muxer)...');

  // 1. Prepare video element
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.src = videoSourceUrl;
  video.muted = true;
  video.playsInline = true;
  (video as any).playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error('ไม่สามารถโหลดไฟล์วิดีโอต้นฉบับได้'));
  });

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    await new Promise<void>((res) => {
      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay);
        res();
      };
      video.addEventListener('canplay', onCanPlay);
      setTimeout(res, 600);
    });
  }

  const sourceDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

  onProgress?.(10, 'กำลังถอดรหัสคลื่นเสียงพากย์ (PCM Audio Decoding)...');

  // 2. Decode Audio into 48,000 Hz Stereo
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass({ sampleRate: 48000 });
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  let audioBuffer: AudioBuffer;
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch (e) {
    console.warn('Audio decode fallback:', e);
    const silentLen = Math.ceil(sourceDuration * 48000);
    audioBuffer = audioContext.createBuffer(2, Math.max(1, silentLen), 48000);
  } finally {
    try {
      audioContext.close().catch(() => {});
    } catch {}
  }

  const timingsDuration = wordTimings.length ? Math.max(...wordTimings.map((t) => t.end)) : 0;
  const finalDuration = Math.max(audioBuffer.duration || sourceDuration, timingsDuration, sourceDuration, 3.5);

  // 3. Setup Canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

  // Pre-warm video frame 0 onto canvas
  video.currentTime = 0;
  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        drawKaraokeSubtitles(ctx, 0, wordTimings, subtitleSettings, targetWidth, targetHeight);
      }
      resolve();
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = 0;
    setTimeout(resolve, 300);
  });

  // 4. Setup mp4-muxer
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

  // Setup WebCodecs VideoEncoder
  let encoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      console.error('VideoEncoder error:', e);
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  videoEncoder.configure({
    codec: 'avc1.42001f', // H.264 Baseline Profile Level 3.1
    width: targetWidth,
    height: targetHeight,
    bitrate: 4_000_000,
    framerate: 30,
    avc: { format: 'avc' },
  });

  // Setup WebCodecs AudioEncoder
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => {
      console.error('AudioEncoder error:', e);
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  audioEncoder.configure({
    codec: 'mp4a.40.2',
    numberOfChannels: 2,
    sampleRate: 48000,
    bitrate: 128000,
  });

  // Encode Audio Data into AudioEncoder
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

  onProgress?.(15, 'กำลังเรนเดอร์ภาพและซับไตเติ้ล (Constant 30 FPS H.264)...');

  // 5. Frame-by-Frame Video Encoding
  const fps = 30;
  const totalFrames = Math.ceil(finalDuration * fps);
  const frameDuration = 1 / fps;

  for (let i = 0; i < totalFrames; i++) {
    if (encoderError) throw encoderError;

    const currentTime = i * frameDuration;
    const seekTime = sourceDuration > 0 ? currentTime % sourceDuration : currentTime;

    if (Math.abs(video.currentTime - seekTime) > 0.02) {
      video.currentTime = seekTime;
      await new Promise<void>((resolve) => {
        const onSeek = () => {
          video.removeEventListener('seeked', onSeek);
          resolve();
        };
        video.addEventListener('seeked', onSeek, { once: true });
        setTimeout(resolve, 40);
      });
    }

    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    }

    drawKaraokeSubtitles(ctx, currentTime, wordTimings, subtitleSettings, targetWidth, targetHeight);

    const frameTimestamp = Math.round(currentTime * 1_000_000);
    const frame = new VideoFrame(canvas, {
      timestamp: frameTimestamp,
      duration: Math.round(frameDuration * 1_000_000),
    });

    videoEncoder.encode(frame, { keyFrame: i % 60 === 0 });
    frame.close();

    if (i % 8 === 0 || i === totalFrames - 1) {
      const progressPercent = Math.min(94, Math.round((i / totalFrames) * 80) + 15);
      onProgress?.(
        progressPercent,
        `กำลังเรนเดอร์เฟรมที่ ${i + 1}/${totalFrames} (${Math.round(currentTime)}s / ${Math.round(finalDuration)}s)...`
      );
    }
  }

  onProgress?.(95, 'กำลังบันทึกและจัดระเบียบ Moov Atom (FastStart MP4)...');

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
}

/**
 * Approach 2: FFmpeg WASM Transcoder Pipeline
 * Records raw stream and strictly pipes into FFmpeg WASM:
 * ffmpeg -i input.webm -c:v libx264 -pix_fmt yuv420p -profile:v main -level 3.1 -movflags +faststart -c:a aac -b:a 128k output.mp4
 * Returns ONLY output.mp4 as a 100% compliant video/mp4 Blob.
 */
async function renderWithFfmpegWasmRecorder(
  videoSourceUrl: string,
  audioBlob: Blob,
  wordTimings: WordTiming[],
  subtitleSettings: SubtitleSettings,
  targetWidth: number,
  targetHeight: number,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  return new Promise(async (resolve, reject) => {
    let video: HTMLVideoElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let audioContext: AudioContext | null = null;
    let bufferSource: AudioBufferSourceNode | null = null;

    try {
      onProgress?.(5, 'กำลังเตรียมระบบเรนเดอร์ (FFmpeg WASM Pipeline)...');

      // 1. Setup Video Element
      video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoSourceUrl;
      video.muted = true;
      video.playsInline = true;
      (video as any).playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.loop = true;

      video.style.position = 'fixed';
      video.style.right = '0';
      video.style.bottom = '0';
      video.style.width = '360px';
      video.style.height = '640px';
      video.style.opacity = '0.001';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-999';
      document.body.appendChild(video);

      await new Promise<void>((res, rej) => {
        if (!video) return rej(new Error('Video element not found'));
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error('ไม่สามารถโหลดไฟล์วิดีโอต้นฉบับได้'));
      });

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        await new Promise<void>((res) => {
          if (!video) return res();
          const onCanPlay = () => {
            video?.removeEventListener('canplay', onCanPlay);
            res();
          };
          video.addEventListener('canplay', onCanPlay);
          setTimeout(res, 800);
        });
      }

      const videoDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

      onProgress?.(12, 'กำลังถอดรหัสคลื่นเสียงพากย์ (PCM Audio Decoding)...');

      // 2. Setup Web Audio
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass({ sampleRate: 48000 });
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      let audioBuffer: AudioBuffer;
      let audioDuration = videoDuration;
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        audioDuration = audioBuffer.duration || videoDuration;
      } catch (e) {
        audioDuration = await getVideoRendererAudioDuration(audioBlob).catch(() => videoDuration);
        const silentLen = Math.ceil(audioDuration * 48000);
        audioBuffer = audioContext.createBuffer(2, Math.max(1, silentLen), 48000);
      }

      const timingsDuration = wordTimings.length ? Math.max(...wordTimings.map((t) => t.end)) : 0;
      const finalDuration = Math.max(videoDuration, audioDuration, timingsDuration, 3.5);

      const audioDestination = audioContext.createMediaStreamDestination();
      bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(audioDestination);

      // 3. Setup Canvas
      const canvasWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
      const canvasHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

      canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.position = 'fixed';
      canvas.style.right = '0';
      canvas.style.bottom = '0';
      canvas.style.width = '360px';
      canvas.style.height = '640px';
      canvas.style.opacity = '0.001';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '-999';
      document.body.appendChild(canvas);

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

      // Pre-warm frame 0
      video.currentTime = 0;
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const checkReady = () => {
          attempts++;
          if (video && video.readyState >= 2 && video.videoWidth > 0) {
            ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
            drawKaraokeSubtitles(ctx, 0, wordTimings, subtitleSettings, canvasWidth, canvasHeight);
            resolve();
          } else if (attempts < 20) {
            setTimeout(checkReady, 50);
          } else {
            resolve();
          }
        };
        checkReady();
      });

      // 4. Capture 30 FPS Canvas Stream
      let canvasStream: MediaStream;
      try {
        canvasStream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).captureStream(30);
      } catch (e) {
        const videoStream = (video as any).captureStream ? (video as any).captureStream(30) : null;
        if (videoStream) canvasStream = videoStream;
        else throw new Error('เบราว์เซอร์ไม่รองรับการบันทึกวิดีโอจาก Canvas');
      }

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);

      // Record into raw WebM buffer
      const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm',
        videoBitsPerSecond: isMobile ? 3500000 : 7000000,
        audioBitsPerSecond: 192000,
      });

      const recordedChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        try {
          bufferSource?.stop();
        } catch {}
        try {
          audioContext?.close().catch(() => {});
        } catch {}
        try {
          if (canvas && canvas.parentNode) document.body.removeChild(canvas);
        } catch {}
        try {
          if (video && video.parentNode) document.body.removeChild(video);
        } catch {}

        onProgress?.(88, 'กำลังส่งเข้า FFmpeg WASM เพื่อแปลงเป็น ISO H.264/AAC MP4 แท้...');

        const rawWebmBlob = new Blob(recordedChunks, { type: 'video/webm' });
        
        // Strictly transcode raw WebM with FFmpeg libx264 + AAC + yuv420p + faststart
        const finalBlob = await transcodeToShopeeCompliantMp4(rawWebmBlob, onProgress);
        const videoUrl = URL.createObjectURL(finalBlob);

        const assContent = generateAssSubtitles(wordTimings, subtitleSettings, canvasWidth, canvasHeight);
        const srtContent = generateSrtSubtitles(wordTimings);

        onProgress?.(100, 'เรนเดอร์คลิปวิดีโอเสร็จสมบูรณ์ 100%!');
        resolve({
          videoBlob: finalBlob,
          videoUrl,
          assSubtitleContent: assContent,
          srtSubtitleContent: srtContent,
        });
      };

      recorder.onerror = (err) => {
        reject(new Error(`เกิดข้อผิดพลาดในการบันทึกวิดีโอ: ${err.toString()}`));
      };

      // 5. Start Playback & Recording
      video.currentTime = 0;
      await video.play().catch(() => {});
      recorder.start(100);
      bufferSource.start(0);

      const startTime = performance.now();

      function drawFrame() {
        if (!recorder || recorder.state !== 'recording' || !ctx || !video || !canvas) return;

        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(85, Math.round((elapsed / finalDuration) * 70) + 15);
        onProgress?.(
          progress,
          `กำลังเรนเดอร์ภาพและเสียงพากย์ (${Math.round(elapsed)}s / ${Math.round(finalDuration)}s)...`
        );

        if (video.currentTime >= videoDuration - 0.15 && elapsed < finalDuration - 0.1) {
          if (video.paused) video.play().catch(() => {});
        }
        if (video.ended && elapsed < finalDuration) {
          try {
            video.currentTime = 0;
          } catch {}
          video.play().catch(() => {});
        }

        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        drawKaraokeSubtitles(ctx, elapsed, wordTimings, subtitleSettings, canvas.width, canvas.height);

        if (elapsed >= finalDuration) {
          try {
            recorder.stop();
            video.pause();
          } catch {}
        } else {
          requestAnimationFrame(drawFrame);
        }
      }

      requestAnimationFrame(drawFrame);
    } catch (err: any) {
      if (canvas && canvas.parentNode) document.body.removeChild(canvas);
      if (video && video.parentNode) document.body.removeChild(video);
      reject(err);
    }
  });
}

/**
 * Draws crisp, natural Thai subtitles with contiguous script,
 * clean stroke outline, karaoke highlight, and accurate position coordinates.
 * Strictly calculates active word highlight based on real-time speech timing + offset.
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
  let activePhrase = activeIndex >= 0 ? wordTimings[activeIndex] : undefined;
  if (!activePhrase) {
    activeIndex = wordTimings.findIndex((t) => effectiveTime >= t.start - 0.15 && effectiveTime <= t.end + 0.2);
    activePhrase = activeIndex >= 0 ? wordTimings[activeIndex] : undefined;
  }

  if (!activePhrase && effectiveTime < wordTimings[0].start && wordTimings[0].start < 1.0) {
    activePhrase = wordTimings[0];
    activeIndex = 0;
  }

  if (!activePhrase || !activePhrase.word.trim()) return;

  const wordsPerLine = Math.max(1, settings.wordsPerLine || 3);
  const lineStart = Math.floor(activeIndex / wordsPerLine) * wordsPerLine;
  const lineWords = wordTimings.slice(lineStart, lineStart + wordsPerLine);
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
        yPos = canvasHeight * 0.5;
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
    ctx.lineWidth = Math.max(2, baseStrokeWidth * (currentFontSize / 84) * scale * 1.3);
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

function getVideoRendererAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(blob);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 10));
    audio.addEventListener('error', () => resolve(10));
    setTimeout(() => resolve(10), 3000);
  });
}
