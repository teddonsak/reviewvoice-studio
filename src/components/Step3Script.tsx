import React, { useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  FileText, 
  CheckCircle2, 
  Volume2, 
  Wand2, 
  RotateCcw,
  Layers,
  Zap,
  Flame,
  ShieldCheck,
  TrendingUp,
  Sliders,
  HelpCircle,
  ShoppingBag
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
  const [speed, setSpeed] = useState<number>(project.voiceSettings.speed ?? 1.22);
  const [targetDuration, setTargetDuration] = useState<number>(
    project.reviewScript.targetDurationSeconds || 30
  );
  const [copywritingStyle, setCopywritingStyle] = useState<
    'trendy_influencer' | 'direct_sales' | 'expert' | 'storytelling' | 'fast_hook'
  >(project.reviewScript.copywritingStyle || 'trendy_influencer');
  const [script, setScript] = useState<ReviewScript>(project.reviewScript);

  const calculateDuration = (text: string, currentSpeed: number): number => {
    const thaiChars = (text.match(/[\u0E00-\u0E7F0-9A-Za-z]/g) || []).length;
    return Math.max(5, Math.round(thaiChars / (10.5 * Math.max(0.8, currentSpeed))));
  };

  const handleGenerateScript = (
    selectedStyle = copywritingStyle,
    selectedTargetDuration = targetDuration,
    selectedSpeed = speed,
    selectedGender = gender,
    selectedTone = tone
  ) => {
    const generated = generateReviewScript(
      project.productAnalysis,
      selectedTone,
      selectedGender,
      selectedStyle,
      selectedTargetDuration,
      selectedSpeed
    );
    setScript(generated);
    const dual = buildDualScripts(generated);

    onUpdateProject({
      reviewScript: generated,
      dualScript: dual,
      voiceSettings: {
        ...project.voiceSettings,
        tone: selectedTone,
        gender: selectedGender,
        speed: selectedSpeed,
      },
      status: 'scripted',
    });

    onNotify(
      'success',
      'สร้างบทรีวิวสายขายดีสำเร็จ!',
      `ความยาวประมาณ ~${generated.estimatedDurationSeconds} วินาที (${generated.wordCount} คำ) โครงสร้าง Hook-CTA ครบถ้วน`
    );
  };

  const handleSectionChange = (section: keyof ReviewScript, value: string) => {
    const updated = { ...script, [section]: value };
    const full = `${updated.hook} ${updated.problem} ${updated.solution} ${updated.proof} ${updated.cta}`.trim();
    const words = full.split(/[\s,]+/).filter((w) => w.length > 0);
    const estimated = calculateDuration(full, speed);

    updated.fullText = full;
    updated.wordCount = words.length;
    updated.estimatedDurationSeconds = estimated;
    updated.targetDurationSeconds = targetDuration;
    updated.copywritingStyle = copywritingStyle;

    setScript(updated);
    const dual = buildDualScripts(updated);

    onUpdateProject({
      reviewScript: updated,
      dualScript: dual,
    });
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    const estimated = calculateDuration(script.fullText, newSpeed);
    const updated = { ...script, estimatedDurationSeconds: estimated };
    setScript(updated);
    onUpdateProject({
      reviewScript: updated,
      voiceSettings: { ...project.voiceSettings, speed: newSpeed },
    });
  };

  const durationDiff = script.estimatedDurationSeconds - targetDuration;
  const isDurationGood = Math.abs(durationDiff) <= 4;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              3
            </span>
            Step 3: ออกแบบบทพูดปิดการขาย (High-Converting Copywriting)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            วิเคราะห์จิตวิทยาการขาย ดึงดูดคนดูใน 3 วินาทีแรก ขยี้จุดเจ็บ และกระตุ้นให้กดสั่งซื้อทันที
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleGenerateScript()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-500/25 transition-all self-start sm:self-auto transform hover:-translate-y-0.5"
        >
          <Wand2 className="w-4 h-4 text-amber-300" />
          <span>สร้างบทพูดด้วย AI</span>
        </button>
      </div>

      {/* Control Grid: Duration, Speed, Style, Gender */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* 1. Target Duration Control */}
        <div className="md:col-span-6 p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              ⏱️ กำหนดเวลาเป้าหมายของคลิป (Target Duration):
            </span>
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
              {targetDuration} วินาที
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-xs">
            {[
              { sec: 15, label: '15 วิ', desc: 'Shorts/Hook' },
              { sec: 30, label: '30 วิ', desc: 'TikTok ปังสุด' },
              { sec: 45, label: '45 วิ', desc: 'มาตรฐาน' },
              { sec: 60, label: '60 วิ', desc: 'รีวิวละเอียด' },
              { sec: 90, label: '90 วิ', desc: 'เจาะลึกจัดเต็ม' },
            ].map((d) => (
              <button
                key={d.sec}
                type="button"
                onClick={() => {
                  setTargetDuration(d.sec);
                  handleGenerateScript(copywritingStyle, d.sec, speed, gender, tone);
                }}
                className={`p-2 rounded-lg border text-center transition-all ${
                  targetDuration === d.sec
                    ? 'bg-cyan-600/30 border-cyan-500 text-white font-bold ring-1 ring-cyan-500/40 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold font-mono">{d.label}</div>
                <div className="text-[9px] text-slate-400 truncate">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Speech Speed Control */}
        <div className="md:col-span-6 p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              ⚡ ปรับความไวของเสียงพากย์ (Speech Speed):
            </span>
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30">
              {speed.toFixed(2)}x
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-xs">
            {[
              { val: 0.95, label: '0.95x', desc: 'ช้าชัด' },
              { val: 1.05, label: '1.05x', desc: 'ปกติ' },
              { val: 1.15, label: '1.15x', desc: 'ธรรมชาติ' },
              { val: 1.22, label: '1.22x', desc: 'TikTok ป้ายยา' },
              { val: 1.35, label: '1.35x', desc: 'กระชับไว' },
            ].map((s) => (
              <button
                key={s.val}
                type="button"
                onClick={() => handleSpeedChange(s.val)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  Math.abs(speed - s.val) < 0.03
                    ? 'bg-amber-600/30 border-amber-500 text-white font-bold ring-1 ring-amber-500/40 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold font-mono">{s.label}</div>
                <div className="text-[9px] text-slate-400 truncate">{s.desc}</div>
              </button>
            ))}
          </div>

          <input
            type="range"
            min="0.8"
            max="1.5"
            step="0.02"
            value={speed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

      </div>

      {/* Copywriting Styles Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            🎯 เลือกสไตล์บทพูดและจิตวิทยาการปิดการขาย (Copywriting Formula):
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGender('female');
                handleGenerateScript(copywritingStyle, targetDuration, speed, 'female', tone);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                gender === 'female'
                  ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              👩 เสียงผู้หญิง
            </button>
            <button
              type="button"
              onClick={() => {
                setGender('male');
                handleGenerateScript(copywritingStyle, targetDuration, speed, 'male', tone);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                gender === 'male'
                  ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              👨 เสียงผู้ชาย
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {[
            {
              id: 'trendy_influencer' as const,
              title: '🌟 ป้ายยาสายอินฟลู',
              desc: 'เล่าสนุก เป็นกันเอง เหมือนเพื่อนป้ายยาเพื่อน (ยอดนิยม)',
            },
            {
              id: 'direct_sales' as const,
              title: '🔥 โปรแรง ปิดการขาย',
              desc: 'ยิงตรงจุด ป้ายยาโปรโมชั่น ตะกร้าแตก กระตุ้นกดซื้อ',
            },
            {
              id: 'expert' as const,
              title: '💎 ผู้เชี่ยวชาญน่าเชื่อถือ',
              desc: 'เน้นสารสกัด ฟังก์ชัน ผลลัพธ์จริง สร้างความไว้วางใจ',
            },
            {
              id: 'storytelling' as const,
              title: '🎭 เล่าเรื่องแก้ปัญหา',
              desc: 'จากปัญหาที่เคยเจอ สู่ชีวิตที่เปลี่ยนไปเพราะสินค้า',
            },
            {
              id: 'fast_hook' as const,
              title: '⚡ 15-20 วิ ช็อตฟิล',
              desc: 'สั้น กระชับ ฉับไว หยุดนิ้วคนดูในเสี้ยววินาที',
            },
          ].map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                setCopywritingStyle(style.id);
                handleGenerateScript(style.id, targetDuration, speed, gender, tone);
              }}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                copywritingStyle === style.id
                  ? 'bg-indigo-600/25 border-indigo-500 text-white ring-1 ring-indigo-500/50 shadow-md'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-xs">{style.title}</div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">{style.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Live Duration & Quality Assessment Card */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-300">📊 สถานะความยาวบทพูด:</span>
          <span className="font-mono text-slate-400">คำ: <strong className="text-white">{script.wordCount}</strong></span>
          <span className="font-mono text-slate-400">ตัวอักษร: <strong className="text-white">{script.fullText.length}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">เวลาจริงที่สปีด {speed.toFixed(2)}x:</span>
          <span
            className={`font-bold font-mono px-3 py-1 rounded-full text-xs border ${
              isDurationGood
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            ~{script.estimatedDurationSeconds} วินาที (เป้าหมาย: {targetDuration}s)
          </span>
        </div>
      </div>

      {/* 5-Step Structure Script Blocks */}
      <div className="space-y-4">
        {/* 1. HOOK */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                1. HOOK (0-3 วินาที)
              </span>
              <span className="text-xs font-semibold text-slate-200">🪝 หยุดนิ้วคนดู / ป้องกันคนปัดผ่าน</span>
            </div>
            <span className="text-[11px] text-slate-400">คำถามจี้ใจดำ หรือผลลัพธ์ว้าว</span>
          </div>
          <textarea
            rows={2}
            value={script.hook}
            onChange={(e) => handleSectionChange('hook', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-none"
            placeholder="ประโยคเปิดคลิปที่ดึงดูดความสนใจ..."
          />
        </div>

        {/* 2. PROBLEM */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                2. PROBLEM (3-8 วินาที)
              </span>
              <span className="text-xs font-semibold text-slate-200">🤕 ขยี้จุดเจ็บ (Pain Point)</span>
            </div>
            <span className="text-[11px] text-slate-400">ทำให้คนดูรู้สึกว่า &quot;นี่มันปัญหาเราเลย!&quot;</span>
          </div>
          <textarea
            rows={2}
            value={script.problem}
            onChange={(e) => handleSectionChange('problem', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-none"
            placeholder="ปัญหาที่สินค้าตัวนี้มาช่วยแก้ไข..."
          />
        </div>

        {/* 3. SOLUTION & DEMO */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                3. SOLUTION & FEATURES (8-18 วินาที)
              </span>
              <span className="text-xs font-semibold text-slate-200">💡 สินค้าคือคำตอบ + โชว์ฟังก์ชันเด็ด</span>
            </div>
            <span className="text-[11px] text-slate-400">จุดเด่นที่ทำให้ชีวิตง่ายขึ้น</span>
          </div>
          <textarea
            rows={3}
            value={script.solution}
            onChange={(e) => handleSectionChange('solution', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-none"
            placeholder="ฟังก์ชันและจุดเด่นของสินค้า..."
          />
        </div>

        {/* 4. PROOF & USP */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                4. SOCIAL PROOF & USP (18-24 วินาที)
              </span>
              <span className="text-xs font-semibold text-slate-200">🏆 ตอกย้ำความมั่นใจ / ผลลัพธ์จริง</span>
            </div>
            <span className="text-[11px] text-slate-400">รีวิว ผลลัพธ์ หรือจุดขายเฉพาะ</span>
          </div>
          <textarea
            rows={2}
            value={script.proof}
            onChange={(e) => handleSectionChange('proof', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-none"
            placeholder="หลักฐานความน่าเชื่อถือและการันตี..."
          />
        </div>

        {/* 5. CALL TO ACTION */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                5. CALL TO ACTION & URGENCY (24-30 วินาที)
              </span>
              <span className="text-xs font-semibold text-slate-200">🛒 กระตุ้นให้กดซื้อทันที</span>
            </div>
            <span className="text-[11px] text-slate-400">ชี้พิกัดตะกร้า + สิทธิพิเศษ</span>
          </div>
          <textarea
            rows={2}
            value={script.cta}
            onChange={(e) => handleSectionChange('cta', e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-none"
            placeholder="ประโยคปิดการขาย ชี้พิกัดตะกร้า..."
          />
        </div>
      </div>

      {/* Navigation */}
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
          <span>ถัดไป: แยกสคริปต์พูด & ซับ</span>
          <span className="font-bold">→</span>
        </button>
      </div>
    </div>
  );
};
