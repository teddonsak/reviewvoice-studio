import React from 'react';
import { FolderClock, Video, Trash2, RotateCcw, Play, Clock, ArrowRight, Share2 } from 'lucide-react';
import { ProjectData } from '../types';
import { formatExpiresCountdown } from '../services/webClipStorage';

interface ProjectHistoryProps {
  projects: ProjectData[];
  onOpenProject: (project: ProjectData) => void;
  onDeleteProject: (id: string) => void;
  onStartNew: () => void;
}

export const ProjectHistory: React.FC<ProjectHistoryProps> = ({
  projects,
  onOpenProject,
  onDeleteProject,
  onStartNew,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <FolderClock className="w-6 h-6 text-indigo-400" />
            <span>ประวัติโปรเจกต์ที่บันทึกไว้ (Project History)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            รายการโปรเจกต์คลิปรีวิวสินค้าที่คุณเคยสร้าง สามารถเปิดแก้ไขหรือทำคลิปใหม่ต่อได้ทันที
          </p>
        </div>

        <button
          onClick={onStartNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20 transition-all self-start sm:self-auto"
        >
          <Video className="w-4 h-4" />
          <span>สร้างโปรเจกต์ใหม่</span>
        </button>
      </div>

      {/* Projects Grid or Empty State */}
      {projects.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
            <FolderClock className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold font-kanit text-white">
            ยังไม่มีประวัติโปรเจกต์
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            เมื่อคุณเริ่มสร้างคลิปและบันทึกงาน ระบบจะแสดงประวัติโปรเจกต์ทั้งหมดที่นี่
          </p>
          <button
            onClick={onStartNew}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all"
          >
            เริ่มสร้างคลิปแรกของคุณเลย
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <div
              key={project.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/40 transition-all flex flex-col justify-between space-y-4 shadow-xl group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-300 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30">
                    {project.status === 'rendered' ? '✓ เรนเดอร์แล้ว' : 'ฉบับร่าง'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(project.updatedAt || project.createdAt).toLocaleDateString('th-TH')}
                  </span>
                </div>

                <h4 className="text-base font-bold text-white group-hover:text-indigo-200 transition-colors line-clamp-1">
                  {project.title || 'โปรเจกต์รีวิว'}
                </h4>

                <p className="text-xs text-slate-300 line-clamp-2">
                  {project.productAnalysis.productName || 'สินค้า'} - {project.productAnalysis.painPoint}
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>ความยาว: {Math.round(project.audioDuration || project.videoDuration || 0)}s</span>
                  </div>
                  <div>
                    <span>เสียง: {project.voiceSettings.provider.toUpperCase()}</span>
                  </div>
                </div>
                {(project as any).shareUrl && (
                  <div className="p-2.5 rounded-xl bg-violet-950/30 border border-violet-500/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-300">
                      <Share2 className="w-3 h-3" /> ลิงก์เว็บบนคลาวด์
                    </div>
                    <a href={(project as any).shareUrl} target="_blank" rel="noreferrer" className="block text-[11px] text-cyan-400 hover:text-cyan-300 truncate">{(project as any).shareUrl}</a>
                    <div className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-block">
                      {(project as any).shareExpiresAt ? formatExpiresCountdown((project as any).shareExpiresAt) : 'ลบอัตโนมัติใน 3 วัน'}
                    </div>
                  </div>
                )}
                {(project as any).shareExpiresAt && !(project as any).shareUrl && (
                  <div className="text-[10px] px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 inline-block">
                    {formatExpiresCountdown((project as any).shareExpiresAt)} • ลบอัตโนมัติหลังครบ 3 วัน
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onDeleteProject(project.id)}
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="ลบโปรเจกต์"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenProject(project)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20 transition-all"
                >
                  <span>เปิดโปรเจกต์</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
