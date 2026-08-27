import React, { useState, useRef, useEffect } from 'react';
import { 
  Type, 
  Palette, 
  Layers, 
  Sliders, 
  Play, 
  Pause, 
  RotateCcw, 
  Eye, 
  Check,
  FastForward,
  Rewind,
  Music,
  Sparkles,
  WandSparkles
} from 'lucide-react';
import { ProjectData, ProviderApiKeys, SubtitleSettings, WordTiming } from '../types';
import { drawKaraokeSubtitles } from '../services/videoRenderer';
import { generateSubtitleSegments } from '../services/thaiConverter';
import { alignSubtitlesToAudio } from '../services/speechAlignmentService';
import { alignFromTranscription } from '../services/transcriptionAlignmentService';

interface Step6SubtitlesProps {
  project: ProjectData;
  apiKeys: ProviderApiKeys;
  onUpdateProject: (updates: Partial<ProjectData>) => void;
  onNext: () => void;
  onPrev: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const Step6Subtitles: React.FC<Step6SubtitlesProps> = ({
  project,
  apiKeys,
  onUpdateProject,
  onNext,
  onPrev,
  onNotify,
}) => {
  const [settings, setSettings] = useState<SubtitleSettings>(project.subtitleSettings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [syncOffset, setSyncOffset] = useState(0);
  const [isAligning, setIsAligning] = useState(false);
  const hasAutoAlignedRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [wordTimings, setWordTimings] = useState<WordTiming[]>(() => {
    return project.wordTimings && project.wordTimings.length > 0 
      ? project.wordTimings 
      : generateSubtitleSegments(
          project.dualScript.subtitleScript || project.reviewScript.fullText, 
          project.audioDuration || project.videoDuration || 12
        );
  });
  const [baseTimings, setBaseTimings] = useState<WordTiming[]>(wordTimings);

  const handleSettingChange = (field: keyof SubtitleSettings, value: any) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    onUpdateProject({ subtitleSettings: updated });
  };

  const handleSyncOffsetChange = (newOffset: number) => {
    setSyncOffset(newOffset);
    const duration = project.audioDuration || project.videoDuration || 12;
    const shifted = baseTimings.map(item => ({
      ...item,
      start: Math.max(0, Math.min(duration, item.start + newOffset)),
      end: Math.max(.08, Math.min(duration, item.end + newOffset))
    }));
    setWordTimings(shifted);
    onUpdateProject({ wordTimings: shifted });
  };

  const runSmartAlignment = async (notify = true) => {
    const text = project.dualScript.subtitleScript || project.reviewScript.fullText || project.dualScript.ttsScript;
    if (!text.trim()) return;
    setIsAligning(true);
    try {
      let transcriptResult = null;
      let transcriptError: unknown = null;
      if (project.audioBlob) {
        try {
          transcriptResult = await alignFromTranscription(
            text,
            project.dualScript.ttsScript || project.reviewScript.fullText || text,
            project.audioBlob,
            apiKeys
          );
        } catch (error) {
          transcriptError = error;
          console.warn('Word-level auto sync unavailable; using audio envelope.', error);
        }
      }
      const aligned = transcriptResult?.timings || await alignSubtitlesToAudio(
        text, project.audioDuration || project.videoDuration || 12, project.audioBlob
      );
      setBaseTimings(aligned);
      setWordTimings(aligned);
      setSyncOffset(0);
      onUpdateProject({ wordTimings: aligned });
      if (notify) onNotify(
        transcriptError ? 'info' : 'success',
        transcriptResult ? 'ซิงค์ตรงคำพูดสำเร็จ' : 'ซิงค์ตามช่วงเสียงสำเร็จ',
        transcriptResult
          ? `ถอดเสียงและจับเวลาคำจริงอัตโนมัติแล้ว ${aligned.length} ประโยค`
          : transcriptError
            ? `ระบบซิงค์ระดับคำใช้งานไม่ได้ จึงใช้ช่วงเสียงแทน: ${(transcriptError as Error).message}`
            : `ตรวจจับช่วงพูดแล้ว ${aligned.length} ประโยค — เพิ่ม OpenAI หรือ ElevenLabs Key เพื่อซิงค์ระดับคำ`
      );
    } catch (error: any) {
      if (notify) onNotify('error', 'ซิงค์เสียงไม่สำเร็จ', error.message || 'กรุณาลองอีกครั้ง');
    } finally { setIsAligning(false); }
  };

  useEffect(() => {
    if (hasAutoAlignedRef.current || !project.audioBlob) return;
    hasAutoAlignedRef.current = true;
    void runSmartAlignment(false);
  }, [project.audioBlob]);

  const updateTiming = (index: number, field: 'start' | 'end', value: number) => {
    const duration = project.audioDuration || project.videoDuration || 12;
    const updated = wordTimings.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === 'start') return { ...item, start: Math.max(0, Math.min(item.end - .08, value)) };
      return { ...item, end: Math.min(duration, Math.max(item.start + .08, value)) };
    });
    setWordTimings(updated);
    setBaseTimings(updated);
    setSyncOffset(0);
    onUpdateProject({ wordTimings: updated });
  };

  const seekToTiming = (item: WordTiming) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = item.start;
    if (audioRef.current) audioRef.current.currentTime = item.start;
    setCurrentTime(item.start);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      if (audio) audio.pause();
      setIsPlaying(false);
    } else {
      if (audio && project.generatedAudioUrl) {
        audio.currentTime = video.currentTime;
        audio.play().catch(() => {});
      }
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Sync audio with video time
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    setCurrentTime(t);
    if (audioRef.current && Math.abs(audioRef.current.currentTime - t) > 0.3) {
      audioRef.current.currentTime = t;
    }
  };

  // Live Canvas Subtitle Overlay Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (video.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
      }
      const w = canvas.width;
      const h = canvas.height;

      // Draw current video frame
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
      }

      // Draw Karaoke Subtitles on top!
      drawKaraokeSubtitles(ctx, video.currentTime, wordTimings, settings, w, h);

      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, currentTime, settings, wordTimings]);

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              6
            </span>
            Step 6: ตั้งค่าซับไตเติ้ล (Karaoke Subtitle Styler)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            ปรับแต่งขนาดฟอนต์ ตำแหน่ง และสีไฮไลต์สไตล์คาราโอเกะแบบเรียลไทม์บนตัวอย่างวิดีโอ
          </p>
        </div>

        <button
          type="button"
          onClick={togglePlay}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20 transition-all self-start sm:self-auto"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isPlaying ? 'หยุดชั่วคราว' : 'ดูตัวอย่างซับวิ่งสด'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Interactive Live Video Subtitle Preview */}
        <div className="lg:col-span-6 flex flex-col items-center bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          
          <div className="flex items-center justify-between w-full mb-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
              <Eye className="w-4 h-4" /> Live Preview ซับคาราโอเกะ
            </span>
            <span>{Math.round(currentTime)}s / {Math.round(project.videoDuration || 12)}s</span>
          </div>

          <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-[9/16] rounded-xl overflow-hidden bg-black shadow-2xl border border-slate-700/80">
            
            {/* Hidden Video Feed */}
            <video
              ref={videoRef}
              src={project.videoUrl}
              loop
              playsInline
              muted
              onTimeUpdate={handleTimeUpdate}
              className="hidden"
            />

            {/* Hidden Audio Feed for Live Sound Sync in Step 6 Preview */}
            {project.generatedAudioUrl && (
              <audio
                ref={audioRef}
                src={project.generatedAudioUrl}
                playsInline
                className="hidden"
              />
            )}

            {/* Composite Canvas for video + burned karaoke subtitles */}
            <canvas
              ref={canvasRef}
              width={1080}
              height={1920}
              className="w-full h-full object-contain"
            />

            {/* Play Overlay Button */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl backdrop-blur-sm transition-transform hover:scale-110"
              >
                <Play className="w-6 h-6 fill-current ml-1" />
              </button>
            )}

          </div>

          <p className="text-[11px] text-slate-400 mt-3 text-center flex items-center justify-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-cyan-400" />
            <span>กดเล่นเพื่อตรวจซับกับเสียงจริง และปรับรายประโยคได้ด้านล่าง</span>
          </p>

          {/* Subtitle Audio Sync Fine-Tuning Box */}
          <div className="w-full mt-4 p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                🎛️ ปรับจูนจังหวะเวลาซับกับเสียง (Sync Offset):
              </span>
              <span className="font-bold text-xs px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 font-mono">
                {syncOffset > 0 ? `+${syncOffset.toFixed(2)}s` : `${syncOffset.toFixed(2)}s`}
              </span>
            </div>

            <input
              type="range"
              min="-1.5"
              max="1.5"
              step="0.05"
              value={syncOffset}
              onChange={(e) => handleSyncOffsetChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
              <button
                type="button"
                onClick={() => handleSyncOffsetChange(Number((syncOffset - 0.15).toFixed(2)))}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                ⏪ ให้ซับขึ้นไวกว่าเดิม 0.15s
              </button>

              <button
                type="button"
                onClick={() => void runSmartAlignment()}
                disabled={isAligning}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800"
              >
                {isAligning ? 'กำลังถอดเสียงและจับเวลา…' : '🎯 Auto Sync ตรงคำพูด'}
              </button>

              <button
                type="button"
                onClick={() => handleSyncOffsetChange(Number((syncOffset + 0.15).toFixed(2)))}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                ⏩ ให้ซับขึ้นช้ากว่าเดิม 0.15s
              </button>
            </div>
          </div>

          <div className="w-full mt-4 rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <WandSparkles className="w-3.5 h-3.5 text-violet-400" /> จังหวะรายประโยค
              </span>
              <span className="text-[10px] text-slate-500">แตะประโยคเพื่อดูตำแหน่งจริง</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/70">
              {wordTimings.map((item, index) => {
                const active = currentTime >= item.start && currentTime <= item.end;
                return (
                  <div key={`${index}-${item.word}`} className={`p-2.5 transition-colors ${active ? 'bg-indigo-500/15' : ''}`}>
                    <button type="button" onClick={() => seekToTiming(item)} className="w-full text-left text-[11px] text-slate-200 hover:text-white truncate mb-2">
                      <span className="text-slate-500 mr-2">{index + 1}</span>{item.word}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      {(['start', 'end'] as const).map(field => (
                        <label key={field} className="flex items-center gap-1.5 text-[9px] text-slate-500">
                          {field === 'start' ? 'เริ่ม' : 'จบ'}
                          <input type="number" min="0" step="0.05" value={item[field].toFixed(2)}
                            onChange={event => updateTiming(index, field, Number(event.target.value))}
                            className="min-w-0 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-cyan-200 font-mono focus:outline-none focus:border-cyan-500" />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right: Subtitle Settings Controls */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Preset Themes Selector (1-Click Pro Themes) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                🎨 ธีมสไตล์ซับสำเร็จรูป (Preset Subtitle Themes):
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { 
                  name: '🟡 TikTok Gold', 
                  fontFamily: 'Kanit', 
                  fontSize: 84, 
                  highlightColor: '#FACC15', 
                  textColor: '#FFFFFF', 
                  strokeColor: '#000000', 
                  strokeWidth: 8, 
                  fontWeight: '800' as const, 
                  showBadge: true, 
                  styleMode: 'karaoke' as const 
                },
                { 
                  name: '🟢 Neon Cyber', 
                  fontFamily: 'Chakra Petch', 
                  fontSize: 84, 
                  highlightColor: '#22C55E', 
                  textColor: '#FFFFFF', 
                  strokeColor: '#000000', 
                  strokeWidth: 8, 
                  fontWeight: '700' as const, 
                  showBadge: true, 
                  styleMode: 'karaoke' as const 
                },
                { 
                  name: '💎 Diamond Cyan', 
                  fontFamily: 'Prompt', 
                  fontSize: 80, 
                  highlightColor: '#38BDF8', 
                  textColor: '#FFFFFF', 
                  strokeColor: '#000000', 
                  strokeWidth: 8, 
                  fontWeight: '800' as const, 
                  showBadge: true, 
                  styleMode: 'karaoke' as const 
                },
                { 
                  name: '🔥 Hot Pink Pop', 
                  fontFamily: 'Kanit', 
                  fontSize: 84, 
                  highlightColor: '#F43F5E', 
                  textColor: '#FFFFFF', 
                  strokeColor: '#000000', 
                  strokeWidth: 8, 
                  fontWeight: '800' as const, 
                  showBadge: true, 
                  styleMode: 'karaoke' as const 
                },
                { 
                  name: '🧸 Cute Blogger', 
                  fontFamily: 'Itim', 
                  fontSize: 84, 
                  highlightColor: '#FBBF24', 
                  textColor: '#FFFFFF', 
                  strokeColor: '#000000', 
                  strokeWidth: 6, 
                  fontWeight: '400' as const, 
                  showBadge: true, 
                  styleMode: 'karaoke' as const 
                },
                { 
                  name: '💬 Minimal Clean', 
                  fontFamily: 'Prompt', 
                  fontSize: 68, 
                  highlightColor: '#FACC15', 
                  textColor: '#FFFFFF', 
                  strokeColor: '#000000', 
                  strokeWidth: 4, 
                  fontWeight: '600' as const, 
                  showBadge: false, 
                  styleMode: 'standard' as const 
                },
              ].map((theme) => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => {
                    const updated = { ...settings, ...theme };
                    setSettings(updated);
                    onUpdateProject({ subtitleSettings: updated });
                  }}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    settings.fontFamily === theme.fontFamily && settings.highlightColor === theme.highlightColor && settings.styleMode === theme.styleMode
                      ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/50 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="text-xs">{theme.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{theme.fontFamily}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Thai Font Selector & Custom Font Upload */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-indigo-400" />
                🔤 เลือกฟอนต์ภาษาไทย (Thai Fonts):
              </span>
              <label className="cursor-pointer text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40 transition-colors">
                <span>+ อัปโหลดฟอนต์ (.ttf/.otf)</span>
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const fontName = `Custom_${file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')}`;
                        const fontBuffer = await file.arrayBuffer();
                        const fontFace = new FontFace(fontName, fontBuffer);
                        await fontFace.load();
                        document.fonts.add(fontFace);
                        handleSettingChange('fontFamily', fontName);
                        onNotify('success', 'โหลดฟอนต์สำเร็จ!', `นำเข้าฟอนต์ "${file.name}" เข้าสู่ระบบเรียบร้อย`);
                      } catch (err: any) {
                        onNotify('error', 'นำเข้าฟอนต์ล้มเหลว', err.message || 'ไฟล์ฟอนต์ไม่ถูกต้อง');
                      }
                    }
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {[
                { id: 'Kanit', name: 'Kanit (คณิต)', desc: 'TikTok ยอดฮิต ตัวหนา' },
                { id: 'Prompt', name: 'Prompt (พร้อม)', desc: 'โมเดิร์น เรียบหรู' },
                { id: 'Mitr', name: 'Mitr (มิตร)', desc: 'อ่านง่าย สบายตา' },
                { id: 'Itim', name: 'Itim (ไอติม)', desc: 'น่ารัก ลายมือกึ่งเป็นกันเอง' },
                { id: 'Chakra Petch', name: 'Chakra Petch', desc: 'เหลี่ยมเท่ สไตล์ไอที' },
                { id: 'Noto Sans Thai', name: 'Noto Sans', desc: 'มาตรฐานสากล คมชัด' },
                { id: 'Sarabun', name: 'Sarabun', desc: 'ทางการ เรียบร้อย' },
                { id: 'Pattaya', name: 'Pattaya', desc: 'โดดเด่น มีลูกเล่น' },
                { id: 'Charm', name: 'Charm', desc: 'ตัวเขียน ลักชูรี่' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSettingChange('fontFamily', f.id)}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    settings.fontFamily === f.id
                      ? 'bg-indigo-600/40 border-indigo-500 text-white ring-1 ring-indigo-500/40 font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                  style={{ fontFamily: f.id }}
                >
                  <div className="text-xs truncate">{f.name}</div>
                  <div className="text-[9px] text-slate-400 truncate font-sans">{f.desc}</div>
                </button>
              ))}
            </div>

            {/* Font Weight Selector */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-slate-400">ความหนาของตัวอักษร:</span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'ปกติ (400)', weight: '400' as const },
                  { label: 'หนา (700)', weight: '700' as const },
                  { label: 'หนาพิเศษ (800)', weight: '800' as const },
                  { label: 'Black (900)', weight: '900' as const },
                ].map((w) => (
                  <button
                    key={w.weight}
                    type="button"
                    onClick={() => handleSettingChange('fontWeight', w.weight)}
                    className={`px-2 py-1 rounded text-[10px] border transition-all ${
                      (settings.fontWeight || '800') === w.weight
                        ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Font Size (Expanded 20px - 120px with presets) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-indigo-400" />
                ขนาดฟอนต์ (Font Size):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={settings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', Math.max(20, Math.min(120, parseInt(e.target.value, 10) || 20)))}
                  className="w-16 bg-slate-950 border border-slate-700 rounded-md px-2 py-0.5 text-center text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400">px</span>
              </div>
            </div>

            <input
              type="range"
              min="20"
              max="120"
              step="2"
              value={settings.fontSize}
              onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />

            {/* Quick Size Presets */}
            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {[
                { label: '32px (จิ๋ว)', size: 32 },
                { label: '48px (เล็ก)', size: 48 },
                { label: '64px (กลาง)', size: 64 },
                { label: '84px (TikTok)', size: 84 },
                { label: '100px (ใหญ่)', size: 100 },
              ].map((p) => (
                <button
                  key={p.size}
                  type="button"
                  onClick={() => handleSettingChange('fontSize', p.size)}
                  className={`py-1 px-1 rounded text-[10px] text-center border transition-all truncate ${
                    settings.fontSize === p.size
                      ? 'bg-indigo-600/40 border-indigo-500 text-white font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stroke / Outline Width & Stroke Color */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                ความหนาเส้นขอบตัวหนังสือ (Stroke Outline):
              </span>
              <span className="font-bold text-xs px-2 py-0.5 rounded bg-slate-950 text-cyan-300 font-mono">
                {typeof settings.strokeWidth === 'number' ? settings.strokeWidth : 8}px
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="18"
              step="1"
              value={typeof settings.strokeWidth === 'number' ? settings.strokeWidth : 8}
              onChange={(e) => handleSettingChange('strokeWidth', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Subtitle Style Mode: Karaoke vs Standard */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              รูปแบบการแสดงซับไตเติ้ล (Subtitle Display Mode):
            </label>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => handleSettingChange('styleMode', 'karaoke')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  settings.styleMode !== 'standard'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-500/50 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                  🎤
                </div>
                <div>
                  <div className="font-bold text-white text-xs">สไตล์ คาราโอเกะ</div>
                  <div className="text-[10px] text-slate-400">ไฮไลต์สีวิ่งทีละคำตามเสียงพูด</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSettingChange('styleMode', 'standard')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  settings.styleMode === 'standard'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-500/50 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0">
                  💬
                </div>
                <div>
                  <div className="font-bold text-white text-xs">สไตล์ ซับปกติ</div>
                  <div className="text-[10px] text-slate-400">ซับคมชัดนิ่ง สไตล์มินิมอล</div>
                </div>
              </button>
            </div>
          </div>

          {/* Words per chunk/line (จำนวนคำต่อครั้ง) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                จำนวนคำต่อครั้ง / บรรทัด (Words per line):
              </span>
              <span className="font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                {settings.wordsPerLine || 3} คำต่อแถว
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 text-xs">
              {[
                { label: '1 คำ', count: 1, desc: 'TikTok Pop' },
                { label: '2 คำ', count: 2, desc: 'กระชับมาก' },
                { label: '3 คำ', count: 3, desc: 'แนะนำ' },
                { label: '4 คำ', count: 4, desc: 'มาตรฐาน' },
                { label: '5 คำ', count: 5, desc: 'ประโยคยาว' },
              ].map((item) => (
                <button
                  key={item.count}
                  type="button"
                  onClick={() => handleSettingChange('wordsPerLine', item.count)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    (settings.wordsPerLine || 3) === item.count
                      ? 'bg-indigo-600/40 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs">{item.label}</div>
                  <div className="text-[9px] text-slate-400 truncate">{item.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              *ระบบมีระบบ Auto-Scale อัตโนมัติ ป้องกันตัวหนังสือล้นขอบจอ 100%
            </p>
          </div>

          {/* Vertical Position (High / Middle / Bottom / Custom Slider) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-400" />
                ตำแหน่งแนวตั้งของซับไตเติ้ล (Vertical Position):
              </span>
              <span className="font-bold text-xs px-2 py-0.5 rounded bg-indigo-950/80 text-cyan-300 border border-indigo-500/30 font-mono">
                {typeof settings.yPercent === 'number'
                  ? `${settings.yPercent}% จากขอบบน`
                  : settings.position === 'top'
                  ? '16% (บนสุด)'
                  : settings.position === 'middle-top'
                  ? '32% (บน-กลาง)'
                  : settings.position === 'middle'
                  ? '50% (กลางจอ)'
                  : settings.position === 'bottom'
                  ? '88% (ล่างสุด)'
                  : '75% (กลาง-ล่าง)'}
              </span>
            </div>

            {/* 5 Quick Presets */}
            <div className="grid grid-cols-5 gap-1.5 text-xs">
              {[
                { label: 'บนสุด', pos: 'top' as const, y: 16, desc: '16%' },
                { label: 'บน-กลาง', pos: 'middle-top' as const, y: 32, desc: '32%' },
                { label: 'กลางจอ', pos: 'middle' as const, y: 50, desc: '50%' },
                { label: 'กลาง-ล่าง', pos: 'middle-bottom' as const, y: 75, desc: '75% แนะนำ' },
                { label: 'ล่างสุด', pos: 'bottom' as const, y: 88, desc: '88%' },
              ].map((p) => {
                const isSelected =
                  settings.yPercent === p.y ||
                  (settings.yPercent === undefined && settings.position === p.pos);

                return (
                  <button
                    key={p.pos}
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...settings,
                        position: p.pos,
                        yPercent: p.y
                      };
                      setSettings(updated);
                      onUpdateProject({ subtitleSettings: updated });
                    }}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      isSelected
                        ? 'bg-indigo-600/40 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/40 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs truncate">{p.label}</div>
                    <div className="text-[9px] text-slate-400 truncate">{p.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Fine Tuning Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>เลื่อนปรับความสูงละเอียด (5% บนสุด - 95% ล่างสุด):</span>
              </div>
              <input
                type="range"
                min="5"
                max="95"
                step="1"
                value={
                  typeof settings.yPercent === 'number'
                    ? settings.yPercent
                    : settings.position === 'top'
                    ? 16
                    : settings.position === 'middle-top'
                    ? 32
                    : settings.position === 'middle'
                    ? 50
                    : settings.position === 'bottom'
                    ? 88
                    : 75
                }
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const updated = {
                    ...settings,
                    position: 'custom' as const,
                    yPercent: val
                  };
                  setSettings(updated);
                  onUpdateProject({ subtitleSettings: updated });
                }}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <p className="text-[11px] text-slate-400">
              *ตำแหน่ง 70% - 75% (กลาง-ล่าง) ช่วยไม่ให้ซับไปบังปุ่มตะกร้าสีเหลืองและปุ่มแชร์ของ TikTok / Reels
            </p>
          </div>

          {/* Color Schemes (Text color & Karaoke Highlight) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-amber-400" />
                สีไฮไลต์คำคาราโอเกะ (Karaoke Highlight Color):
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { name: 'ทองสว่าง', color: '#FACC15', bg: 'bg-amber-400' },
                { name: 'นีออนไซแอน', color: '#38BDF8', bg: 'bg-sky-400' },
                { name: 'เขียวมรกต', color: '#22C55E', bg: 'bg-emerald-500' },
                { name: 'ชมพูนีออน', color: '#F43F5E', bg: 'bg-rose-500' },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => handleSettingChange('highlightColor', c.color)}
                  className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                    settings.highlightColor === c.color
                      ? 'bg-slate-800 border-white ring-1 ring-white'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full ${c.bg} shadow-md mb-1`} />
                  <span className="text-[10px] text-slate-300">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Background Badge Box Toggle */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                กล่องพื้นหลังรองหลังซับไตเติ้ล (Background Badge Box):
              </span>
              <button
                type="button"
                onClick={() => handleSettingChange('showBadge', !settings.showBadge)}
                className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                  settings.showBadge
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                {settings.showBadge ? '✓ เปิดกล่องดำโปร่งแสง' : '✕ ปิดกล่องพื้นหลัง'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              *กล่องพื้นหลังสีดำโปร่งแสง ช่วยให้อ่านซับได้ชัดเจน 100% แม้ฉากในวิดีโอจะสว่างหรือมีลวดลาย
            </p>
          </div>

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
          <span>ถัดไป: รวมคลิป & ดาวน์โหลด</span>
          <span className="font-bold">→</span>
        </button>
      </div>

    </div>
  );
};
