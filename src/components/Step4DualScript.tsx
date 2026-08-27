import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, Check, ChevronDown, ChevronUp, Copy, Headphones,
  Merge, Plus, RefreshCw, Scissors, Sparkles, Subtitles, Trash2, Volume2
} from 'lucide-react';
import { DualScript, ProjectData } from '../types';
import { generateSubtitleScript, generateTtsScript } from '../services/thaiConverter';

interface Props {
  project: ProjectData;
  onUpdateProject: (updates: Partial<ProjectData>) => void;
  onNext: () => void;
  onPrev: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

type Segment = { id: string; tts: string; subtitle: string };

const splitText = (text: string) => {
  const sentences = text.replace(/\r/g, '').split(/\n+|(?<=[.!?…])\s+|(?<=ค่ะ|ครับ|คะ)\s+/g)
    .map(item => item.trim()).filter(Boolean);
  return sentences.length ? sentences : [text.trim()];
};

const createSegments = (dual: DualScript, fullText?: string): Segment[] => {
  const tts = splitText(dual.ttsScript);
  const subtitle = splitText(dual.subtitleScript);
  // ถ้ามีอังกฤษใน TTS แต่ไม่มีในซับ (บั๊กเก่าที่ทำให้ Daylight/Warm White หาย) ให้ซ่อมอัตโนมัติจาก fullText ต้นฉบับ
  if (fullText) {
    const rawSubtitles = splitText(fullText).map(generateSubtitleScript);
    const rawTts = splitText(fullText).map(generateTtsScript);
    const needsFix = subtitle.length !== rawSubtitles.length || subtitle.some((s, i) => /[A-Za-z]{2,}/.test(rawSubtitles[i] || '') && !/[A-Za-z]{2,}/.test(s));
    if (needsFix && rawSubtitles.length > 0) {
      return rawSubtitles.map((subtitleText, index) => ({
        id: `${Date.now()}-${index}`,
        tts: rawTts[index] || generateTtsScript(subtitleText),
        subtitle: subtitleText
      }));
    }
  }
  return subtitle.map((subtitleText, index) => ({
    id: `${Date.now()}-${index}`,
    // Preserve a matching saved pronunciation when possible. If the old
    // scripts were split differently, rebuild from the display source so no
    // content can disappear or move to another sentence.
    tts: tts.length === subtitle.length ? (tts[index] || generateTtsScript(subtitleText)) : generateTtsScript(subtitleText),
    subtitle: subtitleText
  }));
};

export const Step4DualScript: React.FC<Props> = ({ project, onUpdateProject, onNext, onPrev, onNotify }) => {
  const [segments, setSegments] = useState<Segment[]>(() => createSegments(project.dualScript, project.reviewScript.fullText));
  const [expandedId, setExpandedId] = useState<string | null>(segments[0]?.id || null);
  const [showDictionary, setShowDictionary] = useState(false);
  const [copied, setCopied] = useState<'tts' | 'subtitle' | null>(null);

  const save = (next: Segment[]) => {
    setSegments(next);
    onUpdateProject({
      dualScript: {
        ttsScript: next.map(item => item.tts.trim()).filter(Boolean).join(' '),
        subtitleScript: next.map(item => item.subtitle.trim()).filter(Boolean).join(' ')
      },
      wordTimings: undefined
    });
  };

  const issues = useMemo(() => {
    const result: string[] = [];
    const gender = project.voiceSettings.gender || 'female';
    const allTts = segments.map(item => item.tts).join(' ');
    // อนุญาตให้มีอังกฤษในสคริปต์เสียงได้หากผู้ใช้ต้องการ "พูดอย่างไรขึ้นจออย่างนั้น" — ไม่ดันเป็น issue อีก
    if (/\d/.test(allTts)) result.push('ยังมีตัวเลขที่อาจถูกอ่านผิด');
    if (gender === 'male' && /(ค่ะ|คะ|นะคะ)/.test(allTts)) result.push('คำลงท้ายไม่ตรงกับผู้บรรยายชาย');
    if (gender === 'female' && /ครับ/.test(allTts)) result.push('คำลงท้ายไม่ตรงกับผู้บรรยายหญิง');
    if (segments.some(item => !item.tts.trim() || !item.subtitle.trim())) result.push('มีคู่ประโยคที่ข้อความไม่ครบ');
    if (segments.some(item => item.subtitle.length > 110)) result.push('มีซับยาวเกินไป ควรแบ่งประโยค');
    return result;
  }, [segments, project.voiceSettings.gender]);

  const score = Math.max(0, 100 - issues.length * 14);

  const autoConvert = () => {
    const rawSegments = splitText(project.reviewScript.fullText);
    const next = rawSegments.map((raw, index) => ({
      id: `${Date.now()}-${index}`,
      tts: generateTtsScript(raw),
      subtitle: generateSubtitleScript(raw)
    }));
    save(next);
    setExpandedId(next[0]?.id || null);
    onNotify('success', 'จัดคู่คำพูดและซับเรียบร้อย', `แปลงและเชื่อมโยงแล้ว ${next.length} ประโยค`);
  };

  const syncEnglishVerbatim = () => {
    // ทำให้ซับแสดงครบตามคำพูด 100% — อังกฤษ/ตัวเลขคงไว้ตามต้นฉบับ (พูดอย่างไรขึ้นจออย่างนั้น) และบังคับให้สองฝั่งเหมือนกัน
    const rawSubtitles = splitText(project.reviewScript.fullText).map(generateSubtitleScript);
    const synced = segments.map((item, idx) => {
      const raw = rawSubtitles[idx] || item.subtitle;
      const needsFix = /[A-Za-z]{2,}/.test(item.tts) && !/[A-Za-z]{2,}/.test(item.subtitle);
      const targetSubtitle = needsFix ? raw : item.subtitle;
      const hasEnglish = /[A-Za-z]{2,}/.test(targetSubtitle);
      return {
        ...item,
        subtitle: targetSubtitle,
        tts: hasEnglish ? targetSubtitle : generateTtsScript(targetSubtitle)
      };
    });
    save(synced);
    onNotify('success', 'ซิงค์ซับให้ตรงคำพูดแล้ว', 'คำที่มีอังกฤษจะเหมือนกันทั้งสองฝั่ง (พูดอย่างไรขึ้นจออย่างนั้น)');
  };

  const update = (id: string, field: 'tts' | 'subtitle', value: string) => {
    save(segments.map(item => {
      if (item.id !== id) return item;
      // ถ้ามีอังกฤษ ให้ "พูดอย่างไรขึ้นจออย่างนั้น" — สองฝั่งต้องเหมือนกัน
      const hasEnglish = /[A-Za-z]{2,}/.test(value);
      return field === 'subtitle'
        ? { ...item, subtitle: value, tts: hasEnglish ? value : generateTtsScript(value) }
        : { ...item, tts: value, subtitle: hasEnglish ? value : item.subtitle };
    }));
  };

  const splitSegment = (index: number) => {
    const item = segments[index];
    const splitAt = (value: string) => {
      const middle = Math.floor(value.length / 2);
      const rightSpace = value.indexOf(' ', middle);
      const point = rightSpace > 0 ? rightSpace : middle;
      return [value.slice(0, point).trim(), value.slice(point).trim()];
    };
    const [subA, subB] = splitAt(item.subtitle);
    const next = [...segments];
    next.splice(index, 1,
      { ...item, tts: generateTtsScript(subA), subtitle: subA },
      { id: `${Date.now()}-split`, tts: generateTtsScript(subB), subtitle: subB }
    );
    save(next);
  };

  const mergeWithPrevious = (index: number) => {
    if (index === 0) return;
    const previous = segments[index - 1];
    const current = segments[index];
    const next = [...segments];
    next.splice(index - 1, 2, {
      ...previous,
      tts: `${previous.tts} ${current.tts}`.trim(),
      subtitle: `${previous.subtitle} ${current.subtitle}`.trim()
    });
    save(next);
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = Math.min(1.1, project.voiceSettings.speed || 1);
    window.speechSynthesis.speak(utterance);
  };

  const copyAll = async (type: 'tts' | 'subtitle') => {
    await navigator.clipboard.writeText(segments.map(item => item[type]).join(' '));
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const detectedTerms = useMemo(() => {
    const source = segments.map(item => item.subtitle).join(' ');
    return Array.from(new Set(source.match(/[A-Za-z][A-Za-z0-9+.-]*|\d+[A-Za-z%+.-]*/g) || [])).slice(0, 12);
  }, [segments]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm">4</span>
            เตรียมคำพูดและซับไตเติ้ล
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">ตรวจคำอ่านและเชื่อมข้อความบนจอเป็นรายประโยค เพื่อให้เสียงและคาราโอเกะตรงกัน</p>
          <p className="text-[11px] text-emerald-400 mt-1">คำที่มีอังกฤษจะเหมือนกันทั้งสองฝั่ง · พูดอย่างไรขึ้นจออย่างนั้น (Daylight/Warm White ครบ)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowDictionary(!showDictionary)} className="px-3 py-2 rounded-xl text-xs text-slate-300 bg-slate-800 border border-slate-700 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> คำอ่านที่ตรวจพบ
          </button>
          <button type="button" onClick={autoConvert} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 shadow-lg shadow-indigo-500/20">
            <RefreshCw className="w-3.5 h-3.5" /> ตรวจและแปลงอัตโนมัติ
          </button>
          <button type="button" onClick={syncEnglishVerbatim} className="px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 flex items-center gap-1.5">
            <Subtitles className="w-3.5 h-3.5" /> ซับตรงคำพูด (อังกฤษครบ)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg ${score >= 85 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}`}>{score}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-white">คุณภาพสคริปต์</span><span className="text-[11px] text-slate-400">ตรวจแล้ว {segments.length} คู่ประโยค</span></div>
            <div className="h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden"><div className={`h-full ${score >= 85 ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${score}%` }} /></div>
            <p className="text-[11px] text-slate-400 mt-2 truncate">{issues.length ? issues[0] : 'พร้อมสร้างเสียงและซิงค์ซับระดับคำ'}</p>
          </div>
        </div>
        <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">ผู้บรรยายปัจจุบัน</p>
          <p className="text-sm font-bold text-white mt-1">{project.voiceSettings.gender === 'male' ? '👨 ผู้ชาย' : '👩 ผู้หญิง'} · {project.voiceSettings.tone === 'confident' ? 'มั่นใจ' : project.voiceSettings.tone === 'energetic' ? 'กระตือรือร้น' : 'เป็นธรรมชาติ'}</p>
          <p className="text-[11px] text-emerald-400 mt-1">ภาษาไทย · {project.voiceSettings.speed.toFixed(2)}x</p>
        </div>
      </div>

      {showDictionary && (
        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/25">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-200"><Sparkles className="w-4 h-4" /> คำอังกฤษ ตัวเลข และหน่วยที่ควรตรวจการออกเสียง</div>
          <div className="flex flex-wrap gap-2 mt-3">{detectedTerms.length ? detectedTerms.map(term => <span key={term} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200">{term} → <span className="text-cyan-300">ตรวจคำอ่านฝั่ง TTS</span></span>) : <span className="text-xs text-slate-500">ไม่พบคำที่ต้องตรวจเพิ่มเติม</span>}</div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-100"><span className="font-bold">ควรตรวจอีก {issues.length} จุด:</span> {issues.join(' · ')}</div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
          <div className="col-span-1">ลำดับ</div><div className="col-span-5 flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-indigo-400" /> คำอ่านสำหรับเสียง</div><div className="col-span-5 flex items-center gap-1.5"><Subtitles className="w-3.5 h-3.5 text-cyan-400" /> ข้อความที่แสดงบนจอ</div><div className="col-span-1 text-right">สถานะ</div>
        </div>
        <div className="divide-y divide-slate-800/80">
          {segments.map((segment, index) => {
            const expanded = expandedId === segment.id;
            const valid = Boolean(segment.tts.trim() && segment.subtitle.trim());
            return (
              <div key={segment.id} className={expanded ? 'bg-indigo-500/[0.04]' : ''}>
                <button type="button" onClick={() => setExpandedId(expanded ? null : segment.id)} className="w-full grid grid-cols-12 gap-2 sm:gap-3 px-3 sm:px-4 py-3 items-center text-left hover:bg-slate-800/30">
                  <div className="col-span-2 sm:col-span-1 text-xs font-mono text-slate-500">{String(index + 1).padStart(2, '0')}</div>
                  <div className="col-span-8 sm:col-span-5 min-w-0" title={segment.tts}><span className="sm:hidden block text-[9px] text-cyan-500 mb-0.5">ข้อความบนจอ</span><span className="sm:hidden block text-xs text-slate-200 truncate" title={segment.subtitle}>{segment.subtitle || 'ยังไม่มีข้อความซับ'}</span><span className="hidden sm:block text-xs text-slate-200 truncate" title={segment.tts}>{segment.tts || 'ยังไม่มีคำอ่าน'}</span></div>
                  <div className="hidden sm:block col-span-5 text-xs text-slate-200 truncate" title={segment.subtitle}>{segment.subtitle || 'ยังไม่มีข้อความซับ'}</div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end items-center gap-1">{valid ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}{expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}</div>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5"><label className="text-[11px] font-semibold text-indigo-300">คำอ่าน TTS</label><button type="button" onClick={() => speak(segment.tts)} className="text-[10px] text-indigo-300 flex items-center gap-1"><Headphones className="w-3 h-3" /> ฟังคำอ่าน</button></div>
                      <textarea value={segment.tts} onChange={event => update(segment.id, 'tts', event.target.value)} rows={4} className="w-full rounded-xl bg-slate-950 border border-indigo-500/25 p-3 text-xs text-white leading-relaxed resize-y focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5"><label className="text-[11px] font-semibold text-cyan-300">ข้อความต้นฉบับบนจอ</label><span className="text-[9px] text-emerald-400">แก้ช่องนี้แล้วคำอ่านจะอัปเดตตาม</span></div>
                      <textarea value={segment.subtitle} onChange={event => update(segment.id, 'subtitle', event.target.value)} rows={4} className="w-full rounded-xl bg-slate-950 border border-cyan-500/25 p-3 text-xs text-white leading-relaxed resize-y focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div className="lg:col-span-2 flex flex-wrap justify-between gap-2 pt-1">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => splitSegment(index)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] text-slate-300 flex items-center gap-1"><Scissors className="w-3 h-3" /> แบ่งประโยค</button>
                        <button type="button" disabled={index === 0} onClick={() => mergeWithPrevious(index)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] text-slate-300 flex items-center gap-1 disabled:opacity-40"><Merge className="w-3 h-3" /> รวมกับด้านบน</button>
                      </div>
                      <button type="button" onClick={() => save(segments.filter(item => item.id !== segment.id))} className="px-2.5 py-1.5 rounded-lg text-[10px] text-rose-300 hover:bg-rose-500/10 flex items-center gap-1"><Trash2 className="w-3 h-3" /> ลบคู่ประโยค</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => { const item = { id: `${Date.now()}-new`, tts: '', subtitle: '' }; save([...segments, item]); setExpandedId(item.id); }} className="w-full px-4 py-3 text-xs text-slate-400 hover:text-white hover:bg-slate-800/40 flex items-center justify-center gap-1.5 border-t border-slate-800"><Plus className="w-3.5 h-3.5" /> เพิ่มคู่ประโยค</button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex gap-2">
          <button type="button" onClick={() => copyAll('tts')} className="px-3 py-2 rounded-lg text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-1.5">{copied === 'tts' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} คัดลอกคำอ่านทั้งหมด</button>
          <button type="button" onClick={() => copyAll('subtitle')} className="px-3 py-2 rounded-lg text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-1.5">{copied === 'subtitle' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} คัดลอกซับทั้งหมด</button>
        </div>
        <span className="text-[11px] text-slate-500">การแก้ข้อความจะล้างเวลาเดิมและ Auto Sync ใหม่ในขั้นตอนซับ</span>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-4 border-t border-slate-800">
        <button type="button" onClick={onPrev} className="px-5 py-2.5 rounded-xl text-xs sm:text-sm text-slate-300 hover:text-white border border-slate-700">← ย้อนกลับ</button>
        <button type="button" onClick={() => { if (issues.some(issue => issue.includes('ข้อความไม่ครบ'))) { onNotify('error', 'ยังไปต่อไม่ได้', 'กรุณาเติมคำอ่านและข้อความซับให้ครบทุกคู่ประโยค'); return; } onNext(); }} className="px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/25">ยืนยันสคริปต์และเลือกเสียง →</button>
      </div>
    </div>
  );
};
