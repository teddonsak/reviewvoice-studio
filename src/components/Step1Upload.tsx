import React, { useRef, useState } from 'react';
import { 
  UploadCloud, 
  Film, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Maximize2, 
  HardDrive, 
  Play, 
  RotateCcw,
  Video
} from 'lucide-react';
import { ProjectData } from '../types';

interface Step1UploadProps {
  project: ProjectData;
  onUpdateProject: (updates: Partial<ProjectData>) => void;
  onNext: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const Step1Upload: React.FC<Step1UploadProps> = ({
  project,
  onUpdateProject,
  onNext,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCreatingSample, setIsCreatingSample] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.includes('video') && !file.name.match(/\.(mp4|mov|webm|mkv)$/i)) {
      onNotify('error', 'ไฟล์ไม่ถูกต้อง', 'กรุณาอัปโหลดไฟล์วิดีโอ (MP4, MOV, WebM)');
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      onUpdateProject({
        videoUrl: url,
        videoBlob: file,
        videoFileName: file.name,
        videoDuration: video.duration,
        videoWidth: video.videoWidth || 1080,
        videoHeight: video.videoHeight || 1920,
        title: file.name.replace(/\.[^/.]+$/, ''),
      });
      onNotify('success', 'อัปโหลดวิดีโอสำเร็จ', `${file.name} (${video.videoWidth}x${video.videoHeight}, ${Math.round(video.duration)} วินาที)`);
    };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  /**
   * Generates a realistic high-definition vertical 1080x1920 sample product video clip
   * with animated gradients and product mockup banner for immediate testing!
   */
  const handleUseSampleVideo = (category: string, title: string) => {
    setIsCreatingSample(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const sampleUrl = URL.createObjectURL(blob);
        onUpdateProject({
          videoUrl: sampleUrl,
          videoBlob: blob,
          videoFileName: `sample_${category}.webm`,
          videoDuration: 12,
          videoWidth: 1080,
          videoHeight: 1920,
          title: `วิดีโอตัวอย่าง: ${title}`,
        });
        setIsCreatingSample(false);
        onNotify('success', 'โหลดวิดีโอตัวอย่างสำเร็จ!', `พร้อมใช้งานวิดีโอแนวตั้ง 1080x1920 (${category})`);
      };

      recorder.start();

      let frame = 0;
      const totalFrames = 30 * 12; // 12 seconds

      function renderFrame() {
        if (frame >= totalFrames) {
          recorder.stop();
          return;
        }

        const t = frame / 30;
        
        // Background Gradient animation
        const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
        if (category === 'skincare') {
          grad.addColorStop(0, '#fda4af');
          grad.addColorStop(0.5, '#f43f5e');
          grad.addColorStop(1, '#881337');
        } else if (category === 'collagen') {
          grad.addColorStop(0, '#f472b6');
          grad.addColorStop(0.5, '#c084fc');
          grad.addColorStop(1, '#4c1d95');
        } else if (category === 'tech') {
          grad.addColorStop(0, '#38bdf8');
          grad.addColorStop(0.5, '#4f46e5');
          grad.addColorStop(1, '#0f172a');
        } else {
          grad.addColorStop(0, '#34d399');
          grad.addColorStop(0.5, '#059669');
          grad.addColorStop(1, '#064e3b');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1920);

        // Animated particles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        for (let i = 0; i < 20; i++) {
          const px = ((i * 137 + t * 40) % 1080);
          const py = ((i * 223 + t * 60) % 1920);
          const radius = (i % 5 + 3) * 6;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Product Mockup Card in Center
        ctx.save();
        ctx.translate(540, 960 + Math.sin(t * 2) * 20);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 40;
        ctx.beginPath();
        ctx.roundRect(-360, -480, 720, 960, 48);
        ctx.fill();

        // Inner artwork
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 56px Kanit, Prompt, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, 0, -200);

        ctx.fillStyle = '#64748b';
        ctx.font = '36px Prompt, sans-serif';
        ctx.fillText('PRODUCT SHOWCASE 4K', 0, -130);

        // Center Product Graphic
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(0, 80, 140, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 84px Prompt, sans-serif';
        ctx.fillText('★ 100%', 0, 110);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 44px Prompt, sans-serif';
        ctx.fillText('✓ การันตีของแท้ 100%', 0, 320);

        ctx.restore();

        frame++;
        requestAnimationFrame(renderFrame);
      }

      renderFrame();
    } catch (err) {
      console.error(err);
      setIsCreatingSample(false);
      onNotify('error', 'ไม่สามารถสร้างวิดีโอตัวอย่างได้', 'กรุณาอัปโหลดไฟล์วิดีโอจริง');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              1
            </span>
            Step 1: อัปโหลดวิดีโอสินค้า
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            ลากและวางไฟล์วิดีโอสินค้าต้นฉบับ รองรับ MP4, MOV, WebM (แนะนำขนาดแนวตั้ง 1080x1920 สำหรับ TikTok/Reels)
          </p>
        </div>

        {project.videoUrl && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 self-start transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>เปลี่ยนวิดีโอ</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
      />

      {/* Main Drag & Drop Zone or Video Preview */}
      {!project.videoUrl ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/30 scale-[1.01]'
              : 'border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/40 hover:bg-slate-900/70'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/10">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold font-kanit text-white">
            คลิกเพื่อเลือกไฟล์วิดีโอ หรือลากไฟล์มาวางที่นี่
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
            รองรับวิดีโอความยาว 5 - 120 วินาที ระบบจะดึงภาพมาวิเคราะห์และพากย์เสียงใหม่ให้อัตโนมัติ
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-slate-400">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60">MP4</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60">MOV</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60">WebM</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60">9:16 Vertical</span>
          </div>
        </div>
      ) : (
        /* Video Preview Card */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          
          {/* Left: Video Player */}
          <div className="lg:col-span-5 flex justify-center bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
            <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-lg overflow-hidden bg-black shadow-2xl">
              <video
                src={project.videoUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Right: Video Metadata & Quick Insights */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>วิดีโอต้นฉบับพร้อมใช้งาน</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-kanit text-white">
                {project.videoFileName || 'video_clip.mp4'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                ระบบตรวจพบความละเอียดและพร้อมสำหรับการตัดเสียงเดิมเพื่อใส่เสียงพากย์รีวิวภาษาไทย
              </p>

              {/* Stats Chips */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ความยาว</span>
                  </div>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {Math.round(project.videoDuration || 0)} วินาที
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>ความละเอียด</span>
                  </div>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {project.videoWidth}x{project.videoHeight}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <HardDrive className="w-3.5 h-3.5 text-violet-400" />
                    <span>สัดส่วนภาพ</span>
                  </div>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {project.videoHeight > project.videoWidth ? '9:16 แนวตั้ง' : '16:9 แนวนอน'}
                  </span>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-300">
              <span className="font-semibold text-indigo-300">ข้อกำหนดทางเทคนิค:</span> ในขั้นตอนสุดท้าย ระบบจะทำการลบเสียงเดิมของคลิปออก และรวมเข้ากับเสียงพากย์ไทยพร้อมซับคาราโอเกะแบบไร้รอยต่อ
            </div>
          </div>

        </div>
      )}

      {/* Preset Sample Videos */}
      <div className="border-t border-slate-800/80 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">
            หรือเลือกใช้วิดีโอตัวอย่างสินค้า (ทดสอบได้ทันทีใน 1 คลิก):
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            disabled={isCreatingSample}
            onClick={() => handleUseSampleVideo('skincare', 'Glow Vit-C 10% Serum')}
            className="flex flex-col items-start p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800/50 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-white group-hover:text-rose-300">
              🧴 เซรั่มวิตซี ผิวใส
            </span>
            <span className="text-[11px] text-slate-400 mt-1">สกินแคร์ / 1080x1920</span>
          </button>

          <button
            type="button"
            disabled={isCreatingSample}
            onClick={() => handleUseSampleVideo('collagen', 'Marine Collagen 5000mg')}
            className="flex flex-col items-start p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-pink-500/50 hover:bg-slate-800/50 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-white group-hover:text-pink-300">
              🍷 คอลลาเจนชงดื่ม
            </span>
            <span className="text-[11px] text-slate-400 mt-1">อาหารเสริม / 1080x1920</span>
          </button>

          <button
            type="button"
            disabled={isCreatingSample}
            onClick={() => handleUseSampleVideo('tech', 'MagCharge Pro 10000mAh')}
            className="flex flex-col items-start p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-white group-hover:text-indigo-300">
              🔋 พาวเวอร์แบงก์ไร้สาย
            </span>
            <span className="text-[11px] text-slate-400 mt-1">สินค้าไอที / 1080x1920</span>
          </button>

          <button
            type="button"
            disabled={isCreatingSample}
            onClick={() => handleUseSampleVideo('general', 'Organic Wet Wipes')}
            className="flex flex-col items-start p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/50 text-left transition-all group disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-white group-hover:text-emerald-300">
              👶 ทิชชู่เปียกสูตรน้ำแร่
            </span>
            <span className="text-[11px] text-slate-400 mt-1">แม่และเด็ก / 1080x1920</span>
          </button>
        </div>
      </div>

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-end pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onNext}
          disabled={!project.videoUrl}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 transition-all"
        >
          <span>ถัดไป: วิเคราะห์สินค้า</span>
          <span className="font-bold">→</span>
        </button>
      </div>

    </div>
  );
};
