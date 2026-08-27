import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { WizardStudio } from './components/WizardStudio';
import { ProjectHistory } from './components/ProjectHistory';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { TemplatesModal } from './components/TemplatesModal';
import { FastModeModal } from './components/FastModeModal';
import { ToastContainer, ToastMessage } from './components/Toast';

import { 
  ProjectData, 
  ProviderApiKeys, 
  VoiceProviderType, 
  ScriptTemplate 
} from './types';
import { 
  loadApiKeys, 
  saveApiKeys, 
  loadSavedProjects, 
  saveProjectToStorage, 
  deleteProjectFromStorage,
  DEFAULT_VOICE_SETTINGS,
  DEFAULT_SUBTITLE_SETTINGS
} from './services/storageService';
import { 
  SAMPLE_TEMPLATES, 
  analyzeProductDetails, 
  generateReviewScript, 
  buildDualScripts 
} from './services/scriptGenerator';

const createEmptyProject = (): ProjectData => {
  const initialAnalysis = analyzeProductDetails('Glow Vit-C 10% Brightening Serum');
  const initialScript = generateReviewScript(initialAnalysis, 'cheerful');
  const initialDual = buildDualScripts(initialScript);

  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: 'โปรเจกต์รีวิวใหม่',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    videoUrl: '',
    videoFileName: '',
    videoDuration: 12,
    videoWidth: 1080,
    videoHeight: 1920,
    productAnalysis: initialAnalysis,
    reviewScript: initialScript,
    dualScript: initialDual,
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
    subtitleSettings: { ...DEFAULT_SUBTITLE_SETTINGS },
    status: 'draft'
  };
};

