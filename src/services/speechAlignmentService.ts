import { WordTiming } from '../types';

type SpeechRange = { start: number; end: number };

/** Align subtitle phrases to the real audio envelope (lead-in, pauses and tail). */
export async function alignSubtitlesToAudio(
  fullText: string,
  audioDuration: number,
  audioBlob?: Blob,
  offsetSeconds = 0
): Promise<WordTiming[]> {
  if (!fullText?.trim()) return [{ word: '...', start: 0, end: audioDuration || 5 }];
  const duration = Math.max(audioDuration || 5, 1.5);
  const phrases = splitIntoPhrases(fullText);
  let ranges: SpeechRange[] = [];
  if (audioBlob) {
    try { ranges = await detectSpeechRanges(audioBlob); }
    catch (error) { console.warn('Audio-envelope alignment unavailable.', error); }
  }
  if (!ranges.length) ranges = [{ start: Math.min(.12, duration * .03), end: Math.max(.2, duration - .25) }];
  return distributeAcrossSpeech(phrases, ranges, duration, offsetSeconds);
}

function splitIntoPhrases(text: string): string[] {
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('th', { granularity: 'word' });
    const words = Array.from(segmenter.segment(text), (item: any) => ({
      text: String(item.segment).trim(), isWordLike: item.isWordLike
    })).filter(item => item.text && item.isWordLike).map(item => item.text);
    if (words.length) return words;
  }
  return text.split(/\s+/).map(value => value.trim()).filter(Boolean);
}

async function detectSpeechRanges(blob: Blob): Promise<SpeechRange[]> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return [];
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const windowSize = Math.max(1, Math.round(buffer.sampleRate * .02));
    const levels: number[] = [];
    for (let start = 0; start < buffer.length; start += windowSize) {
      let sum = 0, count = 0;
      const stop = Math.min(buffer.length, start + windowSize);
      for (const channel of channels) for (let i = start; i < stop; i += 2) {
        sum += channel[i] * channel[i]; count++;
      }
      levels.push(Math.sqrt(sum / Math.max(1, count)));
    }
    const sorted = [...levels].sort((a, b) => a - b);
    const noise = sorted[Math.floor(sorted.length * .2)] || 0;
    const peak = sorted[Math.floor(sorted.length * .95)] || 0;
    const threshold = Math.max(.003, noise * 3.5, peak * .055);
    const active = levels.map(level => level >= threshold);
    const maxGap = Math.round(.16 / .02);
    for (let i = 0; i < active.length;) {
      if (active[i]) { i++; continue; }
      const start = i;
      while (i < active.length && !active[i]) i++;
      if (start > 0 && i < active.length && i - start <= maxGap) {
        for (let j = start; j < i; j++) active[j] = true;
      }
    }
    const ranges: SpeechRange[] = [];
    for (let i = 0; i < active.length;) {
      if (!active[i]) { i++; continue; }
      const start = i;
      while (i < active.length && active[i]) i++;
      if ((i - start) * .02 >= .08) ranges.push({
        start: Math.max(0, start * .02 - .04), end: Math.min(buffer.duration, i * .02 + .06)
      });
    }
    return ranges;
  } finally { context.close().catch(() => undefined); }
}

function distributeAcrossSpeech(phrases: string[], ranges: SpeechRange[], duration: number, offset: number): WordTiming[] {
  const weights = phrases.map(calculateThaiPhraseWeight);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  const totalSpeech = ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0);
  const toRealTime = (position: number) => {
    let remaining = Math.max(0, Math.min(totalSpeech, position));
    for (const range of ranges) {
      const length = range.end - range.start;
      if (remaining <= length) return range.start + remaining;
      remaining -= length;
    }
    return ranges[ranges.length - 1].end;
  };
  let cursor = 0;
  return phrases.map((word, index) => {
    const startSpeech = cursor;
    cursor += totalSpeech * (weights[index] / totalWeight);
    const start = Math.max(0, Math.min(duration, toRealTime(startSpeech) + offset));
    const end = Math.max(start + .08, Math.min(duration, toRealTime(cursor) + offset));
    return { word, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)) };
  });
}

function breakThaiClauseNaturally(clause: string, maxChars: number): string[] {
  if (clause.length <= maxChars) return [clause];
  const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter
    ? new (Intl as any).Segmenter('th', { granularity: 'word' }) : null;
  const words = segmenter
    ? Array.from(segmenter.segment(clause), (item: any) => item.segment).filter((item: string) => item.trim())
    : clause.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return clause.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [clause];
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const joiner = /[\u0E00-\u0E7F]$/.test(current) && /^[\u0E00-\u0E7F]/.test(word) ? '' : (current ? ' ' : '');
    if (current && (current + joiner + word).length > maxChars) { chunks.push(current.trim()); current = word; }
    else current += joiner + word;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function calculateThaiPhraseWeight(phrase: string): number {
  const english = (phrase.match(/[A-Za-z0-9]/g) || []).length;
  const consonants = (phrase.match(/[\u0E01-\u0E2E]/g) || []).length;
  const longVowels = (phrase.match(/[\u0E32\u0E40-\u0E41\u0E33]/g) || []).length;
  return Math.max(1, consonants * 1.08 + longVowels * .55 + english * .55);
}
