import React from 'react';
import { X, Layers, Sparkles, Check, ArrowRight } from 'lucide-react';
import { SAMPLE_TEMPLATES } from '../services/scriptGenerator';
import { ScriptTemplate } from '../types';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ScriptTemplate) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-4xl h-[94dvh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-kanit">
                คลังเทมเพลตบทรีวิวสินค้า (Ready-to-Use Templates)
              </h3>
              <p className="text-xs text-slate-400">
                เลือกเทมเพลตตามกลุ่มสินค้าเพื่อโหลดข้อมูล จุดขาย และบทรีวิวอัตโนมัติ
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
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {SAMPLE_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-800/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-violet-300 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30">
                    {tmpl.category}
                  </span>
                  <span className="text-xs text-slate-500">พร้อมโครงสร้าง Hook-CTA</span>
                </div>

                <h4 className="text-base font-bold text-white font-kanit">
                  {tmpl.name}
                </h4>

                <div className="text-xs text-slate-300 space-y-1 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div><span className="text-slate-500">สินค้า:</span> <span className="font-semibold text-white">{tmpl.productName}</span></div>
                  <div><span className="text-slate-500">Pain Point:</span> <span className="text-rose-300">{tmpl.painPoint}</span></div>
                  <div><span className="text-slate-500">จุดเด่น:</span> <span className="text-emerald-300">{tmpl.usp}</span></div>
                </div>

                <p className="text-xs text-slate-400 italic">
                  "{tmpl.sampleHook}"
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectTemplate(tmpl);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 shadow-md shadow-violet-500/20 transition-all"
              >
                <span>เลือกใช้เทมเพลตนี้</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 bg-slate-900/80 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>
  );
};
