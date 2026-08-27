import React from 'react';
import { 
  Sparkles, 
  Video, 
  ArrowRight, 
  Zap, 
  Volume2, 
  Subtitles, 
  UploadCloud, 
  CheckCircle2, 
  Play, 
  Star, 
  TrendingUp, 
  ShieldCheck, 
  Layers,
  Flame,
  Clock
} from 'lucide-react';
import { SAMPLE_TEMPLATES } from '../services/scriptGenerator';
import { ProjectData } from '../types';

interface DashboardProps {
  onStartNewProject: () => void;
  onOpenFastMode: () => void;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
  onLoadTemplate: (templateId: string) => void;
  recentProjects: ProjectData[];
  onOpenProject: (project: ProjectData) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewProject,
  onOpenFastMode,
  onOpenTemplates,
  onOpenSettings,
  onLoadTemplate,
  recentProjects,
  onOpenProject,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-7 sm:space-y-12">
      
      {/* 1. Hero Section */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-b from-indigo-950/60 via-slate-900/90 to-slate-950 border border-indigo-500/20 p-5 sm:p-12 lg:p-16 shadow-2xl">
        
        {/* Glowing background circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>ReviewVoice Studio 1.0 • เพื่อครีเอเตอร์สายรีวิวชาวไทยโดยเฉพาะ</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-kanit tracking-tight text-white leading-tight">
            เปลี่ยนวิดีโอสินค้าเป็นคลิปรีวิว <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
              พร้อมเสียงพากย์ไทยในไม่กี่นาที
            </span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            อัปโหลดวิดีโอสินค้า → AI วิเคราะห์จุดขาย → เขียนบท Hook ถึง CTA → แปลงคำอ่านไทยสำหรับ TTS → ใส่ซับคาราโอเกะและเรนเดอร์คลิปพร้อมโพสต์ TikTok, Reels, Shorts ทันที
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            
            <button
              onClick={onStartNewProject}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5"
            >
              <Video className="w-5 h-5" />
              <span>เริ่มสร้างคลิปรีวิว</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={onOpenFastMode}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-semibold text-base text-amber-300 bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400/60 shadow-lg transition-all"
            >
              <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
              <span>โหมดเร็ว 1-Click</span>
            </button>

          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-800/80 text-xs text-slate-300">
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>แยกสคริปต์ TTS/ซับ</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>PD / MiniMax / 11Labs</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>ซับคาราโอเกะวิ่งตามคำ</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>ลบเสียงเดิม รวมเสร็จในตัว</span>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Visual 5-Step Process */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white">
            โฟลว์การทำงานอัตโนมัติ 5 ขั้นตอน
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            ใช้งานง่าย เพียงทำตามขั้นตอน Wizard ทีละขั้นอย่างเป็นมืออาชีพ
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Step 1 */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
              01
            </div>
            <h3 className="font-kanit font-semibold text-white text-sm">
              อัปโหลดวิดีโอสินค้า
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              รองรับ MP4, MOV, WebM แนวนอนหรือแนวตั้ง 1080x1920 พรีวิวได้ทันที
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/30 flex items-center justify-center font-bold text-sm">
              02
            </div>
            <h3 className="font-kanit font-semibold text-white text-sm">
              วิเคราะห์สินค้า AI
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              สกัดชื่อสินค้า Pain Point, 3 ฟีเจอร์เด่น, กลุ่มเป้าหมาย และ USP อย่างแม่นยำ
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/30 flex items-center justify-center font-bold text-sm">
              03
            </div>
            <h3 className="font-kanit font-semibold text-white text-sm">
              เขียนบท & แยกสคริปต์
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              โครงสร้าง Hook ถึง CTA พร้อมแยกสคริปต์ TTS ไทยล้วน และสคริปต์ซับสวยงาม
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-sm">
              04
            </div>
            <h3 className="font-kanit font-semibold text-white text-sm">
              เลือกเสียงพากย์ TTS
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              เลือก PD Clone Voice / MiniMax / ElevenLabs ปรับสปีด 1.22x เสียงสดใส
            </p>
          </div>

          {/* Step 5 */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
              05
            </div>
            <h3 className="font-kanit font-semibold text-white text-sm">
              ซับคาราโอเกะ & โหลดคลิป
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              เรนเดอร์รวมคลิป ลบเสียงเดิม ฝังซับวิ่ง และดาวน์โหลด MP4/WAV/ASS ทันที
            </p>
          </div>

        </div>
      </div>

      {/* 3. Before / After Showcase Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl">
        <div className="lg:col-span-4 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ผลลัพธ์ที่เปลี่ยนไปอย่างชัดเจน</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-kanit text-white">
            เปรียบเทียบ Before vs After
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            เปลี่ยนจากคลิปสินค้าเงียบๆ หรือเสียงต่างประเทศที่คนไทยเลื่อนผ่าน ให้กลายเป็นคลิปรีวิวสุดโปรที่ปิดการขายได้จริง
          </p>
          <button
            onClick={onStartNewProject}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md"
          >
            <span>ลองสร้างด้วยวิดีโอของคุณ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Before */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-rose-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30">
                ✕ ก่อนใช้ (Before)
              </span>
              <span className="text-[11px] text-slate-400">คลิปทั่วไป</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-rose-400 mt-0.5">✕</span>
                <span>มีแต่ภาพหมุนสินค้า ไม่มีเสียงพากย์ดึงดูดใจ</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 mt-0.5">✕</span>
                <span>ต้องมานั่งพิมพ์บทเอง เสียเวลาเป็นชั่วโมง</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 mt-0.5">✕</span>
                <span>เสียงบอทอ่านภาษาอังกฤษผิดๆ ถูกๆ ฟังสะดุด</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 mt-0.5">✕</span>
                <span>ไม่มีซับไตเติ้ล คนดูเลื่อนผ่านไม่รู้จุดเด่น</span>
              </li>
            </ul>
          </div>

          {/* After */}
          <div className="p-5 rounded-2xl bg-indigo-950/30 border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                ✓ หลังใช้ ReviewVoice Studio
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">พร้อมลง TikTok</span>
            </div>
            <ul className="text-xs text-slate-200 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>เสียงพากย์หญิงไทยสดใส สปีด 1.22x ชวนฟัง</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>โครงสร้างบทมืออาชีพ Hook แรง กระตุ้นกดสั่ง</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>แยกคำอ่านแบรนด์ไทยล้วน เสียงอ่านสมบูรณ์</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>ซับคาราโอเกะไฮไลต์ทีละคำ ดึงดูดสายตา 100%</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 4. Ready-made Templates Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-bold font-kanit text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              เทมเพลตบทรีวิวยอดนิยม (พร้อมใช้ใน 1 คลิก)
            </h3>
            <p className="text-xs text-slate-400">
              เลือกตามหมวดหมู่สินค้าของคุณเพื่อเริ่มต้นอย่างรวดเร็ว
            </p>
          </div>
          <button
            onClick={onOpenTemplates}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            ดูทั้งหมด →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SAMPLE_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => onLoadTemplate(tmpl.id)}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 cursor-pointer transition-all space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-300 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/30">
                  {tmpl.category}
                </span>
                <span className="text-xs text-slate-500 group-hover:text-indigo-400 transition-colors">
                  เลือกใช้ →
                </span>
              </div>

              <h4 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">
                {tmpl.name}
              </h4>

              <p className="text-xs text-slate-400 line-clamp-2">
                {tmpl.sampleHook}
              </p>

              <div className="text-[11px] text-emerald-400 pt-2 border-t border-slate-800/80">
                ✓ ฟีเจอร์ครบ + USP ตรงกลุ่ม
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Recent Saved Projects */}
      {recentProjects.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-kanit text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              โปรเจกต์ล่าสุดของคุณ
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recentProjects.slice(0, 3).map((p) => (
              <div
                key={p.id}
                onClick={() => onOpenProject(p)}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/50 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate max-w-[180px]">
                    {p.title || 'โปรเจกต์รีวิว'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {p.productAnalysis.productName || 'สินค้า'}
                </p>
                <div className="text-[11px] text-slate-500">
                  แก้ไขล่าสุด: {new Date(p.updatedAt).toLocaleDateString('th-TH')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
