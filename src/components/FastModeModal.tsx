import React, { useState } from 'react';
import { X, Zap, Sparkles, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { SAMPLE_TEMPLATES } from '../services/scriptGenerator';
import { ScriptTemplate } from '../types';

interface FastModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteFastMode: (template: ScriptTemplate) => void;
}

export const FastModeModal: React.FC<FastModeModalProps> = ({
  isOpen,
  onClose,
  onExecuteFastMode,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate>(SAMPLE_TEMPLATES[0]);
  const [isRunning, setIsRunning] = useState(false);

  if (!isOpen) return null;

  const handleStart = () => {
    setIsRunning(true);
    setTimeout(() => {
      onExecuteFastMode(selectedTemplate);
      setIsRunning(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[94dvh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-kanit">
                โหมดเร็ว (1-Click Fast Generation Mode)
              </h3>
              <p className="text-xs text-slate-400">
                ใช้ค่าเริ่มต้นที่ดีที่สุดทั้งหมด แล้วระบบจะรันสร้างคลิปรีวิวครบวงจรในคลิกเดียว
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          <label className="block text-xs font-semibold text-slate-300">
            เลือกประเภทสินค้าที่ต้องการสร้างคลิปด่วน:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SAMPLE_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedTemplate.id === tmpl.id
                    ? 'bg-slate-800 border-amber-500/70 ring-1 ring-amber-500/40 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-amber-300">
                    {tmpl.category}
                  </span>
                  {selectedTemplate.id === tmpl.id && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-white">{tmpl.name}</h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{tmpl.usp}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
            <span className="font-semibold text-amber-300">ระบบจะทำการตั้งค่าเริ่มต้นให้อัตโนมัติ:</span>
            <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400">
              <li>✓ วิดีโอแนวตั้ง 1080x1920</li>
              <li>✓ เสียงหญิงไทยสดใส สปีด 1.22x</li>
              <li>✓ แยกสคริปต์ TTS ไทยล้วน</li>
              <li>✓ ซับไตเติ้ลคาราโอเกะ Kanit 84px</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 bg-slate-900/80 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleStart}
            disabled={isRunning}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>กำลังสร้างคลิปแบบด่วน...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>สร้างคลิปทันทีใน 1 คลิก</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
