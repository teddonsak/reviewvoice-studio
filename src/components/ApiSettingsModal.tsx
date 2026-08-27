import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Volume2, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Sparkles, 
  Play, 
  Loader2, 
  ExternalLink, 
  Bot, 
  RefreshCw, 
  Check 
} from 'lucide-react';
import { ProviderApiKeys, VoiceProviderType, AnalysisAiProviderType, AnalysisAiConfig } from '../types';
import { generateVoiceoverAudio, fetchElevenLabsVoices, fetchPdVoices } from '../services/ttsService';
import { testAiApiKey, fetchGeminiModels, fetchOpenAiModels } from '../services/aiAnalysisService';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ProviderApiKeys;
  onSaveKeys: (keys: ProviderApiKeys) => void;
  activeProvider: VoiceProviderType;
  onSelectProvider: (provider: VoiceProviderType) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  onSaveKeys,
  activeProvider,
  onSelectProvider,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'ai_text' | 'voice_tts'>('ai_text');
  const [formData, setFormData] = useState<ProviderApiKeys>(apiKeys);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({
    pd_voice: false,
    minimax: false,
    elevenlabs: false,
    gemini: false,
    openai: false,
    anthropic: false,
  });

  // Dynamic model/voice list states
  const [geminiModels, setGeminiModels] = useState<Array<{ id: string; displayName: string }>>([
    { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash (เร็ว/แนะนำ)' },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
    { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-flash-latest', displayName: 'Gemini 1.5 Flash Latest' },
  ]);
  const [loadingGeminiModels, setLoadingGeminiModels] = useState(false);

  const [openaiModels, setOpenaiModels] = useState<Array<{ id: string; name: string }>>([
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini (แนะนำ/เร็ว)' },
    { id: 'gpt-4o', name: 'gpt-4o (ฉลาดสูงสุด)' },
    { id: 'gpt-4-turbo', name: 'gpt-4-turbo' },
  ]);
  const [loadingOpenAiModels, setLoadingOpenAiModels] = useState(false);

  const [elevenVoices, setElevenVoices] = useState<Array<{ voice_id: string; name: string }>>([
    { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Multilingual)' },
    { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Empathetic)' },
    { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Warm & Clear)' },
    { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Energetic)' },
  ]);
  const [loadingElevenVoices, setLoadingElevenVoices] = useState(false);

  // PD Clone Voice dynamic list state
  const [pdVoices, setPdVoices] = useState<Array<{ reference_id: string; name: string; is_default: boolean }>>([
    { reference_id: '', name: '⭐ ใช้เสียงหลักตามบัญชี (Default Voice)', is_default: true }
  ]);
  const [loadingPdVoices, setLoadingPdVoices] = useState(false);

  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [testingAi, setTestingAi] = useState<string | null>(null);

  // Auto-fetch PD Clone Voices
  const handleFetchPdVoices = async (key: string, endpoint?: string) => {
    if (!key.trim()) return;
    setLoadingPdVoices(true);
    try {
      const result = await fetchPdVoices(key, endpoint || formData.pd_voice.endpoint);
      if (result.voices && result.voices.length > 0) {
        setPdVoices([
          { reference_id: '', name: '⭐ ใช้เสียงหลักตามบัญชี (Default Voice)', is_default: true },
          ...result.voices
        ]);
        if (!formData.pd_voice.referenceId && result.default_reference_id) {
          handleVoiceInputChange('pd_voice', 'referenceId', result.default_reference_id);
        }
        onNotify('success', 'ดึงรายการเสียง PD Clone Voice สำเร็จ!', `พบ ${result.voices.length} เสียงในคลังเสียงของคุณ`);
      } else {
        onNotify('info', 'เชื่อมต่อ PD Clone Voice สำเร็จ', 'บัญชีนี้ยังไม่มีเสียง Clone ในคลัง คุณยังใช้เสียงหลักของบัญชีหรือระบุ Reference ID เองได้');
      }
    } catch (err: any) {
      console.warn('Auto fetch PD voices error:', err);
      onNotify('error', 'ดึงเสียง PD Clone Voice ไม่สำเร็จ', err.message || 'กรุณาตรวจสอบ API Key และลองอีกครั้ง');
    } finally {
      setLoadingPdVoices(false);
    }
  };

  // Auto-fetch Gemini models when key is present on modal open or key change
  const handleFetchGemini = async (key: string) => {
    if (!key.trim()) return;
    setLoadingGeminiModels(true);
    try {
      const models = await fetchGeminiModels(key);
      if (models.length > 0) {
        setGeminiModels(models);
        // If current model not in list, auto-select first
        if (!models.some(m => m.id === formData.ai_analysis.geminiModel)) {
          handleAiInputChange('geminiModel', models[0].id);
        }
        onNotify('success', 'ดึงรายชื่อโมเดล Gemini อัตโนมัติสำเร็จ!', `พบ ${models.length} โมเดลจาก Google AI Studio`);
      }
    } catch (err: any) {
      console.warn('Auto fetch Gemini models error:', err);
    } finally {
      setLoadingGeminiModels(false);
    }
  };

  // Auto-fetch OpenAI models
  const handleFetchOpenAi = async (key: string) => {
    if (!key.trim()) return;
    setLoadingOpenAiModels(true);
    try {
      const models = await fetchOpenAiModels(key);
      if (models.length > 0) {
        setOpenaiModels(models);
        if (!models.some(m => m.id === formData.ai_analysis.openaiModel)) {
          handleAiInputChange('openaiModel', models[0].id);
        }
        onNotify('success', 'ดึงรายชื่อโมเดล OpenAI อัตโนมัติสำเร็จ!', `พบ ${models.length} โมเดลจากบัญชี OpenAI`);
      }
    } catch (err: any) {
      console.warn('Auto fetch OpenAI models error:', err);
    } finally {
      setLoadingOpenAiModels(false);
    }
  };

  // Auto-fetch ElevenLabs voices
  const handleFetchElevenLabs = async (key: string) => {
    if (!key.trim()) return;
    setLoadingElevenVoices(true);
    try {
      const voices = await fetchElevenLabsVoices(key);
      if (voices.length > 0) {
        setElevenVoices(voices);
        if (!voices.some(v => v.voice_id === formData.elevenlabs.voiceId)) {
          handleVoiceInputChange('elevenlabs', 'voiceId', voices[0].voice_id);
        }
        onNotify('success', 'ดึงรายชื่อเสียง ElevenLabs อัตโนมัติสำเร็จ!', `พบ ${voices.length} เสียงพร้อมใช้งาน`);
      } else {
        onNotify('info', 'เชื่อมต่อ ElevenLabs สำเร็จ', 'บัญชีนี้ยังไม่มีเสียงที่พร้อมใช้งาน');
      }
    } catch (err: any) {
      console.warn('Auto fetch ElevenLabs voices error:', err);
      onNotify('error', 'ดึงเสียง ElevenLabs ไม่สำเร็จ', err.message || 'กรุณาตรวจสอบ API Key และสิทธิ์ Voices Read');
    } finally {
      setLoadingElevenVoices(false);
    }
  };

  // Initial fetch on open if keys already present
  useEffect(() => {
    if (isOpen) {
      if (formData.pd_voice.apiKey.trim()) handleFetchPdVoices(formData.pd_voice.apiKey, formData.pd_voice.endpoint);
      if (formData.ai_analysis.geminiApiKey.trim()) handleFetchGemini(formData.ai_analysis.geminiApiKey);
      if (formData.ai_analysis.openaiApiKey.trim()) handleFetchOpenAi(formData.ai_analysis.openaiApiKey);
      if (formData.elevenlabs.apiKey.trim()) handleFetchElevenLabs(formData.elevenlabs.apiKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleShowKey = (keyName: string) => {
    setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const handleVoiceInputChange = (provider: 'pd_voice' | 'minimax' | 'elevenlabs', field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }));
  };

  const handleAiInputChange = (field: keyof AnalysisAiConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      ai_analysis: {
        ...prev.ai_analysis,
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    onSaveKeys(formData);
    onNotify('success', 'บันทึกการตั้งค่า API Key สำเร็จ', 'ข้อมูลถูกบันทึกอย่างปลอดภัยในบราวเซอร์ของคุณ (LocalStorage)');
    onClose();
  };

  const handleTestVoice = async (provider: VoiceProviderType) => {
    setTestingVoice(provider);
    const testText = 'สวัสดีค่ะ ยินดีต้อนรับสู่ ReviewVoice Studio ระบบพากย์เสียงรีวิวสินค้าไทยค่ะ';
    
    try {
      const result = await generateVoiceoverAudio(testText, {
        provider,
        speed: 1.22,
        tone: 'cheerful',
        language: 'th'
      }, formData);

      const audio = new Audio(result.audioUrl);
      await audio.play();
      onNotify('success', `ทดสอบเสียง ${provider.toUpperCase()} สำเร็จ!`, 'กำลังเล่นตัวอย่างเสียงทดสอบ');
    } catch (err: any) {
      onNotify('error', 'ทดสอบเสียงล้มเหลว', err.message || 'โปรดตรวจสอบความถูกต้องของ API Key และการเชื่อมต่อ');
    } finally {
      setTestingVoice(null);
    }
  };

  const handleTestAi = async (provider: AnalysisAiProviderType) => {
    setTestingAi(provider);
    try {
      const res = await testAiApiKey(provider, formData.ai_analysis);
      if (res.success) {
        onNotify('success', 'ทดสอบการวิเคราะห์ข้อความสำเร็จ!', res.message);
      } else {
        onNotify('error', 'ทดสอบ AI ล้มเหลว', res.message);
      }
    } catch (err: any) {
      onNotify('error', 'เกิดข้อผิดพลาดในการทดสอบ AI', err.message || 'โปรดตรวจสอบ API Key');
    } finally {
      setTestingAi(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-3xl w-full max-w-4xl h-[94dvh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Key className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-kanit">
                จัดการ API Key & ค้นหาโมเดลอัตโนมัติ (Model Auto-Discovery)
              </h3>
              <p className="text-xs text-slate-400">
                เมื่อกรอก Key ระบบจะดึงรายชื่อโมเดลและเสียงพากย์จริงจากบัญชีของคุณมาให้เลือกทันที
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-3 sm:px-6 pt-3 sm:pt-4 bg-slate-900 border-b border-slate-800 flex items-center gap-1 sm:gap-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ai_text')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'ai_text'
                ? 'border-indigo-500 text-indigo-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Bot className="w-4 h-4 text-cyan-400" />
            <span>1. AI วิเคราะห์ข้อความ & สคริปต์</span>
            {formData.ai_analysis.geminiApiKey || formData.ai_analysis.openaiApiKey || formData.ai_analysis.anthropicApiKey ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('voice_tts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'voice_tts'
                ? 'border-indigo-500 text-indigo-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Volume2 className="w-4 h-4 text-indigo-400" />
            <span>2. ผู้ให้บริการเสียงพากย์ (TTS)</span>
            {formData.pd_voice.apiKey || formData.minimax.apiKey || formData.elevenlabs.apiKey ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            ) : null}
          </button>
        </div>

        {/* Notice Banner */}
        <div className="mx-6 mt-4 p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-2.5 text-xs text-indigo-200/90">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-indigo-300">ความปลอดภัย 100%:</span> API Key ทุกประเภทถูกจัดเก็บในบราวเซอร์ของคุณ (LocalStorage) เท่านั้น ไม่มีการส่งไปเก็บบนเซิร์ฟเวอร์ภายนอก
          </div>
        </div>

        {/* Tab 1: AI Analysis (ข้อความ & เขียนบท) */}
        {activeTab === 'ai_text' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
            
            {/* Choose Active AI Provider */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                เลือกโมเดล AI หลักที่ต้องการใช้วิเคราะห์สินค้าและเขียนบทรีวิว:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'gemini', name: 'Google Gemini', desc: 'แนะนำ / ฟรี Tier สูง', icon: '✨' },
                  { id: 'openai', name: 'OpenAI GPT-4o', desc: 'แม่นยำ ลื่นไหล', icon: '⚡' },
                  { id: 'anthropic', name: 'Claude 3.5', desc: 'ภาษาธรรมชาติ', icon: '🧠' },
                  { id: 'builtin', name: 'Smart AI ในตัว', desc: 'ฟรี ไม่ต้องใช้ Key', icon: '🚀' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAiInputChange('activeProvider', p.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.ai_analysis.activeProvider === p.id
                        ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40 shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{p.icon}</span>
                      {formData.ai_analysis.activeProvider === p.id && (
                        <Check className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                    </div>
                    <div className="font-bold text-xs text-white mt-1">{p.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 1. Google Gemini Card with Auto Model Fetching */}
            <div className={`p-5 rounded-2xl border transition-all ${
              formData.ai_analysis.activeProvider === 'gemini'
                ? 'bg-slate-800/70 border-indigo-500/60 ring-1 ring-indigo-500/30'
                : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-kanit font-semibold text-white text-sm">
                      Google Gemini API Key
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      แนะนำสำหรับผู้ใช้ไทย (ฟรี)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ใส่ Key แล้วระบบจะดึงรายชื่อโมเดล Gemini ทั้งหมดจากบัญชีของคุณให้อัตโนมัติ
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20"
                  >
                    <span>รับ API Key ฟรี</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleTestAi('gemini')}
                    disabled={testingAi === 'gemini'}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                  >
                    {testingAi === 'gemini' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>ทดสอบ</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-medium">
                      Gemini API Key
                    </label>
                    {formData.ai_analysis.geminiApiKey && (
                      <button
                        type="button"
                        onClick={() => handleFetchGemini(formData.ai_analysis.geminiApiKey)}
                        disabled={loadingGeminiModels}
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingGeminiModels ? 'animate-spin' : ''}`} />
                        <span>{loadingGeminiModels ? 'กำลังดึงโมเดล...' : 'ดึงโมเดลอัตโนมัติ'}</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys.gemini ? 'text' : 'password'}
                      value={formData.ai_analysis.geminiApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleAiInputChange('geminiApiKey', val);
                        if (val.length > 20) {
                          handleFetchGemini(val);
                        }
                      }}
                      onBlur={() => {
                        if (formData.ai_analysis.geminiApiKey.trim()) {
                          handleFetchGemini(formData.ai_analysis.geminiApiKey);
                        }
                      }}
                      placeholder="วาง Gemini API Key (เช่น AIzaSy...)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('gemini')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    เลือกโมเดล (พบ {geminiModels.length} ตัวเลือก)
                  </label>
                  <select
                    value={formData.ai_analysis.geminiModel}
                    onChange={(e) => handleAiInputChange('geminiModel', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {geminiModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. OpenAI Card with Auto Model Fetching */}
            <div className={`p-5 rounded-2xl border transition-all ${
              formData.ai_analysis.activeProvider === 'openai'
                ? 'bg-slate-800/70 border-indigo-500/60 ring-1 ring-indigo-500/30'
                : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-kanit font-semibold text-white text-sm">
                    OpenAI API Key (ChatGPT)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ดึงรายชื่อโมเดล GPT ทั้งหมดที่บัญชีของคุณมีสิทธิ์เข้าถึงให้อัตโนมัติ
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestAi('openai')}
                  disabled={testingAi === 'openai'}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                >
                  {testingAi === 'openai' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>ทดสอบ</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-medium">
                      OpenAI API Key
                    </label>
                    {formData.ai_analysis.openaiApiKey && (
                      <button
                        type="button"
                        onClick={() => handleFetchOpenAi(formData.ai_analysis.openaiApiKey)}
                        disabled={loadingOpenAiModels}
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingOpenAiModels ? 'animate-spin' : ''}`} />
                        <span>{loadingOpenAiModels ? 'กำลังดึงโมเดล...' : 'ดึงโมเดลอัตโนมัติ'}</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys.openai ? 'text' : 'password'}
                      value={formData.ai_analysis.openaiApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleAiInputChange('openaiApiKey', val);
                        if (val.startsWith('sk-') && val.length > 30) {
                          handleFetchOpenAi(val);
                        }
                      }}
                      onBlur={() => {
                        if (formData.ai_analysis.openaiApiKey.trim()) {
                          handleFetchOpenAi(formData.ai_analysis.openaiApiKey);
                        }
                      }}
                      placeholder="sk-proj-..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('openai')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    เลือกโมเดล (พบ {openaiModels.length} ตัวเลือก)
                  </label>
                  <select
                    value={formData.ai_analysis.openaiModel}
                    onChange={(e) => handleAiInputChange('openaiModel', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {openaiModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Anthropic Claude Card */}
            <div className={`p-5 rounded-2xl border transition-all ${
              formData.ai_analysis.activeProvider === 'anthropic'
                ? 'bg-slate-800/70 border-indigo-500/60 ring-1 ring-indigo-500/30'
                : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-kanit font-semibold text-white text-sm">
                    Anthropic Claude API Key
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    รองรับ Claude 3.5 Sonnet / Haiku สำหรับเขียนบทโทนธรรมชาติ
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestAi('anthropic')}
                  disabled={testingAi === 'anthropic'}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                >
                  {testingAi === 'anthropic' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>ทดสอบ</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-medium mb-1">
                    Anthropic API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKeys.anthropic ? 'text' : 'password'}
                      value={formData.ai_analysis.anthropicApiKey}
                      onChange={(e) => handleAiInputChange('anthropicApiKey', e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('anthropic')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showKeys.anthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    เลือกโมเดล
                  </label>
                  <select
                    value={formData.ai_analysis.anthropicModel}
                    onChange={(e) => handleAiInputChange('anthropicModel', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (เร็วมาก)</option>
                    <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (ระดับพรีเมียม)</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Voice Providers (PD Clone Voice, MiniMax, ElevenLabs) */}
        {activeTab === 'voice_tts' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

            {/* Card 1: PD Clone Voice */}
            <div 
              className={`rounded-2xl border p-5 transition-all ${
                activeProvider === 'pd_voice' 
                  ? 'bg-slate-800/70 border-indigo-500/60 ring-1 ring-indigo-500/30 shadow-lg' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectProvider('pd_voice')}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      activeProvider === 'pd_voice'
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {activeProvider === 'pd_voice' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-kanit font-semibold text-white text-base">
                        1) PD Clone Voice
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        แนะนำเสียงพากย์ไทย
                      </span>
                      {formData.pd_voice.apiKey.trim() ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-indigo-400" /> เชื่อมต่อแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-400" /> ยังไม่ได้ใส่ key
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ระบบโคลนเสียงภาษาไทยระดับสูง ให้ความเป็นธรรมชาติเหมือนคนพูดจริง
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestVoice('pd_voice')}
                  disabled={testingVoice === 'pd_voice'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all shadow-sm"
                >
                  {testingVoice === 'pd_voice' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>ทดสอบเสียง</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-medium">
                      API Key <span className="text-rose-400">*</span>
                    </label>
                    {formData.pd_voice.apiKey && (
                      <button
                        type="button"
                        onClick={() => handleFetchPdVoices(formData.pd_voice.apiKey, formData.pd_voice.endpoint)}
                        disabled={loadingPdVoices}
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingPdVoices ? 'animate-spin' : ''}`} />
                        <span>{loadingPdVoices ? 'กำลังดึงเสียง...' : 'ดึงเสียงอัตโนมัติ'}</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys.pd_voice ? 'text' : 'password'}
                      value={formData.pd_voice.apiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleVoiceInputChange('pd_voice', 'apiKey', val);
                        if (val.length > 10) {
                          handleFetchPdVoices(val, formData.pd_voice.endpoint);
                        }
                      }}
                      onBlur={() => {
                        if (formData.pd_voice.apiKey.trim()) {
                          handleFetchPdVoices(formData.pd_voice.apiKey, formData.pd_voice.endpoint);
                        }
                      }}
                      placeholder="กรอก PD Clone Voice API Key (เช่น pdvc_...)"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('pd_voice')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showKeys.pd_voice ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-medium">
                      เลือกเสียงในคลัง (พบ {pdVoices.length} เสียง)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      จาก GET /api/v1/voices
                    </span>
                  </div>
                  <select
                    value={formData.pd_voice.referenceId}
                    onChange={(e) => handleVoiceInputChange('pd_voice', 'referenceId', e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {pdVoices.map((v, i) => (
                      <option key={v.reference_id || `default-${i}`} value={v.reference_id}>
                        {v.name} {v.is_default && !v.name.includes('⭐') ? '(⭐ เสียงหลัก)' : ''}
                      </option>
                    ))}
                    <option value="custom">✏️ ระบุ Reference ID เองด้วยตนเอง...</option>
                  </select>
                </div>

                {formData.pd_voice.referenceId === 'custom' && (
                  <div className="md:col-span-2">
                    <label className="block text-slate-300 font-medium mb-1">
                      ระบุ Custom Reference ID
                    </label>
                    <input
                      type="text"
                      onChange={(e) => handleVoiceInputChange('pd_voice', 'referenceId', e.target.value)}
                      placeholder="เช่น 550a...c21"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400">
                  <div>
                    <span className="text-slate-300 font-medium">Endpoint: </span>
                    <code className="text-indigo-300">https://app.pd-voiceclone.com/api/v1/tts</code>
                  </div>
                  <span className="text-slate-400 italic">
                    *ส่ง Headers: X-API-Key และ Form-data: text, reference_id, speed, instruct
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: MiniMax */}
            <div 
              className={`rounded-2xl border p-5 transition-all ${
                activeProvider === 'minimax' 
                  ? 'bg-slate-800/70 border-indigo-500/60 ring-1 ring-indigo-500/30 shadow-lg' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectProvider('minimax')}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      activeProvider === 'minimax'
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {activeProvider === 'minimax' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-kanit font-semibold text-white text-base">
                        2) MiniMax TTS
                      </h4>
                      {formData.minimax.apiKey.trim() ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-indigo-400" /> เชื่อมต่อแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-400" /> ยังไม่ได้ใส่ key
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      เสียงโมเดล Speech-01 คุณภาพสูง เสียงใส คมชัด
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestVoice('minimax')}
                  disabled={testingVoice === 'minimax'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all shadow-sm"
                >
                  {testingVoice === 'minimax' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>ทดสอบเสียง</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    API Key <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showKeys.minimax ? 'text' : 'password'}
                      value={formData.minimax.apiKey}
                      onChange={(e) => handleVoiceInputChange('minimax', 'apiKey', e.target.value)}
                      placeholder="MiniMax API Key..."
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('minimax')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showKeys.minimax ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Group ID (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={formData.minimax.groupId}
                    onChange={(e) => handleVoiceInputChange('minimax', 'groupId', e.target.value)}
                    placeholder="เช่น 1234567890..."
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Voice Model
                  </label>
                  <select
                    value={formData.minimax.model}
                    onChange={(e) => handleVoiceInputChange('minimax', 'model', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="speech-01-turbo">speech-01-turbo (แนะนำ)</option>
                    <option value="speech-01-hd">speech-01-hd (ความละเอียดสูง)</option>
                    <option value="speech-01-260k">speech-01-260k</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 3: ElevenLabs with Auto Voice Fetching */}
            <div 
              className={`rounded-2xl border p-5 transition-all ${
                activeProvider === 'elevenlabs' 
                  ? 'bg-slate-800/70 border-indigo-500/60 ring-1 ring-indigo-500/30 shadow-lg' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectProvider('elevenlabs')}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      activeProvider === 'elevenlabs'
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {activeProvider === 'elevenlabs' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-kanit font-semibold text-white text-base">
                        3) ElevenLabs
                      </h4>
                      {formData.elevenlabs.apiKey.trim() ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-indigo-400" /> เชื่อมต่อแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-400" /> ยังไม่ได้ใส่ key
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ดึงรายชื่อเสียง (Voice IDs) ทั้งหมดจากบัญชี ElevenLabs ของคุณให้อัตโนมัติ
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestVoice('elevenlabs')}
                  disabled={testingVoice === 'elevenlabs'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all shadow-sm"
                >
                  {testingVoice === 'elevenlabs' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>ทดสอบเสียง</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-medium">
                      API Key <span className="text-rose-400">*</span>
                    </label>
                    {formData.elevenlabs.apiKey && (
                      <button
                        type="button"
                        onClick={() => handleFetchElevenLabs(formData.elevenlabs.apiKey)}
                        disabled={loadingElevenVoices}
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingElevenVoices ? 'animate-spin' : ''}`} />
                        <span>{loadingElevenVoices ? 'ดึงเสียง...' : 'ดึงเสียงอัตโนมัติ'}</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys.elevenlabs ? 'text' : 'password'}
                      value={formData.elevenlabs.apiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleVoiceInputChange('elevenlabs', 'apiKey', val);
                      }}
                      onBlur={() => {
                        if (formData.elevenlabs.apiKey.trim()) {
                          handleFetchElevenLabs(formData.elevenlabs.apiKey);
                        }
                      }}
                      placeholder="ElevenLabs API Key..."
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('elevenlabs')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showKeys.elevenlabs ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    เลือกเสียงพากย์ (พบ {elevenVoices.length} เสียง)
                  </label>
                  <select
                    value={formData.elevenlabs.voiceId}
                    onChange={(e) => handleVoiceInputChange('elevenlabs', 'voiceId', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {elevenVoices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Model
                  </label>
                  <select
                    value={formData.elevenlabs.model}
                    onChange={(e) => handleVoiceInputChange('elevenlabs', 'model', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="eleven_v3">eleven_v3 (แนะนำสำหรับภาษาไทย)</option>
                    <option value="eleven_turbo_v2_5">eleven_turbo_v2_5 (เร็ว แต่ไม่แนะนำสำหรับไทย)</option>
                    <option value="eleven_multilingual_v2" disabled>eleven_multilingual_v2 (ไม่รองรับภาษาไทย)</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4 border-t border-slate-800 bg-slate-900/80 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <div className="text-xs text-slate-400">
            AI ข้อความ: <span className="font-semibold text-cyan-300">{formData.ai_analysis.activeProvider.toUpperCase()}</span> | เสียง: <span className="font-semibold text-indigo-300">{activeProvider.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all"
            >
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
