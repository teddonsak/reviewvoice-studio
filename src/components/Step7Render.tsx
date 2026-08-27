import React, { useState } from 'react';
import { 
  Film, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  Volume2, 
  FileText, 
  Share2, 
  FolderCheck, 
  RotateCcw, 
  Play, 
  Check, 
  Layers,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProjectData } from '../types';
import { renderFinalVideo } from '../services/videoRenderer';
import { saveProjectToStorage } from '../services/storageService';
import { generateSubtitleSegments } from '../services/thaiConverter';
import { generateSynthesizedSpeech } from '../services/ttsService';
import { uploadClipToWeb, formatExpiresCountdown } from '../services/webClipStorage';

interface Step7RenderProps {
  project: ProjectData;
  onUpdateProject: (updates: Partial<ProjectData>) => void;
  onPrev: () => void;
  onRestart: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const Step7Render: React.FC<Step7RenderProps> = ({
  project,
  onUpdateProject,
  onPrev,
  onRestart,
  onNotify,
}) => {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatusText, setRenderStatusText] = useState('');
  const [assSubtitles, setAssSubtitles] = useState('');
  const [srtSubtitles, setSrtSubtitles] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | undefined>(project.shareUrl);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | undefined>(project.shareExpiresAt);

  const handleStartRender = async () => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // Ensure we have audio
      let audioBlob = project.audioBlob;
      let timings = project.wordTimings;

      if (!audioBlob) {
        setRenderStatusText('กำลังเตรียมเสียงพากย์...');
        const ttsText = project.dualScript.ttsScript || project.reviewScript.fullText;
        const synth = await generateSynthesizedSpeech(ttsText, project.voiceSettings.speed || 1.22);
        audioBlob = synth.audioBlob;
        timings = synth.wordTimings;
        onUpdateProject({
          audioBlob: synth.audioBlob,
          generatedAudioUrl: synth.audioUrl,
          audioDuration: synth.duration,
          wordTimings: synth.wordTimings,
        });
      }

      if (!timings || timings.length === 0) {
        timings = generateSubtitleSegments(
          project.dualScript.subtitleScript || project.reviewScript.fullText,
          project.audioDuration || project.videoDuration || 12
        );
      }

      // Render video on canvas + MediaRecorder with muted original audio
      const result = await renderFinalVideo(
        project.videoUrl,
        audioBlob,
        timings,
        project.subtitleSettings,
        (percent, message) => {
          setRenderProgress(percent);
          setRenderStatusText(message);
        }
      );

      onUpdateProject({
        renderedVideoUrl: result.videoUrl,
        renderedVideoBlob: result.videoBlob,
        status: 'rendered'
      });

      setAssSubtitles(result.assSubtitleContent);
      setSrtSubtitles(result.srtSubtitleContent);
      setIsRendering(false);

      // Trigger Celebration Confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}

      // Auto save project
      saveProjectToStorage({
        ...project,
        renderedVideoUrl: result.videoUrl,
        status: 'rendered'
      });
      setIsSaved(true);

