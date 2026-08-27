import React from 'react';
import { 
  Sparkles, 
  Settings, 
  FolderClock, 
  Zap, 
  Layers, 
  Volume2, 
  Video, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';
import { ProviderApiKeys, VoiceProviderType } from '../types';

interface HeaderProps {
  currentView: 'dashboard' | 'wizard' | 'history';
  onNavigate: (view: 'dashboard' | 'wizard' | 'history') => void;
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onOpenFastMode: () => void;
  activeProvider: VoiceProviderType;
  apiKeys: ProviderApiKeys;
  projectTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenSettings,
  onOpenTemplates,
  onOpenFastMode,
  activeProvider,
  apiKeys,
  projectTitle,
}) => {
  const isKeyConfigured = () => {
    if (activeProvider === 'pd_voice') return Boolean(apiKeys.pd_voice.apiKey.trim());
    if (activeProvider === 'minimax') return Boolean(apiKeys.minimax.apiKey.trim());
    if (activeProvider === 'elevenlabs') return Boolean(apiKeys.elevenlabs.apiKey.trim());
    return false;
  };

  const getProviderName = () => {
    switch (activeProvider) {
      case 'pd_voice': return 'PD Clone Voice';
      case 'minimax': return 'MiniMax TTS';
      case 'elevenlabs': return 'ElevenLabs';
      default: return 'Voice Provider';
    }
  };

  const configured = isKeyConfigured();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0" onClick={() => onNavigate('dashboard')}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-kanit text-base sm:text-xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  ReviewVoice
                </span>
                <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full font-semibold bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/40 text-indigo-300">
                  STUDIO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                ระบบสร้างคลิปรีวิวสินค้าพากย์ไทย AI ครบวงจร
              </p>
            </div>
          </div>

          {/* Center Project Info if in wizard */}
          {currentView === 'wizard' && projectTitle && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 max-w-xs truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="text-slate-400">โปรเจกต์:</span>
              <span className="font-medium text-white truncate">{projectTitle}</span>
            </div>
          )}

          {/* Navigation & Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            
            {/* Nav: Dashboard */}
            <button
              onClick={() => onNavigate('dashboard')}
              className={`hidden sm:block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentView === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              หน้าหลัก
            </button>

            {/* Nav: Wizard */}
            <button
              onClick={() => onNavigate('wizard')}
              className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentView === 'wizard'
                  ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">สร้างคลิปรีวิว</span>
            </button>

            {/* Fast Mode */}
            <button
              onClick={onOpenFastMode}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
              title="สร้างคลิปทันทีในคลิกเดียวด้วยค่าเริ่มต้น"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>โหมดเร็ว</span>
            </button>

            {/* Templates */}
            <button
              onClick={onOpenTemplates}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              <span>เทมเพลต</span>
            </button>

            {/* Project History */}
            <button
              onClick={() => onNavigate('history')}
              className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'history'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
              title="ประวัติโปรเจกต์ที่บันทึกไว้"
            >
              <FolderClock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">ประวัติงาน</span>
            </button>

            {/* Provider Status Pill & Settings trigger */}
            <button
              onClick={onOpenSettings}
              className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium border transition-all ${
                configured
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              {configured ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden sm:inline">{getProviderName()}</span>
              <Settings className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
