export type VoiceProviderType = 'pd_voice' | 'minimax' | 'elevenlabs';
export type AnalysisAiProviderType = 'gemini' | 'openai' | 'anthropic' | 'builtin';

export interface ProductAnalysis {
  productName: string;
  painPoint: string;
  features: string[];
  targetAudience: string;
  usp: string;
  rawInputText?: string;
}

export interface ReviewScript {
  hook: string;
  problem: string;
  solution: string;
  proof: string;
  cta: string;
  fullText: string;
  wordCount: number;
  estimatedDurationSeconds: number;
}

export interface DualScript {
  ttsScript: string;      // Spoken Thai strictly, numbers and English converted to Thai phonetics, no brackets
  subtitleScript: string; // On-screen text, retains English brands and formatted numbers, no Thai reading brackets
}

export interface PDVoiceConfig {
  apiKey: string;
  referenceId: string;
  endpoint: string;
}

export interface MiniMaxConfig {
  apiKey: string;
  groupId: string;
  model: string;
  voiceId: string;
}

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  model: string;
}

export interface AnalysisAiConfig {
  activeProvider: AnalysisAiProviderType;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
}

export interface ProviderApiKeys {
  pd_voice: PDVoiceConfig;
  minimax: MiniMaxConfig;
  elevenlabs: ElevenLabsConfig;
  ai_analysis: AnalysisAiConfig;
}

export interface VoiceSettings {
  provider: VoiceProviderType;
  speed: number;       // 0.9 - 1.3, default 1.22
  tone: 'cheerful' | 'friendly' | 'confident' | 'energetic';
  gender?: 'female' | 'male';
  language: string;    // 'th'
  customPrompt?: string;
}

export interface SubtitleSettings {
  fontSize: number;    // default 84
  position: 'top' | 'middle-top' | 'middle' | 'bottom'; // default 'middle-top' (high)
  wordsPerLine: number; // default 3 words per chunk/line (1 to 6)
  styleMode: 'karaoke' | 'standard'; // 'karaoke' (word-by-word highlight) or 'standard' (clean full-line subtitles)
  textColor: string;
  highlightColor: string;
  bgBadgeColor: string;
  strokeColor: string;
  strokeWidth?: number; // default 8 (0 to 18)
  fontWeight?: '400' | '600' | '700' | '800' | '900'; // default '800'
  fontFamily: string; // 'Kanit', 'Prompt', 'Mitr', 'Itim', 'Chakra Petch', 'Noto Sans Thai', 'Sarabun', 'Pattaya', 'Charm'
  showBadge: boolean;
  customFontUrl?: string;
  customFontName?: string;
}

export interface WordTiming {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface ProjectData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  videoUrl: string;
  videoBlob?: Blob;
  videoFileName: string;
  videoDuration: number;
  videoWidth: number;
  videoHeight: number;
  productAnalysis: ProductAnalysis;
  reviewScript: ReviewScript;
  dualScript: DualScript;
  voiceSettings: VoiceSettings;
  subtitleSettings: SubtitleSettings;
  generatedAudioUrl?: string;
  audioBlob?: Blob;
  audioDuration?: number;
  wordTimings?: WordTiming[];
  renderedVideoUrl?: string;
  renderedVideoBlob?: Blob;
  status: 'draft' | 'analyzed' | 'scripted' | 'voiced' | 'rendered';
  // Web share (3 วันแล้วลบอัตโนมัติ)
  shareUrl?: string;
  shareExpiresAt?: string; // ISO string
  webExpiresAt?: string; // alias for auto-delete check
}

export interface ScriptTemplate {
  id: string;
  category: string;
  name: string;
  icon: string;
  productName: string;
  painPoint: string;
  features: string[];
  targetAudience: string;
  usp: string;
  sampleHook: string;
  videoPresetUrl?: string;
}
