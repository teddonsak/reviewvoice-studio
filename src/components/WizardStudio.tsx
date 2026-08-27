import React from 'react';
import { 
  Upload, 
  Sparkles, 
  FileText, 
  ArrowRightLeft, 
  Volume2, 
  Subtitles, 
  Film,
  Check
} from 'lucide-react';
import { ProjectData, ProviderApiKeys } from '../types';
import { Step1Upload } from './Step1Upload';
import { Step2Analyze } from './Step2Analyze';
import { Step3Script } from './Step3Script';
import { Step4DualScript } from './Step4DualScript';
import { Step5Voice } from './Step5Voice';
import { Step6Subtitles } from './Step6Subtitles';
import { Step7Render } from './Step7Render';

interface WizardStudioProps {
  currentStep: number;
  onSetStep: (step: number) => void;
  project: ProjectData;
  apiKeys: ProviderApiKeys;
  onUpdateProject: (updates: Partial<ProjectData>) => void;
  onUpdateApiKeys: (keys: ProviderApiKeys) => void;
  onOpenSettings: () => void;
  onRestart: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

const STEPS = [
  { num: 1, title: 'อัปโหลดวิดีโอ', icon: Upload, short: 'วิดีโอ' },
  { num: 2, title: 'วิเคราะห์สินค้า', icon: Sparkles, short: 'วิเคราะห์' },
  { num: 3, title: 'เขียนบทรีวิว', icon: FileText, short: 'บทรีวิว' },
  { num: 4, title: 'แยกสคริปต์ 2 ชุด', icon: ArrowRightLeft, short: 'แยกสคริปต์' },
  { num: 5, title: 'เลือกเสียงพากย์', icon: Volume2, short: 'เสียง TTS' },
  { num: 6, title: 'ตั้งค่าซับไตเติ้ล', icon: Subtitles, short: 'ซับไตเติ้ล' },
  { num: 7, title: 'รวมคลิป & โหลด', icon: Film, short: 'เรนเดอร์' },
];

export const WizardStudio: React.FC<WizardStudioProps> = ({
  currentStep,
  onSetStep,
  project,
  apiKeys,
  onUpdateProject,
  onUpdateApiKeys,
  onOpenSettings,
  onRestart,
  onNotify,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-3 sm:space-y-6">
      
      {/* Visual Step Progress Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-4 shadow-xl backdrop-blur-md overflow-x-auto scrollbar-none">
        <div className="flex items-center sm:justify-between w-max sm:w-auto sm:min-w-[700px] gap-1.5 sm:gap-2">
          {STEPS.map((step, idx) => {
            const isCurrent = currentStep === step.num;
            const isCompleted = currentStep > step.num;

            return (
              <React.Fragment key={step.num}>
                
                {/* Step Item */}
                <button
                  type="button"
                  onClick={() => {
                    // Allow navigating to visited steps or if video is loaded
                    if (project.videoUrl || step.num === 1) {
                      onSetStep(step.num);
                    }
                  }}
                  className={`flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3 py-2 rounded-lg sm:rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/40'
                      : isCompleted
                      ? 'bg-slate-800/80 text-emerald-300 hover:bg-slate-800 border border-slate-700/60'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCurrent
                        ? 'bg-white/20 text-white'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>

                  <span className="text-[11px] sm:text-xs font-medium whitespace-nowrap">
                    <span className="sm:hidden">{step.short}</span><span className="hidden sm:inline">{step.title}</span>
                  </span>
                </button>

                {/* Connecting Line */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={`hidden sm:block flex-1 h-0.5 min-w-[12px] rounded-full transition-colors ${
                      currentStep > idx + 1 ? 'bg-emerald-500/60' : 'bg-slate-800'
                    }`}
                  />
                )}

              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Wizard Content Card */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 shadow-2xl backdrop-blur-xl overflow-hidden">
        {currentStep === 1 && (
          <Step1Upload
            project={project}
            onUpdateProject={onUpdateProject}
            onNext={() => onSetStep(2)}
            onNotify={onNotify}
          />
        )}

        {currentStep === 2 && (
          <Step2Analyze
            project={project}
            apiKeys={apiKeys}
            onUpdateProject={onUpdateProject}
            onOpenSettings={onOpenSettings}
            onNext={() => onSetStep(3)}
            onPrev={() => onSetStep(1)}
            onNotify={onNotify}
          />
        )}

        {currentStep === 3 && (
          <Step3Script
            project={project}
            onUpdateProject={onUpdateProject}
            onNext={() => onSetStep(4)}
            onPrev={() => onSetStep(2)}
            onNotify={onNotify}
          />
        )}

        {currentStep === 4 && (
          <Step4DualScript
            project={project}
            onUpdateProject={onUpdateProject}
            onNext={() => onSetStep(5)}
            onPrev={() => onSetStep(3)}
            onNotify={onNotify}
          />
        )}

        {currentStep === 5 && (
          <Step5Voice
            project={project}
            apiKeys={apiKeys}
            onUpdateProject={onUpdateProject}
            onUpdateApiKeys={onUpdateApiKeys}
            onNext={() => onSetStep(6)}
            onPrev={() => onSetStep(4)}
            onNotify={onNotify}
          />
        )}

        {currentStep === 6 && (
          <Step6Subtitles
            project={project}
            apiKeys={apiKeys}
            onUpdateProject={onUpdateProject}
            onNext={() => onSetStep(7)}
            onPrev={() => onSetStep(5)}
            onNotify={onNotify}
          />
        )}

        {currentStep === 7 && (
          <Step7Render
            project={project}
            onUpdateProject={onUpdateProject}
            onPrev={() => onSetStep(6)}
            onRestart={onRestart}
            onNotify={onNotify}
          />
        )}
      </div>

    </div>
  );
};