      onNotify('success', 'เรนเดอร์คลิปสำเร็จ 100%!', 'วิดีโอรีวิวพร้อมเสียงพากย์และซับคาราโอเกะพร้อมให้ดาวน์โหลดแล้ว');

    } catch (err: any) {
      setIsRendering(false);
      console.error(err);
      onNotify('error', 'การเรนเดอร์ล้มเหลว', err.message || 'กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleDownloadVideo = () => {
    if (!project.renderedVideoUrl) return;
    // บังคับดาวน์โหลดเป็น .mp4 เสมอตามที่ผู้ใช้ต้องการ (เรนเดอร์ตอนนี้บังคับ mime เป็น video/mp4 แล้ว)
    const fileName = `${project.title || 'review_video'}_final.mp4`;
    const a = document.createElement('a');
    a.href = project.renderedVideoUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onNotify('success', 'เริ่มดาวน์โหลดวิดีโอ', `${fileName} (MP4 H.264/AAC พร้อมโพสต์ TikTok/Reels)`);
  };

  const handleDownloadAudio = () => {
    if (!project.generatedAudioUrl) return;
    const a = document.createElement('a');
    a.href = project.generatedAudioUrl;
    a.download = `${project.title || 'voiceover'}_audio.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onNotify('success', 'ดาวน์โหลดไฟล์เสียง WAV สำเร็จ');
  };

  const handleDownloadAss = () => {
    if (!assSubtitles) return;
    const blob = new Blob([assSubtitles], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title || 'subtitles'}_karaoke.ass`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onNotify('success', 'ดาวน์โหลดไฟล์ซับ .ass (Karaoke) สำเร็จ');
  };

  const handleDownloadSrt = () => {
    if (!srtSubtitles) return;
    const blob = new Blob([srtSubtitles], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title || 'subtitles'}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onNotify('success', 'ดาวน์โหลดไฟล์ซับ .srt สำเร็จ');
  };

  const handleSaveProject = () => {
    saveProjectToStorage(project);
    setIsSaved(true);
    onNotify('success', 'บันทึกโปรเจกต์ลงประวัติแล้ว', 'สามารถเปิดดูและแก้ไขใหม่ได้ตลอดเวลาจากเมนู ประวัติงาน');
  };

  const handleShareWeb = async () => {
    if (!project.renderedVideoBlob) {
      onNotify('error', 'ยังไม่มีไฟล์วิดีโอ', 'กรุณาเรนเดอร์คลิปก่อน');
      return;
    }
    setIsSharing(true);
    try {
      const fileName = `${(project.title || 'review_video').replace(/\s+/g, '_')}_final.mp4`;
      const result = await uploadClipToWeb(project.renderedVideoBlob, fileName);
      const updates = { shareUrl: result.url, shareExpiresAt: result.expiresAt, webExpiresAt: result.expiresAt } as Partial<ProjectData>;
      onUpdateProject(updates);
      saveProjectToStorage({ ...project, ...updates } as ProjectData);
      setShareUrl(result.url);
      setShareExpiresAt(result.expiresAt);
      onNotify('success', 'อัปโหลดขึ้นเว็บสำเร็จ!', `ลิงก์จะอยู่ 3 วันแล้วลบอัตโนมัติ: ${result.url}`);
    } catch (err: any) {
      onNotify('error', 'อัปโหลดไม่สำเร็จ', err.message || 'ลองใหม่หรือเช็คขนาดไฟล์');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              7
            </span>
            Step 7: รวมคลิป + ดาวน์โหลด (Render & Export)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            รวมวิดีโอ ลบเสียงต้นฉบับ ประกบเสียงพากย์ไทยใหม่ และฝังซับไตเติ้ลคาราโอเกะพร้อมใช้งาน
          </p>
        </div>

        {!project.renderedVideoUrl && (
          <button
            type="button"
            onClick={handleStartRender}
            disabled={isRendering}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-xl shadow-emerald-500/25 transition-all self-start sm:self-auto disabled:opacity-50"
          >
            {isRendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังเรนเดอร์คลิป ({renderProgress}%)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>เริ่มเรนเดอร์คลิปสุดท้าย</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Rendering State Progress Bar */}
      {isRendering && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-indigo-500/40 shadow-2xl space-y-4 text-center animate-pulse-glow">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 mx-auto flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>

          <div>
            <h3 className="text-base font-bold font-kanit text-white">
              กำลังประมวลผลคลิปรีวิวของคุณ... ({renderProgress}%)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {renderStatusText || 'กำลังรวมภาพ เสียงพากย์ และซับไตเติ้ลคาราโอเกะ...'}
            </p>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800 overflow-hidden max-w-lg mx-auto">
            <div
              className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-md"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Rendered Result Showcase */}
      {project.renderedVideoUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/70 border border-emerald-500/40 rounded-2xl p-5 sm:p-7 shadow-2xl">
          
          {/* Left: Final Video Player */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-950/90 rounded-xl p-4 border border-slate-800/80">
            <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-xl overflow-hidden bg-black shadow-2xl border border-slate-700">
              <video
                src={project.renderedVideoUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mt-3">
              <CheckCircle2 className="w-4 h-4" />
              <span>คลิปวิดีโอฉบับสมบูรณ์พร้อมโพสต์</span>
            </div>
          </div>

          {/* Right: Export & Download Action Center */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  ✓ สำเร็จ 100%
                </span>
                <span className="text-xs text-slate-400 font-mono">1080x1920 MP4</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold font-kanit text-white">
                {project.title || 'วิดีโอรีวิวสินค้า'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                คลิปนี้ตัดเสียงเดิมออกแล้ว ผสานเสียงพากย์ภาษาไทยสปีด {project.voiceSettings.speed}x และซับคาราโอเกะที่ซิงค์ตามคำพูดอย่างแม่นยำ พร้อมอัปโหลดลง TikTok, Facebook Reels, YouTube Shorts ได้ทันที!
              </p>

              {/* Main Download + Share */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
                >
                  <Download className="w-5 h-5" />
                  <span>ดาวน์โหลดวิดีโอคลิป (MP4)</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareWeb}
                  disabled={isSharing}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 disabled:opacity-50 border border-violet-500/30"
                >
                  {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  <span>{isSharing ? 'กำลังอัปโหลด...' : 'เก็บไว้บนเว็บ 3 วัน'}</span>
                </button>
              </div>
              {shareUrl && (
                <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-300">ลิงก์แชร์ (ลบอัตโนมัติใน 3 วัน)</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">{shareExpiresAt ? formatExpiresCountdown(shareExpiresAt) : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input readOnly value={shareUrl} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
                    <button type="button" onClick={() => { navigator.clipboard.writeText(shareUrl); onNotify('success','คัดลอกลิงก์แล้ว','ส่งให้ทีมได้เลย'); }} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs">คัดลอก</button>
                  </div>
                </div>
              )}
            </div>

            {/* Individual Asset Export */}
            <div className="border-t border-slate-800/80 pt-4 space-y-3">
              <span className="text-xs font-semibold text-slate-300">
                หรือส่งออกแยกเฉพาะไฟล์ (Asset Exports):
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadAudio}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>เสียงพากย์ (.wav)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAss}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>ซับคาราโอเกะ (.ass)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSrt}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ซับไตเติ้ล (.srt)</span>
                </button>
              </div>
            </div>

            {/* Save & Reset Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
              <button
                type="button"
                onClick={handleSaveProject}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : <FolderCheck className="w-4 h-4 text-indigo-400" />}
                <span>{isSaved ? 'บันทึกโปรเจกต์แล้ว' : 'บันทึกลงประวัติโปรเจกต์'}</span>
              </button>

              <button
                type="button"
                onClick={onRestart}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/60 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>สร้างคลิปใหม่ถัดไป</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* If not rendered yet, show quick checklist preview */}
      {!project.renderedVideoUrl && !isRendering && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white font-kanit">
            สรุปการตั้งค่าสำหรับคลิปนี้ก่อนเรนเดอร์:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">วิดีโอต้นฉบับ:</span>
              <span className="font-semibold text-white truncate block">{project.videoFileName || 'video.mp4'}</span>
              <span className="text-[11px] text-rose-400 mt-1 block">✓ ลบเสียงเดิมออก</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">เสียงพากย์ AI:</span>
              <span className="font-semibold text-white block">{project.voiceSettings.provider.toUpperCase()} ({project.voiceSettings.speed}x)</span>
              <span className="text-[11px] text-emerald-400 mt-1 block">✓ สคริปต์ไทยล้วน</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">ซับไตเติ้ล:</span>
              <span className="font-semibold text-white block">{project.subtitleSettings.fontFamily} {project.subtitleSettings.fontSize}px</span>
              <span className="text-[11px] text-amber-400 mt-1 block">✓ คาราโอเกะไฮไลต์</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">ความยาวคลิป:</span>
              <span className="font-semibold text-white block">~{Math.round(project.audioDuration || project.videoDuration || 12)} วินาที</span>
              <span className="text-[11px] text-cyan-400 mt-1 block">✓ พอดี TikTok/Reels</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onPrev}
          className="px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
        >
          ← ย้อนกลับ
        </button>
      </div>

    </div>
  );
};
