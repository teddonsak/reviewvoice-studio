import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Clock, 
  FileText, 
  CheckCircle2, 
  HelpCircle, 
  Volume2, 
  Wand2, 
  RotateCcw,
  Layers
} from 'lucide-react';
import { ProjectData, ReviewScript } from '../types';
import { generateReviewScript, buildDualScripts } from '../services/scriptGenerator';

interface Step3ScriptProps {
  project: ProjectData;
  onUpdateProject: (updates: Partial<ProjectData>) => void;
  onNext: () => void;
  onPrev: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const Step3Script: React.FC<Step3ScriptProps> = ({
  project,
  onUpdateProject,
  onNext,
  onPrev,
  onNotify,
}) => {
  const [tone, setTone] = useState<'cheerful' | 'friendly' | 'confident' | 'energetic'>(
    project.voiceSettings.tone || 'cheerful'
  );
  const [gender, setGender] = useState<'female' | 'male'>(project.voiceSettings.gender || 'female');
  const [script, setScript] = useState<ReviewScript>(project.reviewScript);

  const handleGenerateScript = (selectedTone = tone) => {
    const generated = generateReviewScript(project.productAnalysis, selectedTone, gender);
    setScript(generated);
    const dual = buildDualScripts(generated);

    onUpdateProject({
      reviewScript: generated,
      dualScript: dual,
      voiceSettings: {
        ...project.voiceSettings,
        tone: selectedTone,
        gender
      },
      status: 'scripted'
    });

    onNotify('success', 'สร้างบทรีวิวอัตโนมัติสำเร็จ!', `ความยาวประมาณ ${generated.estimatedDurationSeconds} วินาที (${generated.wordCount} คำ) โครงสร้าง Hook-CTA ครบถ้วน`);
  };

  const handleSectionChange = (section: keyof ReviewScript, value: string) => {
    const updated = { ...script, [section]: value };
    const full = `${updated.hook} ${updated.problem} ${updated.solution} ${updated.proof} ${updated.cta}`.trim();
    const words = full.split(/[\s,]+/).filter(w => w.length > 0);
    
    updated.fullText = full;
    updated.wordCount = words.length;
    updated.estimatedDurationSeconds = Math.max(8, Math.round(words.length / 2.8));

    setScript(updated);
    const dual = buildDualScripts(updated);

    onUpdateProject({
      reviewScript: updated,
      dualScript: dual
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              3
            </span>
            Step 3: เขียนบทรีวิว (Review Script Generator)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            โครงสร้างบังคับ 5 ส่วนมาตรฐาน TikTok / Reels ยอดขายปัง: HOOK → PROBLEM → SOLUTION → PROOF → CTA
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleGenerateScript()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20 transition-all self-start sm:self-auto"
        >
          <Wand2 className="w-4 h-4 text-amber-300" />
          <span>สร้างบทอัตโนมัติ</span>
        </button>
      </div>

      {/* Tone Selection & Stats Bar */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900/70 border border-slate-800 max-w-md">
        {([
          { value: 'female', label: '👩 ผู้บรรยายผู้หญิง' },
          { value: 'male', label: '👨 ผู้บรรยายผู้ชาย' }
        ] as const).map(item => (
          <button key={item.value} type="button" onClick={() => {
            setGender(item.value);
            const generated = generateReviewScript(project.productAnalysis, tone, item.value);
            setScript(generated);
            onUpdateProject({
              reviewScript: generated,
              dualScript: buildDualScripts(generated),
              voiceSettings: { ...project.voiceSettings, tone, gender: item.value }
            });
          }} className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${gender === item.value ? 'bg-indigo-600/30 border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        
        {/* Tone Selector */}
        <div className="md:col-span-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="text-xs font-semibold text-slate-300 shrink-0">
            โทนเสียง & สไตล์การเล่า:
          </span>
          <div className="grid grid-cols-3 gap-2 flex-1">
            <button
              type="button"
              onClick={() => { setTone('cheerful'); handleGenerateScript('cheerful'); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center ${
                tone === 'cheerful'
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/40'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              👩 หญิงสดใส เป็นกันเอง
            </button>

            <button
              type="button"
              onClick={() => { setTone('energetic'); handleGenerateScript('energetic'); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center ${
                tone === 'energetic'
                  ? 'bg-amber-600/30 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              🔥 ป้ายยา ตื่นเต้น โปรแรง
            </button>

            <button
              type="button"
              onClick={() => { setTone('confident'); handleGenerateScript('confident'); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center ${
                tone === 'confident'
                  ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              💎 มั่นใจ น่าเชื่อถือ
            </button>
          </div>
        </div>

        {/* Stats Counter */}
        <div className="md:col-span-4 flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>คำ: </span>
            <span className="font-bold text-white">{script.wordCount}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>ความยาวโดยประมาณ: </span>
            <span className="font-bold text-cyan-300">~{script.estimatedDurationSeconds} วินาที</span>
          </div>
        </div>

      </div>

      {/* 5-Step Structure Script Blocks */}
      <div className="space-y-4">
        
        {/* 1. HOOK */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                1. HOOK (0-3 วินาที)
              </span>
              <span className="text-xs font-medium text-slate-300">หยุดนิ้วคนดู / สร้างความสนใจ</span>
            </div>
            <span className="text-[11px] text-slate-400">กระตุ้นความสงสัยทันที</span>
          </div>
          <textarea
            rows={2}
            value={script.hook}
            onChange={(e) => handleSectionChange('hook', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/70 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* 2. PROBLEM */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                2. PROBLEM
              </span>
              <span className="text-xs font-medium text-slate-300">ตอกย้ำปัญหาที่คนดูเผชิญ</span>
            </div>
            <span className="text-[11px] text-slate-400">สร้างความรู้สึกร่วม</span>
          </div>
          <textarea
            rows={2}
            value={script.problem}
            onChange={(e) => handleSectionChange('problem', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/70 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* 3. SOLUTION */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                3. SOLUTION
              </span>
              <span className="text-xs font-medium text-slate-300">เปิดตัวสินค้าและ 3 ฟีเจอร์เด่น</span>
            </div>
            <span className="text-[11px] text-slate-400">แนะนำพระเอกของคลิป</span>
          </div>
          <textarea
            rows={3}
            value={script.solution}
            onChange={(e) => handleSectionChange('solution', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/70 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* 4. PROOF */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                4. PROOF
              </span>
              <span className="text-xs font-medium text-slate-300">ผลลัพธ์จากการใช้งานจริง / USP</span>
            </div>
            <span className="text-[11px] text-slate-400">การันตีความประทับใจ</span>
          </div>
          <textarea
            rows={2}
            value={script.proof}
            onChange={(e) => handleSectionChange('proof', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/70 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* 5. CTA */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                5. CTA (Call To Action)
              </span>
              <span className="text-xs font-medium text-slate-300">กระตุ้นให้กดสั่งซื้อในตะกร้า / ลิงก์</span>
            </div>
            <span className="text-[11px] text-slate-400">ปิดการขายทันที</span>
          </div>
          <textarea
            rows={2}
            value={script.cta}
            onChange={(e) => handleSectionChange('cta', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/70 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

      </div>

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onPrev}
          className="px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
        >
          ← ย้อนกลับ
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all"
        >
          <span>ถัดไป: แยกสคริปต์ TTS / ซับไตเติ้ล</span>
          <span className="font-bold">→</span>
        </button>
      </div>

    </div>
  );
};