export function App() {
  // Navigation & View state
  const [currentView, setCurrentView] = useState<'dashboard' | 'wizard' | 'history'>('dashboard');
  const [wizardStep, setWizardStep] = useState<number>(1);

  // Active Project & State
  const [project, setProject] = useState<ProjectData>(createEmptyProject);
  const [savedProjects, setSavedProjects] = useState<ProjectData[]>([]);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ProviderApiKeys>(loadApiKeys);
  const [activeProvider, setActiveProvider] = useState<VoiceProviderType>('pd_voice');

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isFastModeOpen, setIsFastModeOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Load saved projects on mount (auto-cleanup 3-day web clips)
  useEffect(() => {
    const cleaned = loadSavedProjects();
    setSavedProjects(cleaned);
    // แจ้งถ้ามีคลิปลบอัตโนมัติหลังครบ 3 วัน
    try {
      const raw = localStorage.getItem('reviewvoice_saved_projects_v1');
      const before = raw ? JSON.parse(raw).length : 0;
      if (before > cleaned.length) {
        addToast('info', `ลบคลิปหมดอายุ ${before - cleaned.length} รายการ`, 'คลิปที่เก็บไว้บนเว็บครบ 3 วันจะถูกลบอัตโนมัติ');
      }
    } catch {}
  }, []);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const newToast: ToastMessage = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateProject = (updates: Partial<ProjectData>) => {
    setProject((prev) => {
      const updated = {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return updated;
    });
  };

  const handleSaveApiKeys = (newKeys: ProviderApiKeys) => {
    setApiKeys(newKeys);
    saveApiKeys(newKeys);
  };

  const handleStartNewProject = () => {
    const newProj = createEmptyProject();
    setProject(newProj);
    setWizardStep(1);
    setCurrentView('wizard');
    addToast('info', 'สร้างโปรเจกต์ใหม่เรียบร้อย', 'ขั้นตอนที่ 1: กรุณาอัปโหลดหรือเลือกวิดีโอสินค้า');
  };

  const handleOpenExistingProject = (proj: ProjectData) => {
    setProject(proj);
    setWizardStep(proj.status === 'rendered' ? 7 : 1);
    setCurrentView('wizard');
    addToast('success', 'เปิดโปรเจกต์สำเร็จ', proj.title);
  };

  const handleDeleteProject = (id: string) => {
    deleteProjectFromStorage(id);
    setSavedProjects(loadSavedProjects());
    addToast('info', 'ลบโปรเจกต์ออกจากประวัติแล้ว');
  };

  const handleApplyTemplate = (template: ScriptTemplate) => {
    const analysis = {
      productName: template.productName,
      painPoint: template.painPoint,
      features: [...template.features],
      targetAudience: template.targetAudience,
      usp: template.usp
    };

    const script = generateReviewScript(analysis, project.voiceSettings.tone || 'cheerful');
    const dual = buildDualScripts(script);

    setProject((prev) => ({
      ...prev,
      title: `รีวิว: ${template.name}`,
      productAnalysis: analysis,
      reviewScript: script,
      dualScript: dual,
      status: 'scripted'
    }));

    setWizardStep(1);
    setCurrentView('wizard');
    addToast('success', 'โหลดเทมเพลตสำเร็จ!', `นำเข้าข้อมูลสำหรับ "${template.name}" เรียบร้อยแล้ว`);
  };

  const handleExecuteFastMode = (template: ScriptTemplate) => {
    // 1. Create simulated canvas sample video for instant 1-click execution
    const analysis = {
      productName: template.productName,
      painPoint: template.painPoint,
      features: [...template.features],
      targetAudience: template.targetAudience,
      usp: template.usp
    };

    const script = generateReviewScript(analysis, 'cheerful');
    const dual = buildDualScripts(script);

    // Create instant project
    const fastProj: ProjectData = {
      ...createEmptyProject(),
      title: `ด่วน: ${template.name}`,
      productAnalysis: analysis,
      reviewScript: script,
      dualScript: dual,
      voiceSettings: {
        provider: activeProvider,
        speed: 1.22,
        tone: 'cheerful',
        gender: 'female',
        language: 'th'
      },
      subtitleSettings: {
        ...DEFAULT_SUBTITLE_SETTINGS,
        fontSize: 84,
        position: 'middle-top',
        highlightColor: '#FACC15',
        fontFamily: 'Kanit'
      }
    };

    setProject(fastProj);
    setWizardStep(1);
    setCurrentView('wizard');
    addToast('success', 'เปิดโหมดเร็วสำเร็จ!', 'ระบบใส่ค่ามาตรฐานพร้อมให้คุณกดวิเคราะห์และเรนเดอร์ได้ทันที');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-prompt selection:bg-indigo-500 selection:text-white">
      
      {/* Navigation Header */}
      <Header
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenFastMode={() => setIsFastModeOpen(true)}
        activeProvider={activeProvider}
        apiKeys={apiKeys}
        projectTitle={project.title}
      />

      {/* Main View Switching */}
      <main className="flex-1">
        {currentView === 'dashboard' && (
          <Dashboard
            onStartNewProject={handleStartNewProject}
            onOpenFastMode={() => setIsFastModeOpen(true)}
            onOpenTemplates={() => setIsTemplatesOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onLoadTemplate={(id) => {
              const tmpl = SAMPLE_TEMPLATES.find((t) => t.id === id);
              if (tmpl) handleApplyTemplate(tmpl);
            }}
            recentProjects={savedProjects}
            onOpenProject={handleOpenExistingProject}
          />
        )}

        {currentView === 'wizard' && (
          <WizardStudio
            currentStep={wizardStep}
            onSetStep={(s) => setWizardStep(s)}
            project={project}
            apiKeys={apiKeys}
            onUpdateProject={handleUpdateProject}
            onUpdateApiKeys={handleSaveApiKeys}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onRestart={handleStartNewProject}
            onNotify={addToast}
          />
        )}

        {currentView === 'history' && (
          <ProjectHistory
            projects={savedProjects}
            onOpenProject={handleOpenExistingProject}
            onDeleteProject={handleDeleteProject}
            onStartNew={handleStartNewProject}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="hidden sm:block border-t border-slate-800/80 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300 font-kanit">ReviewVoice Studio</span>
            <span>— ระบบสร้างคลิปรีวิวสินค้าสำหรับครีเอเตอร์ไทย</span>
          </div>
          <div>
            <span>รองรับ PD Clone Voice • MiniMax • ElevenLabs • คาราโอเกะซับ 1080x1920</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeys={apiKeys}
        onSaveKeys={handleSaveApiKeys}
        activeProvider={activeProvider}
        onSelectProvider={(p) => {
          setActiveProvider(p);
          handleUpdateProject({
            voiceSettings: {
              ...project.voiceSettings,
              provider: p
            }
          });
        }}
        onNotify={addToast}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />

      <FastModeModal
        isOpen={isFastModeOpen}
        onClose={() => setIsFastModeOpen(false)}
        onExecuteFastMode={handleExecuteFastMode}
      />

      {/* Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

    </div>
  );
}

export default App;
