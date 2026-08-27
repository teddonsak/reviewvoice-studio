/**
 * Video Keyframe Extractor
 * Extracts representative snapshot frames from an HTML5 video object or video URL
 * for multimodal Vision AI analysis (Gemini / GPT-4o / Claude).
 */

export interface ExtractedFrame {
  timestamp: number;
  dataUrl: string; // data:image/jpeg;base64,...
  base64: string;  // raw base64 without prefix
}

/**
 * Extracts N evenly spaced lightweight keyframes from a video file/URL
 */
export async function extractVideoKeyframes(
  videoSource: string | File,
  frameCount: number = 4
): Promise<ExtractedFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = typeof videoSource === 'string' ? videoSource : URL.createObjectURL(videoSource);
    
    // Only set crossOrigin if external http/https URL (not blob: or data:)
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      video.crossOrigin = 'anonymous';
    }
    
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;

    const timeoutId = setTimeout(() => {
      reject(new Error('หมดเวลาโหลดวิดีโอเพื่อสกัดภาพ'));
    }, 8000);

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration && !isNaN(video.duration) ? video.duration : 10;
        // Optimize width & height to 400px max for ultra-fast payload transfer (< 25KB per frame)
        const width = Math.min(video.videoWidth || 400, 400);
        const height = video.videoHeight && video.videoWidth 
          ? Math.round((video.videoHeight / video.videoWidth) * width) 
          : 600;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) {
          throw new Error('ไม่สามารถสร้าง Canvas Context สำหรับดึงเฟรมวิดีโอได้');
        }

        const frames: ExtractedFrame[] = [];
        
        // Calculate timestamp intervals (e.g. 15%, 35%, 60%, 85% of duration)
        const timestamps: number[] = [];
        for (let i = 1; i <= frameCount; i++) {
          const ratio = (i - 0.5) / frameCount;
          timestamps.push(Number((ratio * duration).toFixed(2)));
        }

        for (const time of timestamps) {
          await seekVideoTo(video, time);
          ctx.drawImage(video, 0, 0, width, height);
          
          // Ultra-lightweight JPEG compression 0.65 for speed
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

          frames.push({
            timestamp: time,
            dataUrl,
            base64
          });
        }

        clearTimeout(timeoutId);
        resolve(frames);
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    };

    video.onerror = (e) => {
      clearTimeout(timeoutId);
      console.warn('Video element error in extractVideoKeyframes:', e);
      reject(new Error('ไม่สามารถโหลดวิดีโอเพื่อดึงเฟรมภาพได้'));
    };
  });
}

function seekVideoTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }
    };

    const onSeeked = () => {
      cleanup();
    };

    // Fast safety timeout in case seeked event is delayed
    setTimeout(cleanup, 800);

    video.addEventListener('seeked', onSeeked, { once: true });
    try {
      video.currentTime = Math.max(0.1, Math.min(time, (video.duration || 10) - 0.1));
    } catch {
      cleanup();
    }
  });
}
