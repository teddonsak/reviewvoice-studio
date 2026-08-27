import React, { useState, useRef, useEffect } from 'react';
import { 
  Volume2, 
  Play, 
  Pause, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Settings2, 
  Gauge, 
  Mic, 
  Radio, 
  Eye, 
  EyeOff,
  Sliders
} from 'lucide-react';
import { ProjectData, ProviderApiKeys, VoiceProviderType, VoiceSettings } from '../types';
import { generateVoiceoverAudio, fetchPdVoices, fetchElevenLabsVoices, PdVoiceItem } from '../services/ttsService';
import { alignSubtitlesToAudio } from '../services/speechAlignmentService';
import { alignFromTranscription } from '../services/transcriptionAlignmentService';

interface Step5VoiceProps {
  project: ProjectData;
  apiKeys: ProviderApiKeys;
  onUpdateProject: (updates: Partial<ProjectData>) => void;
  onUpdateApiKeys: (keys: ProviderApiKeys) => void;
  onNext: () => void;
  onPrev: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const Step5Voice: React.FC<Step5VoiceProps> = ({
  project,
  apiKeys,
  onUpdateProject,
  onUpdateApiKeys,
  onNext,
  onPrev,
  onNotify,
}) => {
  const [provider, setProvider] = useState<VoiceProviderType>(project.voiceSettings.provider || 'pd_voice');
  const [speed, setSpeed] = useState<number>(project.voiceSettings.speed ?? 1.22);
  const [tone, setTone] = useState<'cheerful' | 'friendly' | 'confident' | 'energetic'>(
    project.voiceSettings.tone || 'cheerful'
  );
  const [gender, setGender] = useState<'female' | 'male'>(project.voiceSettings.gender || 'female');
  const [keys, setKeys] = useState<ProviderApiKeys>(apiKeys);
  const [showKey, setShowKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(project.audioDuration || 0);

  // PD Voices live list
  const [pdVoices, setPdVoices] = useState<PdVoiceItem[]>([
    { reference_id: '', name: '⭐ ใช้เสียงหลักตามบัญชี (Default Voice)', is_default: true }
  ]);
  const [loadingPdVoices, setLoadingPdVoices] = useState(false);

  // ElevenLabs live list (avoid hardcoded 4 only)
  const [elevenVoices, setElevenVoices] = useState<Array<{ voice_id: string; name: string }>>([
    { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (ใช้กับ Eleven v3)' },
    { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Empathetic)' },
    { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Warm & Clear)' },
    { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Energetic)' },
  ]);
  const [loadingElevenVoices, setLoadingElevenVoices] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Auto-fetch PD Clone Voices
  const handleFetchPdVoices = async (key: string, endpoint?: string) => {
    if (!key.trim()) return;
    setLoadingPdVoices(true);
    try {
      const result = await fetchPdVoices(key, endpoint || keys.pd_voice.endpoint);
      if (result.voices && result.voices.length > 0) {
        setPdVoices([
          { reference_id: '', name: '⭐ ใช้เสียงหลักตามบัญชี (Default Voice)', is_default: true },
          ...result.voices
        ]);
        if (!keys.pd_voice.referenceId && result.default_reference_id) {
          handleKeyChange('referenceId', result.default_reference_id);
        }
        onNotify('success', 'ดึงรายการเสียง PD Clone Voice สำเร็จ!', `พบ ${result.voices.length} เสียงในคลังของคุณ`);
      } else {
        onNotify('info', 'เชื่อมต่อ PD Clone Voice สำเร็จ', 'บัญชีนี้ยังไม่มีเสียง Clone ในคลัง คุณยังใช้เสียงหลักของบัญชีหรือระบุ Reference ID เองได้');
      }
    } catch (err: any) {
      console.warn('Auto fetch PD voices error in Step5:', err);
      onNotify('error', 'ดึงเสียง PD Clone Voice ไม่สำเร็จ', err.message || 'กรุณาตรวจสอบ API Key และลองอีกครั้ง');
    } finally {
      setLoadingPdVoices(false);
    }
  };

  const handleFetchElevenLabs = async (key: string) => {
    if (!key.trim()) return;
    setLoadingElevenVoices(true);
    try {
      const voices = await fetchElevenLabsVoices(key);
      if (voices.length > 0) {
        setElevenVoices(voices);
        onNotify('success', 'ดึงรายชื่อเสียง ElevenLabs สำเร็จ!', `พบ ${voices.length} เสียงพร้อมใช้งาน`);
      } else {
        onNotify('info', 'เชื่อมต่อ ElevenLabs สำเร็จ', 'บัญชีนี้ยังไม่มีเสียงพร้อมใช้งาน');
      }
    } catch (err: any) {
      console.warn('Step5 fetch ElevenLabs voices error:', err);
      onNotify('error', 'ดึงรายชื่อเสียง ElevenLabs ไม่สำเร็จ', err.message || 'กรุณาตรวจสอบ API Key และสิทธิ์ Voices Read');
    } finally {
      setLoadingElevenVoices(false);
    }
  };

  useEffect(() => {
    if (keys.pd_voice.apiKey.trim()) {
      handleFetchPdVoices(keys.pd_voice.apiKey, keys.pd_voice.endpoint);
    }
    if (keys.elevenlabs.apiKey.trim()) {
      handleFetchElevenLabs(keys.elevenlabs.apiKey);
    }
  }, []);

  // Refetch when API key changes after mount (e.g., user pastes new key in this step)
  useEffect(() => {
    if (keys.elevenlabs.apiKey.trim()) {
      handleFetchElevenLabs(keys.elevenlabs.apiKey);
    }
  }, [keys.elevenlabs.apiKey]);

  // Migrate the former ElevenLabs default even when Step 5 was already open
  // before the settings migration ran (for example during hot reload).
  useEffect(() => {
    if (keys.elevenlabs.model === 'eleven_multilingual_v2') {
      const updated = {
        ...keys,
        elevenlabs: { ...keys.elevenlabs, model: 'eleven_v3' }
      };
      setKeys(updated);
      onUpdateApiKeys(updated);
    }
  }, [keys.elevenlabs.model]);

  // Sync state to parent on change
  useEffect(() => {
    const updatedSettings: VoiceSettings = {
      provider,
      speed,
      tone,
      gender,
      language: 'th'
    };
    onUpdateProject({ voiceSettings: updatedSettings });
  }, [provider, speed, tone, gender]);

  const handleKeyChange = (field: string, value: string) => {
    const updated = {
      ...keys,
      [provider]: {
        ...keys[provider],
        [field]: value
      }
    };
    setKeys(updated);
    onUpdateApiKeys(updated);
  };

  const handleGenerateVoice = async () => {
    const ttsText = project.dualScript.ttsScript || project.reviewScript.fullText;
    if (!ttsText.trim()) {
      onNotify('error', 'ไม่พบสคริปต์เสียง', 'กรุณากลับไปสร้างบทรีวิวใน Step 3 ก่อน');
      return;
    }

    setIsGenerating(true);
    try {
      const voiceSettings: VoiceSettings = {
        provider,
        speed,
        tone,
        gender,
        language: 'th'
      };

      const result = await generateVoiceoverAudio(ttsText, voiceSettings, keys);

      // The spoken script may contain phonetic Thai while the subtitle script
      // intentionally keeps brand names and numbers. Always align the text the
      // viewer should actually see to the generated audio.
      const subtitleText = project.dualScript.subtitleScript || project.reviewScript.fullText || ttsText;
      let transcriptAlignment = null;
      try {
        transcriptAlignment = await alignFromTranscription(
          subtitleText, ttsText, result.audioBlob, keys
        );
      } catch (error) {
        console.warn('Word-level auto sync unavailable; using audio envelope.', error);
      }
      const displayTimings = transcriptAlignment?.timings || await alignSubtitlesToAudio(
        subtitleText, result.duration, result.audioBlob
      );

      onUpdateProject({
        generatedAudioUrl: result.audioUrl,
        audioBlob: result.audioBlob,
        audioDuration: result.duration,
        wordTimings: displayTimings,
        status: 'voiced'
      });

      setDuration(result.duration);
      setIsGenerating(false);
      onNotify(
        'success',
        'สร้างเสียงพากย์รีวิวสำเร็จ!',
        transcriptAlignment
          ? `ความยาว ${Math.round(result.duration)} วินาที พร้อม Auto Sync ซับตรงคำพูดแล้ว`
          : `ความยาว ${Math.round(result.duration)} วินาที พร้อมซิงค์ตามช่วงเสียง (เพิ่ม OpenAI หรือ ElevenLabs Key เพื่อซิงค์ระดับคำ)`
      );
    } catch (err: any) {
      setIsGenerating(false);
      onNotify('error', 'สร้างเสียงพากย์ล้มเหลว', err.message || 'โปรดตรวจสอบการตั้งค่า API Key');
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Draw Audio Waveform Visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bars = 48;
    const barWidth = width / bars - 2;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < bars; i++) {
        const progress = duration > 0 ? currentTime / duration : 0;
        const barProgress = i / bars;
        const isPast = barProgress <= progress;

        // Dynamic wave height
        let barHeight = Math.sin(i * 0.35 + (isPlaying ? Date.now() * 0.008 : 0)) * 0.4 + 0.5;
        barHeight = Math.max(0.15, barHeight) * (height * 0.85);

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        if (isPast) {
          ctx.fillStyle = '#6366f1'; // Indigo for played
        } else {
          ctx.fillStyle = '#334155'; // Slate for unplayed
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, currentTime, duration]);

  const hasCurrentKey = () => {
    if (provider === 'pd_voice') return Boolean(keys.pd_voice.apiKey.trim());
    if (provider === 'minimax') return Boolean(keys.minimax.apiKey.trim());
    if (provider === 'elevenlabs') return Boolean(keys.elevenlabs.apiKey.trim());
    return false;
  };

  const [testingSampleVoice, setTestingSampleVoice] = useState(false);

  const handleTestSampleVoice = async () => {
    setTestingSampleVoice(true);
    const testText = gender === 'male'
      ? 'สวัสดีครับ ยินดีต้อนรับสู่ ReviewVoice Studio ระบบพากย์เสียงรีวิวสินค้าไทยครับ'
      : 'สวัสดีค่ะ ยินดีต้อนรับสู่ ReviewVoice Studio ระบบพากย์เสียงรีวิวสินค้าไทยค่ะ';
    try {
      const voiceSettings: VoiceSettings = {
        provider,
        speed,
        tone,
        gender,
        language: 'th'
      };
      const result = await generateVoiceoverAudio(testText, voiceSettings, keys);
      const audio = new Audio(result.audioUrl);
      await audio.play();
      onNotify('success', `ทดสอบเสียง ${provider.toUpperCase()} สำเร็จ!`, 'กำลังเล่นตัวอย่างเสียงโคลนจริงของคุณ');
    } catch (err: any) {
      onNotify('error', 'ทดสอบเสียงล้มเหลว', err.message || 'โปรดตรวจสอบความถูกต้องของ API Key');
    } finally {
      setTestingSampleVoice(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              5
            </span>
            Step 5: เลือกเสียงพากย์ + ตั้งค่า (Voice Provider & TTS)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            เลือกผู้ให้บริการเสียงพากย์ AI ภาษาไทย ปรับสปีดและความสดใสของน้ำเสียง
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateVoice}
          disabled={isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all self-start sm:self-auto disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังสร้างเสียงพากย์...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>สร้างเสียงพากย์ตามบท</span>
            </>
          )}
        </button>
      </div>

      {/* 3 Distinct Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: PD Clone Voice */}
        <div
          onClick={() => setProvider('pd_voice')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            provider === 'pd_voice'
              ? 'bg-slate-800/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
              PD
            </div>
            {provider === 'pd_voice' ? (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                ✓
              </span>
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-700" />
            )}
          </div>
          <h3 className="text-sm font-bold text-white font-kanit">
            1) PD Clone Voice
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            เสียงโคลนไทยธรรมชาติ จังหวะสมจริง เหมาะสำหรับรีวิว TikTok
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-emerald-400 font-medium">แนะนำภาษาไทย</span>
            <span className="text-slate-400">multipart/form-data</span>
          </div>
        </div>

        {/* Card 2: MiniMax */}
        <div
          onClick={() => setProvider('minimax')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            provider === 'minimax'
              ? 'bg-slate-800/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
              MM
            </div>
            {provider === 'minimax' ? (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                ✓
              </span>
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-700" />
            )}
          </div>
          <h3 className="text-sm font-bold text-white font-kanit">
            2) MiniMax TTS
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            โมเดล Speech-01 เสียงใส คมชัด ให้ความรู้สึกทันสมัย
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-cyan-400 font-medium">Speed 0.9-1.3</span>
            <span className="text-slate-400">JSON API</span>
          </div>
        </div>

        {/* Card 3: ElevenLabs */}
        <div
          onClick={() => setProvider('elevenlabs')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            provider === 'elevenlabs'
              ? 'bg-slate-800/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs">
              11L
            </div>
            {provider === 'elevenlabs' ? (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                ✓
              </span>
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-700" />
            )}
          </div>
          <h3 className="text-sm font-bold text-white font-kanit">
            3) ElevenLabs
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Eleven v3 รองรับภาษาไทยโดยตรง ให้จังหวะและอารมณ์เป็นธรรมชาติกว่า
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-violet-400 font-medium">Eleven v3 · Thai</span>
            <span className="text-slate-400">70+ Languages</span>
          </div>
        </div>

      </div>

      {/* Dynamic API Key Box for the SELECTED Provider ONLY */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white font-kanit">
              การตั้งค่า API Key สำหรับ {provider === 'pd_voice' ? 'PD Clone Voice' : provider === 'minimax' ? 'MiniMax' : 'ElevenLabs'}
            </h4>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestSampleVoice}
              disabled={testingSampleVoice}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {testingSampleVoice ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-white" />
              )}
              <span>ทดสอบเสียงสั้นๆ</span>
            </button>

            {hasCurrentKey() ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> เชื่อมต่อแล้ว
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" /> ยังไม่มี Key
              </span>
            )}
          </div>
        </div>

        {/* 1. Fields for PD Voice */}
        {provider === 'pd_voice' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-medium">
                  PD Clone Voice API Key
                </label>
                {keys.pd_voice.apiKey && (
                  <button
                    type="button"
                    onClick={() => handleFetchPdVoices(keys.pd_voice.apiKey, keys.pd_voice.endpoint)}
                    disabled={loadingPdVoices}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    <Loader2 className={`w-3 h-3 ${loadingPdVoices ? 'animate-spin' : 'hidden'}`} />
                    <span>{loadingPdVoices ? 'กำลังดึงเสียง...' : '🔄 ดึงเสียงอัตโนมัติ'}</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keys.pd_voice.apiKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleKeyChange('apiKey', val);
                    if (val.length > 10) {
                      handleFetchPdVoices(val, keys.pd_voice.endpoint);
                    }
                  }}
                  onBlur={() => {
                    if (keys.pd_voice.apiKey.trim()) {
                      handleFetchPdVoices(keys.pd_voice.apiKey, keys.pd_voice.endpoint);
                    }
                  }}
                  placeholder="กรอก PD Clone Voice API Key (เช่น pdvc_...)"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-medium">
                  เลือกเสียงในคลัง (พบ {pdVoices.length} เสียง)
                </label>
                <span className="text-[10px] text-slate-400">
                  GET /api/v1/voices
                </span>
              </div>
              <select
                value={keys.pd_voice.referenceId}
                onChange={(e) => handleKeyChange('referenceId', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                {pdVoices.map((v, i) => (
                  <option key={v.reference_id || `pd-voice-${i}`} value={v.reference_id}>
                    {v.name} {v.is_default && !v.name.includes('⭐') ? '(⭐ เสียงหลัก)' : ''}
                  </option>
                ))}
                <option value="custom">✏️ ระบุ Reference ID เอง...</option>
              </select>
            </div>

            {keys.pd_voice.referenceId === 'custom' && (
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-medium mb-1">
                  ระบุ Custom Reference ID
                </label>
                <input
                  type="text"
                  onChange={(e) => handleKeyChange('referenceId', e.target.value)}
                  placeholder="เช่น 550a...c21"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        )}

        {/* 2. Fields for MiniMax */}
        {provider === 'minimax' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                MiniMax API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keys.minimax.apiKey}
                  onChange={(e) => handleKeyChange('apiKey', e.target.value)}
                  placeholder="กรอก MiniMax API Key..."
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Group ID (ถ้ามี)
              </label>
              <input
                type="text"
                value={keys.minimax.groupId}
                onChange={(e) => handleKeyChange('groupId', e.target.value)}
                placeholder="Group ID..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Voice Model
              </label>
              <input
                type="text"
                value={keys.minimax.model}
                onChange={(e) => handleKeyChange('model', e.target.value)}
                placeholder="speech-01-turbo"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* 3. Fields for ElevenLabs */}
        {provider === 'elevenlabs' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                ElevenLabs API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keys.elevenlabs.apiKey}
                  onChange={(e) => handleKeyChange('apiKey', e.target.value)}
                  placeholder="ElevenLabs API Key..."
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-medium">
                  Voice ID / รหัสเสียง
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {loadingElevenVoices ? 'กำลังดึง...' : `พบ ${elevenVoices.length} เสียง`}
                  </span>
                  {keys.elevenlabs.apiKey.trim() && (
                    <button
                      type="button"
                      onClick={() => handleFetchElevenLabs(keys.elevenlabs.apiKey)}
                      disabled={loadingElevenVoices}
                      className="text-[10px] px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                    >
                      {loadingElevenVoices ? '...' : '🔄 ดึงใหม่'}
                    </button>
                  )}
                </div>
              </div>
              <select
                value={elevenVoices.some(v => v.voice_id === keys.elevenlabs.voiceId) || keys.elevenlabs.voiceId === 'custom' ? keys.elevenlabs.voiceId : (elevenVoices[0]?.voice_id || keys.elevenlabs.voiceId)}
                onChange={(e) => handleKeyChange('voiceId', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                {elevenVoices.map(v => (
                  <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                ))}
                <option value="custom">รหัสเสียง Custom อื่นๆ</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Model
              </label>
              <select
                value={keys.elevenlabs.model}
                onChange={(e) => handleKeyChange('model', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="eleven_v3">eleven_v3 (แนะนำสำหรับภาษาไทย)</option>
                <option value="eleven_turbo_v2_5">eleven_turbo_v2_5 (เร็ว แต่ไม่แนะนำสำหรับไทย)</option>
                <option value="eleven_multilingual_v2" disabled>eleven_multilingual_v2 (ไม่รองรับภาษาไทย)</option>
              </select>
            </div>
          </div>
        )}

      </div>

      {/* Voice Controls: Speed, Tone, Language */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
        
        {/* Speed Slider (0.9 - 1.3, default 1.22) */}
        <div className="md:col-span-6 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-indigo-400" />
              ความเร็วเสียง (Speech Speed):
            </span>
            <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
              {speed.toFixed(2)}x {speed === 1.22 ? '(ค่าเริ่มต้นแนะนำ)' : ''}
            </span>
          </div>

          <input
            type="range"
            min="0.9"
            max="1.3"
            step="0.01"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />

          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0.9x ช้า/สบาย</span>
            <span className="text-indigo-400">1.22x พอดีคลิปรีวิว</span>
            <span>1.30x เร็ว/กระชับ</span>
          </div>
        </div>

        {/* Tone Selector */}
        <div className="md:col-span-4 space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            โทนเสียง (Voice Tone):
          </label>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setTone('cheerful')}
              className={`p-2 rounded-lg border text-center transition-all ${
                tone === 'cheerful'
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              สดใส
            </button>
            <button
              type="button"
              onClick={() => setTone('friendly')}
              className={`p-2 rounded-lg border text-center transition-all ${
                tone === 'friendly'
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              เป็นกันเอง
            </button>
            <button
              type="button"
              onClick={() => setTone('confident')}
              className={`p-2 rounded-lg border text-center transition-all ${
                tone === 'confident'
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              มั่นใจ
            </button>
          </div>
        </div>

        {/* Narrator gender */}
        <div className="md:col-span-2 space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            ผู้บรรยาย:
          </label>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => setGender('female')} className={`p-2 rounded-lg border text-xs ${gender === 'female' ? 'bg-indigo-600/30 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>หญิง</button>
            <button type="button" onClick={() => setGender('male')} className={`p-2 rounded-lg border text-xs ${gender === 'male' ? 'bg-indigo-600/30 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>ชาย</button>
          </div>
        </div>

      </div>

      {/* Waveform Player & Preview */}
      {project.generatedAudioUrl && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-indigo-500/40 shadow-2xl space-y-4">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h4 className="text-sm font-bold text-white font-kanit">
                เสียงพากย์พร้อมใช้งาน ({Math.round(duration)} วินาที)
              </h4>
            </div>
            <span className="text-xs text-indigo-300 font-medium">
              ผู้ให้บริการ: {provider.toUpperCase()}
            </span>
          </div>

          <audio
            ref={audioRef}
            src={project.generatedAudioUrl}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setIsPlaying(false)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          />

          {/* Waveform Canvas */}
          <div className="h-16 bg-slate-950/80 rounded-xl p-2 border border-slate-800 flex items-center justify-center">
            <canvas ref={canvasRef} width={600} height={60} className="w-full h-full" />
          </div>

          {/* Audio Controls */}
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={togglePlay}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 transition-all"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'หยุดชั่วคราว' : 'เล่นเสียงพากย์'}</span>
            </button>

            <div className="text-xs text-slate-400 font-mono">
              {Math.floor(currentTime)}s / {Math.floor(duration)}s
            </div>
          </div>

        </div>
      )}

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
          <span>ถัดไป: ตั้งค่าซับไตเติ้ล</span>
          <span className="font-bold">→</span>
        </button>
      </div>

    </div>
  );
};
