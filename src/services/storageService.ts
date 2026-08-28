import { ProviderApiKeys, ProjectData, VoiceSettings, SubtitleSettings } from '../types';

const API_KEYS_STORAGE_KEY = 'reviewvoice_provider_api_keys_v1';
const PROJECTS_STORAGE_KEY = 'reviewvoice_saved_projects_v1';
const SETTINGS_STORAGE_KEY = 'reviewvoice_user_settings_v1';

export const DEFAULT_API_KEYS: ProviderApiKeys = {
  pd_voice: {
    apiKey: '',
    referenceId: 'th_female_cheerful_01',
    endpoint: 'https://app.pd-voiceclone.com/api/v1/tts'
  },
  minimax: {
    apiKey: '',
    groupId: '',
    model: 'speech-01-turbo',
    voiceId: 'female-tianmei'
  },
  elevenlabs: {
    apiKey: '',
    voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel or Thai-compatible multilingual
    model: 'eleven_v3'
  },
  ai_analysis: {
    activeProvider: 'gemini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: '',
    anthropicModel: 'claude-3-5-haiku-20241022'
  }
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  provider: 'pd_voice',
  speed: 1.22,
  tone: 'cheerful',
  gender: 'female',
  language: 'th'
};

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  fontSize: 84,
  position: 'middle-bottom', // ตำแหน่งกลาง-ล่าง (75%) ไม่บังตะกร้าเหลือง TikTok
  yPercent: 75,
  wordsPerLine: 3,        // ค่าเริ่มต้น 3 คำต่อแถว (กระชับ สวยงาม ไม่ล้นจอ)
  styleMode: 'karaoke',   // 'karaoke' (ไฮไลต์คำวิ่ง) หรือ 'standard' (ซับปกติ)
  textColor: '#FFFFFF',
  highlightColor: '#FACC15', // Gold / Amber yellow karaoke highlight
  bgBadgeColor: 'rgba(0, 0, 0, 0.75)',
  strokeColor: '#000000',
  strokeWidth: 8,
  fontWeight: '800',
  fontFamily: 'Kanit',
  showBadge: true,
  syncOffsetMs: 0
};

export function loadApiKeys(): ProviderApiKeys {
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (!raw) return DEFAULT_API_KEYS;
    const parsed = JSON.parse(raw);
    return {
      pd_voice: { ...DEFAULT_API_KEYS.pd_voice, ...(parsed.pd_voice || {}) },
      minimax: { ...DEFAULT_API_KEYS.minimax, ...(parsed.minimax || {}) },
      elevenlabs: {
        ...DEFAULT_API_KEYS.elevenlabs,
        ...(parsed.elevenlabs || {}),
        // Migrate the former default: Multilingual v2 does not support Thai.
        model: parsed.elevenlabs?.model === 'eleven_multilingual_v2'
          ? 'eleven_v3'
          : (parsed.elevenlabs?.model || DEFAULT_API_KEYS.elevenlabs.model)
      },
      ai_analysis: {
        ...DEFAULT_API_KEYS.ai_analysis,
        ...(parsed.ai_analysis || {}),
        // Migrate retired model id (removed from v1beta in 2025) → current default
        geminiModel: (() => {
          const m = parsed.ai_analysis?.geminiModel;
          if (!m) return DEFAULT_API_KEYS.ai_analysis.geminiModel;
          const retired = ['gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro', 'gemini-2.0-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3.1-pro'];
          if (retired.includes(m)) return 'gemini-2.0-flash';
          return m;
        })()
      }
    };
  } catch {
    return DEFAULT_API_KEYS;
  }
}

export function saveApiKeys(keys: ProviderApiKeys): void {
  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.error('Failed to save API keys to localStorage:', err);
  }
}

export function loadSavedProjects(): ProjectData[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list: ProjectData[] = Array.isArray(parsed) ? parsed : [];
    // Auto-delete หลัง 3 วัน (ตามคำขอ: เก็บ 3 วันแล้วลบอัตโนมัติ)
    const now = Date.now();
    const filtered = list.filter(p => {
      const exp = (p as any).shareExpiresAt || (p as any).webExpiresAt || (p as any).expiresAt;
      if (!exp) return true;
      const t = new Date(exp).getTime();
      return isNaN(t) || now < t;
    });
    if (filtered.length !== list.length) {
      try { localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(filtered.slice(0, 20))); } catch {}
    }
    return filtered;
  } catch {
    return [];
  }
}

export function cleanupExpiredProjects(): number {
  const before = (() => { try { return JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || '[]').length; } catch { return 0; }})();
  const after = loadSavedProjects().length;
  return before - after;
}

export function setProjectExpiry(projectId: string, days: number = 3): void {
  try {
    const projects = loadSavedProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx >= 0) {
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      (projects[idx] as any).shareExpiresAt = expiresAt;
      (projects[idx] as any).webExpiresAt = expiresAt;
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects.slice(0, 20)));
    }
  } catch {}
}

export function saveProjectToStorage(project: ProjectData): void {
  try {
    const projects = loadSavedProjects();
    const existingIndex = projects.findIndex(p => p.id === project.id);
    
    // Create a lean copy without large in-memory blobs for localStorage
    const storableProject: ProjectData = {
      ...project,
      videoBlob: undefined,
      audioBlob: undefined,
      renderedVideoBlob: undefined
    };

    if (existingIndex >= 0) {
      projects[existingIndex] = storableProject;
    } else {
      projects.unshift(storableProject);
    }

    // Limit to last 20 projects to avoid quota exceed
    const trimmed = projects.slice(0, 20);
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save project:', err);
  }
}

export function deleteProjectFromStorage(id: string): void {
  try {
    const projects = loadSavedProjects().filter(p => p.id !== id);
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to delete project:', err);
  }
}
