import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isFfmpegLoading = false;

/**
 * Checks if a Blob is a valid ISO Base Media File (MP4 container with 'ftyp' box).
 */
export async function isPureMp4Container(blob: Blob): Promise<boolean> {
  try {
    const slice = await blob.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(slice);
    // Check for 'ftyp' box at offset 4
    return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  } catch {
    return false;
  }
}

/**
 * Loads FFmpeg WASM single-thread engine (compatible with GitHub Pages, Android Chrome, and iOS).
 */
export async function getFFmpeg(onProgress?: (ratio: number, msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (isFfmpegLoading) {
    while (isFfmpegLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  }

  isFfmpegLoading = true;
  const ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg Log]', message);
  });

  ffmpeg.on('progress', ({ progress }) => {
    const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
    onProgress?.(percent, `กำลังแปลงไฟล์ H.264/AAC ด้วย FFmpeg (${percent}%)...`);
  });

  const cdnList = [
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
    'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
  ];

  let lastError: any = null;
  for (const baseURL of cdnList) {
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegInstance = ffmpeg;
      isFfmpegLoading = false;
      return ffmpeg;
    } catch (e) {
      lastError = e;
      console.warn(`Failed loading FFmpeg from ${baseURL}, trying next...`, e);
    }
  }

  isFfmpegLoading = false;
  throw new Error(`ไม่สามารถโหลดเอนจิน FFmpeg WASM ได้: ${lastError?.message || 'Network error'}`);
}

/**
 * Transcodes any video Blob into a 100% compliant Shopee Video & TikTok MP4:
 * - Video Codec: H.264 (libx264) Main Profile Level 3.1
 * - Pixel Format: yuv420p
 * - Frame Rate: 30 FPS Constant (CFR)
 * - Audio Codec: AAC Stereo 48,000 Hz (128 kbps)
 * - Flags: -movflags +faststart (Moov Atom at start of file)
 * - Output MIME: video/mp4
 */
export async function transcodeToShopeeCompliantMp4(
  inputBlob: Blob,
  onProgress?: (percent: number, status: string) => void
): Promise<Blob> {
  onProgress?.(91, 'กำลังเตรียม FFmpeg WASM Transcoder (Shopee Video & TikTok Standard)...');

  const ffmpeg = await getFFmpeg((ratio, msg) => {
    const p = Math.min(99, Math.max(91, 91 + Math.round(ratio * 0.08)));
    onProgress?.(p, msg);
  });

  const isWebm = inputBlob.type.includes('webm') || !(await isPureMp4Container(inputBlob));
  const inputName = `input_${Date.now()}${isWebm ? '.webm' : '.mp4'}`;
  const outputName = `shopee_output_${Date.now()}.mp4`;

  await ffmpeg.writeFile(inputName, await fetchFile(inputBlob));

  onProgress?.(93, 'กำลังเข้ารหัสวิดีโอ H.264 (libx264 Main) + เสียง AAC 48kHz...');

  // Strict Shopee Video & TikTok Command:
  // ffmpeg -i input.webm -c:v libx264 -pix_fmt yuv420p -profile:v main -level 3.1 -movflags +faststart -c:a aac -b:a 128k output.mp4
  await ffmpeg.exec([
    '-i', inputName,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'main',
    '-level', '3.1',
    '-preset', 'ultrafast',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-movflags', '+faststart',
    outputName,
  ]);

  const outputData = await ffmpeg.readFile(outputName);

  // Clean virtual file system
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch {}

  const outputBytes = typeof outputData === 'string'
    ? new TextEncoder().encode(outputData)
    : new Uint8Array(outputData);

  const finalMp4Blob = new Blob([outputBytes.slice().buffer], { type: 'video/mp4' });
  return finalMp4Blob;
}
