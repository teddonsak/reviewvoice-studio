import { ProviderApiKeys, WordTiming } from '../types';

const isGhPages = () => typeof window !== 'undefined' && window.location.hostname.includes('github.io');

type TranscriptWord = { text: string; start: number; end: number };

export type AlignmentEngine = 'openai-whisper' | 'elevenlabs-scribe';

export interface TranscriptAlignmentResult {
  timings: WordTiming[];
  engine: AlignmentEngine;
}

/**
 * Transcribe the generated voice and use real word timestamps. OpenAI Whisper
 * is preferred because it supports multilingual transcription and word-level
 * timestamps; ElevenLabs Scribe is used when only that key is configured.
 */
export async function alignFromTranscription(
  displayText: string,
  spokenText: string,
  audioBlob: Blob,
  apiKeys: ProviderApiKeys
): Promise<TranscriptAlignmentResult | null> {
  let words: TranscriptWord[] = [];
  let engine: AlignmentEngine;

  if (apiKeys.ai_analysis.openaiApiKey.trim()) {
    words = await transcribeWithOpenAI(audioBlob, spokenText, apiKeys.ai_analysis.openaiApiKey.trim());
    engine = 'openai-whisper';
  } else if (apiKeys.elevenlabs.apiKey.trim()) {
    words = await transcribeWithElevenLabs(audioBlob, apiKeys.elevenlabs.apiKey.trim());
    engine = 'elevenlabs-scribe';
  } else {
    return null;
  }

  if (!words.length) throw new Error('ระบบถอดเสียงไม่พบคำพูดในไฟล์เสียง');
  return { timings: mapPhrasesToWords(splitDisplayWords(displayText), splitDisplayWords(spokenText), words), engine };
}

async function transcribeWithOpenAI(blob: Blob, prompt: string, key: string): Promise<TranscriptWord[]> {
  const form = new FormData();
  form.append('file', blob, fileNameForBlob(blob));
  form.append('model', 'whisper-1');
  form.append('language', 'th');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('prompt', prompt.slice(0, 4000));
  const response = await fetch(isGhPages() ? 'https://api.openai.com/v1/audio/transcriptions' : '/openai-api/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form
  });
  const data = await readJsonResponse(response, 'OpenAI Transcription');
  return normaliseWords(data.words || data.segments || []);
}

async function transcribeWithElevenLabs(blob: Blob, key: string): Promise<TranscriptWord[]> {
  const form = new FormData();
  form.append('file', blob, fileNameForBlob(blob));
  form.append('model_id', 'scribe_v2');
  form.append('language_code', 'tha');
  const response = await fetch(isGhPages() ? 'https://api.elevenlabs.io/v1/speech-to-text' : '/eleven-api/v1/speech-to-text', {
    method: 'POST', headers: { 'xi-api-key': key }, body: form
  });
  const data = await readJsonResponse(response, 'ElevenLabs Scribe');
  return normaliseWords((data.words || []).filter((item: any) => !item.type || item.type === 'word'));
}

async function readJsonResponse(response: Response, provider: string): Promise<any> {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
  if (!response.ok) {
    const detail = data.error?.message || data.detail?.message || data.detail || data.message || `HTTP ${response.status}`;
    throw new Error(`${provider}: ${detail}`);
  }
  return data;
}

function normaliseWords(items: any[]): TranscriptWord[] {
  return items.flatMap(item => {
    if (typeof item.start !== 'number' || typeof item.end !== 'number') return [];
    const text = String(item.word ?? item.text ?? '').trim();
    return text ? [{ text, start: item.start, end: item.end }] : [];
  });
}

function mapPhrasesToWords(displayPhrases: string[], spokenPhrases: string[], words: TranscriptWord[]): WordTiming[] {
  // The display and spoken scripts originate from the same script. Use the
  // spoken version to locate semantic boundaries, then place the display text
  // on those exact transcribed-word timestamps.
  const weights = displayPhrases.map((_, index) => textWeight(spokenPhrases[index] || displayPhrases[index]));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  const wordWeights = words.map(word => textWeight(word.text));
  const totalWordWeight = wordWeights.reduce((sum, value) => sum + value, 0) || 1;
  let phraseCursor = 0;

  return displayPhrases.map((word, index) => {
    const fromRatio = phraseCursor / totalWeight;
    phraseCursor += weights[index];
    const toRatio = phraseCursor / totalWeight;
    const startIndex = wordIndexAtRatio(wordWeights, totalWordWeight, fromRatio);
    const endIndex = Math.max(startIndex, wordIndexAtRatio(wordWeights, totalWordWeight, Math.max(fromRatio, toRatio - .0001)));
    return {
      word,
      start: Number(words[startIndex].start.toFixed(3)),
      end: Number(words[endIndex].end.toFixed(3))
    };
  });
}

function wordIndexAtRatio(weights: number[], total: number, ratio: number): number {
  const target = Math.max(0, Math.min(total, total * ratio));
  let cursor = 0;
  for (let i = 0; i < weights.length; i++) {
    cursor += weights[i];
    if (cursor >= target) return i;
  }
  return weights.length - 1;
}

function splitPhrases(text: string): string[] {
  const clauses = text.replace(/\r/g, '').split(/\n+|(?<=[.!?…])\s*|[,;:]+\s*/g)
    .map(value => value.trim()).filter(Boolean);
  const phrases: string[] = [];
  for (const clause of clauses) {
    if (clause.length <= 30) { phrases.push(clause); continue; }
    const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter
      ? new (Intl as any).Segmenter('th', { granularity: 'word' }) : null;
    const parts: string[] = segmenter
      ? Array.from(segmenter.segment(clause), (item: any) => item.segment).filter((item: string) => item.trim())
      : clause.split(/\s+/).filter(Boolean);
    let current = '';
    for (const part of parts) {
      const joiner = /[\u0E00-\u0E7F]$/.test(current) && /^[\u0E00-\u0E7F]/.test(part) ? '' : (current ? ' ' : '');
      if (current && (current + joiner + part).length > 30) { phrases.push(current); current = part; }
      else current += joiner + part;
    }
    if (current) phrases.push(current);
  }
  return phrases.length ? phrases : [text.trim()];
}

function splitDisplayWords(text: string): string[] {
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('th', { granularity: 'word' });
    const tokens = Array.from(segmenter.segment(text), (item: any) => ({
      text: String(item.segment).trim(), isWordLike: item.isWordLike
    })).filter(item => item.text && item.isWordLike).map(item => item.text);
    if (tokens.length) return tokens;
  }
  return text.split(/\s+/).map(item => item.trim()).filter(Boolean);
}

function textWeight(text: string): number {
  return Math.max(1, text.replace(/[\s\p{P}\p{S}]/gu, '').length);
}

function fileNameForBlob(blob: Blob): string {
  if (blob.type.includes('mpeg')) return 'voice.mp3';
  if (blob.type.includes('ogg')) return 'voice.ogg';
  if (blob.type.includes('webm')) return 'voice.webm';
  return 'voice.wav';
}
