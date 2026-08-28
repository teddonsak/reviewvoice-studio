import { VoiceProviderType, VoiceSettings, ProviderApiKeys, WordTiming } from '../types';
import { generateSubtitleSegments } from './thaiConverter';
import { alignSubtitlesToAudio } from './speechAlignmentService';
import { getFFmpeg } from './ffmpegTranscoder';
import { fetchFile } from '@ffmpeg/util';

export interface TTSResult {
  audioUrl: string;
  audioBlob: Blob;
  duration: number;
  wordTimings: WordTiming[];
  providerUsed: VoiceProviderType | 'web_speech_synth';
}

export interface PdVoiceItem {
  reference_id: string;
  name: string;
  is_default: boolean;
  duration_sec?: number;
}

/**
 * Accurately adjusts audio playback speed while preserving natural pitch using FFmpeg WASM / Web Audio.
 */
export async function adjustAudioSpeedAndDuration(
  audioBlob: Blob,
  targetSpeedMultiplier: number
): Promise<{ blob: Blob; duration: number }> {
  if (Math.abs(targetSpeedMultiplier - 1.0) < 0.03) {
    const duration = await getAudioDuration(audioBlob);
    return { blob: audioBlob, duration };
  }

  try {
    const ffmpeg = await getFFmpeg();
    const inputName = `tts_in_${Date.now()}.mp3`;
    const outputName = `tts_out_${Date.now()}.wav`;

    await ffmpeg.writeFile(inputName, await fetchFile(audioBlob));

    const clampedSpeed = Math.max(0.5, Math.min(2.0, targetSpeedMultiplier));
    await ffmpeg.exec([
      '-i', inputName,
      '-filter:a', `atempo=${clampedSpeed.toFixed(3)}`,
      '-ar', '48000',
      outputName,
    ]);

    const outputData = await ffmpeg.readFile(outputName);

    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch {}

    const outputBytes = typeof outputData === 'string'
      ? new TextEncoder().encode(outputData)
      : new Uint8Array(outputData);

    const adjustedBlob = new Blob([outputBytes.slice().buffer], { type: 'audio/wav' });
    const duration = await getAudioDuration(adjustedBlob);
    return { blob: adjustedBlob, duration };
  } catch (err) {
    console.warn('Audio speed adjust fallback:', err);
    const duration = await getAudioDuration(audioBlob);
    return { blob: audioBlob, duration };
  }
}

const isGhPages = () => typeof window !== 'undefined' && window.location.hostname.includes('github.io');

/**
 * Auto-fetch all cloned voices from PD Clone Voice API
 */
export async function fetchPdVoices(
  apiKey: string,
  endpoint: string = 'https://app.pd-voiceclone.com/api/v1/tts'
): Promise<{ voices: PdVoiceItem[]; default_reference_id?: string }> {
  if (!apiKey.trim()) return { voices: [] };
  
  // If endpoint is official pd-voiceclone or empty, always use local /pd-api proxy to bypass browser CORS
  // บน GitHub Pages ไม่มี proxy ให้ยิงตรง (อาจเจอ CORS แต่ดีกว่า 404)
  let targetUrl = isGhPages() ? 'https://app.pd-voiceclone.com/api/v1/voices' : '/pd-api/api/v1/voices';
  if (endpoint && !endpoint.includes('pd-voiceclone.com')) {
    targetUrl = endpoint.replace(/\/tts\/?$/, '').replace(/\/+$/, '') + '/voices';
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey.trim(),
        'Authorization': `Bearer ${apiKey.trim()}`
      }
    });

    if (!response.ok) {
      let errMessage = `PD Clone Voice (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson.detail) errMessage = errJson.detail;
        else if (errJson.message) errMessage = errJson.message;
      } catch {
        const rawText = await response.text().catch(() => '');
        if (rawText) errMessage = rawText;
      }
      throw new Error(errMessage);
    }

    const data = await response.json();
    // PD deployments have returned both an object wrapper and a plain array.
    // Normalise the common field names so the selector does not silently stay empty.
    const rawVoices = Array.isArray(data)
      ? data
      : Array.isArray(data.voices)
        ? data.voices
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.data)
            ? data.data
            : [];
    const voices: PdVoiceItem[] = rawVoices
      .map((voice: any) => ({
        reference_id: String(voice.reference_id ?? voice.referenceId ?? voice.id ?? voice.voice_id ?? ''),
        name: String(voice.name ?? voice.voice_name ?? voice.display_name ?? voice.reference_id ?? 'เสียงไม่มีชื่อ'),
        is_default: Boolean(voice.is_default ?? voice.default ?? false),
        duration_sec: voice.duration_sec ?? voice.duration
      }))
      .filter((voice: PdVoiceItem) => voice.reference_id);
    return {
      voices,
      default_reference_id: data.default_reference_id ?? data.defaultReferenceId
    };
  } catch (err: any) {
    if (err.message && (err.message.includes('API key') || err.message.includes('detail') || err.message.includes('401') || err.message.includes('403'))) {
      throw err;
    }
    throw new Error(`เชื่อมต่อ PD Clone Voice ไม่สำเร็จ: ${err.message || 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'}`);
  }
}

/**
 * Generate Voiceover Audio from the selected Provider or fallback Web Audio Synthesizer
 */
export async function generateVoiceoverAudio(
  text: string,
  voiceSettings: VoiceSettings,
  apiKeys: ProviderApiKeys
): Promise<TTSResult> {
  const provider = voiceSettings.provider;
  const speed = voiceSettings.speed || 1.22;

  // 1. PD Clone Voice (รองรับ X-API-Key และ multipart/form-data ตามเอกสาร API ทางการ)
  if (provider === 'pd_voice') {
    if (!apiKeys.pd_voice.apiKey.trim()) {
      throw new Error('กรุณากรอก PD Clone Voice API Key ก่อนกดทดสอบหรือสร้างเสียงพากย์');
    }

    const apiKey = apiKeys.pd_voice.apiKey.trim();
    
    // Always use local /pd-api proxy for official pd-voiceclone endpoints to bypass CORS on all devices/hostnames
    // GitHub Pages: ยิงตรง
    let targetEndpoint = isGhPages() ? 'https://app.pd-voiceclone.com/api/v1/tts' : '/pd-api/api/v1/tts';
    if (apiKeys.pd_voice.endpoint && !apiKeys.pd_voice.endpoint.includes('pd-voiceclone.com')) {
      targetEndpoint = apiKeys.pd_voice.endpoint.trim();
    }

    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', 'th');

      // If referenceId is provided and not 'custom', append it
      if (apiKeys.pd_voice.referenceId && apiKeys.pd_voice.referenceId.trim() && apiKeys.pd_voice.referenceId !== 'custom') {
        formData.append('reference_id', apiKeys.pd_voice.referenceId.trim());
      }

      formData.append('speed', speed.toString());
      formData.append('silence_sec', '0.5');

        if (voiceSettings.tone) {
          const voiceGender = voiceSettings.gender === 'male' ? 'male' : 'female';
          const instructMap: Record<string, string> = {
            // PD Clone Voice accepts only a fixed instruction vocabulary.
            // Natural delivery is shaped by punctuation and speed instead of
            // unsupported descriptive terms such as "warm" or "cheerful".
            cheerful: `${voiceGender}, young adult, high pitch`,
            friendly: `${voiceGender}, young adult, moderate pitch`,
            confident: `${voiceGender}, young adult, moderate pitch`,
            energetic: `${voiceGender}, young adult, high pitch`
          };
          const validInstruct = instructMap[voiceSettings.tone];
          if (validInstruct) {
            formData.append('instruct', validInstruct);
          }
        }

      const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
      });

      if (!response.ok) {
        let errMsg = `PD Clone Voice (${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson.detail) errMsg = errJson.detail;
          else if (errJson.message) errMsg = errJson.message;
        } catch {
          const errText = await response.text().catch(() => '');
          if (errText) errMsg = errText;
        }
        throw new Error(errMsg);
      }

      const rawAudioBlob = await response.blob();
      const { blob: finalAudioBlob, duration } = await adjustAudioSpeedAndDuration(rawAudioBlob, speed);
      const audioUrl = URL.createObjectURL(finalAudioBlob);
      const wordTimings = await alignSubtitlesToAudio(text, duration, finalAudioBlob);

      return {
        audioUrl,
        audioBlob: finalAudioBlob,
        duration,
        wordTimings,
        providerUsed: 'pd_voice'
      };
    } catch (err: any) {
      if (err.message && (err.message.includes('API key') || err.message.includes('detail') || err.message.includes('401') || err.message.includes('403'))) {
        throw err;
      }
      throw new Error(`ส่งคำขอสร้างเสียงไม่สำเร็จ: ${err.message}`);
    }
  }

  // 2. MiniMax
  if (provider === 'minimax' && apiKeys.minimax.apiKey.trim()) {
    try {
      const endpoint = isGhPages() ? 'https://api.minimax.chat/v1/t2a_v2' : '/minimax-api/v1/t2a_v2';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeys.minimax.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: apiKeys.minimax.model || 'speech-01-turbo',
          text: text,
          voice_setting: {
            voice_id: apiKeys.minimax.voiceId || 'female-tianmei',
            speed: speed,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`MiniMax Error (${response.status}): ${await response.text()}`);
      }

      const rawAudioBlob = await response.blob();
      const { blob: finalAudioBlob, duration } = await adjustAudioSpeedAndDuration(rawAudioBlob, speed);
      const audioUrl = URL.createObjectURL(finalAudioBlob);
      const wordTimings = await alignSubtitlesToAudio(text, duration, finalAudioBlob);

      return {
        audioUrl,
        audioBlob: finalAudioBlob,
        duration,
        wordTimings,
        providerUsed: 'minimax'
      };
    } catch (err: any) {
      console.warn('MiniMax API call failed, falling back to synthesizer:', err);
      return await generateSynthesizedSpeech(text, speed);
    }
  }

  // 3. ElevenLabs
  if (provider === 'elevenlabs' && apiKeys.elevenlabs.apiKey.trim()) {
    validateElevenLabsKey(apiKeys.elevenlabs.apiKey);
    try {
      const voiceId = apiKeys.elevenlabs.voiceId.trim() || '21m00Tcm4TlvDq8ikWAM';
      const requestedModel = apiKeys.elevenlabs.model || 'eleven_v3';
      const modelId = requestedModel === 'eleven_multilingual_v2' ? 'eleven_v3' : requestedModel;
      const endpoint = isGhPages()
        ? `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`
        : `/eleven-api/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKeys.elevenlabs.apiKey.trim(),
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          signal: controller.signal,
          body: JSON.stringify({
            text: text,
            model_id: modelId,
            language_code: 'th',
            voice_settings: {
              stability: 0.38,
              similarity_boost: 0.75,
              style: 0.12,
              use_speaker_boost: true,
              speed: Math.max(0.8, Math.min(1.25, speed))
            }
          })
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errBody = await response.text();
        if (response.status === 504) {
          throw new Error(`ElevenLabs Error (504): Gateway Timeout — ElevenLabs ใช้เวลาสร้างเสียงนานเกิน 26 วินาที`);
        }
        throw new Error(`ElevenLabs Error (${response.status}): ${errBody}`);
      }

      const rawAudioBlob = await response.blob();
      const { blob: finalAudioBlob, duration } = await adjustAudioSpeedAndDuration(rawAudioBlob, speed);
      const audioUrl = URL.createObjectURL(finalAudioBlob);
      const wordTimings = await alignSubtitlesToAudio(text, duration, finalAudioBlob);

      return {
        audioUrl,
        audioBlob: finalAudioBlob,
        duration,
        wordTimings,
        providerUsed: 'elevenlabs'
      };
    } catch (err: any) {
      console.warn('ElevenLabs API call failed:', err);
      throw new Error(normaliseElevenLabsError(err.message || String(err)));
    }
  }

  // 4. Default / Offline / Demo Synthesizer (Instant high-performance speech audio generation)
  return await generateSynthesizedSpeech(text, speed);
}

/**
 * Generates an audio file via Web Audio API + SpeechSynthesis or modulated tone waves
 * allowing full video preview and export even without active paid TTS tokens!
 */
export async function generateSynthesizedSpeech(text: string, speedMultiplier: number = 1.22): Promise<TTSResult> {
  const words = text.split(/[\s,]+/).filter(w => w.length > 0);
  const wordCount = Math.max(words.length, 5);
  
  // Calculate duration based on reading speed
  const baseSecondsPerWord = 0.35 / (speedMultiplier || 1.22);
  const totalDuration = Math.max(4, Number((wordCount * baseSecondsPerWord).toFixed(2)));

  // Generate real playable WAV audio buffer using Web Audio API
  const sampleRate = 44100;
  const numSamples = Math.floor(totalDuration * sampleRate);
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  // Generate melodic voiceover acoustic texture (simulating natural speech cadence with formant harmonics)
  const f0Base = 220; // Thai female vocal pitch range ~220Hz
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Word modulation
    const wordIndex = Math.floor((t / totalDuration) * wordCount);
    const wordProgress = ((t / totalDuration) * wordCount) % 1;
    
    // Envelope for each word: attack, sustain, decay with brief pause
    let env = 0;
    if (wordProgress < 0.15) {
      env = wordProgress / 0.15;
    } else if (wordProgress < 0.85) {
      env = 0.9;
    } else {
      env = Math.max(0, (1 - wordProgress) / 0.15);
    }

    // Natural intonation curve
    const pitch = f0Base + Math.sin(t * 3.5) * 25 + Math.cos(t * 1.8) * 15;
    const fundamental = Math.sin(2 * Math.PI * pitch * t);
    const harmonic1 = 0.4 * Math.sin(2 * Math.PI * (pitch * 2) * t);
    const harmonic2 = 0.2 * Math.sin(2 * Math.PI * (pitch * 3) * t);
    const breath = (Math.random() * 2 - 1) * 0.03;

    channelData[i] = (fundamental + harmonic1 + harmonic2 + breath) * env * 0.45;
  }

  // Also trigger SpeechSynthesis in browser if available for actual spoken voice preview!
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.min(Math.max(speedMultiplier, 0.8), 1.5);
      utterance.lang = 'th-TH';
      // Find Thai voice if present
      const voices = window.speechSynthesis.getVoices();
      const thaiVoice = voices.find(v => v.lang.includes('th') || v.name.includes('Thai') || v.name.includes('Premwadee') || v.name.includes('Achara'));
      if (thaiVoice) utterance.voice = thaiVoice;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors
    }
  }

  const wavBlob = audioBufferToWavBlob(audioBuffer);
  const audioUrl = URL.createObjectURL(wavBlob);
  const wordTimings = generateSubtitleSegments(text, totalDuration);

  return {
    audioUrl,
    audioBlob: wavBlob,
    duration: totalDuration,
    wordTimings,
    providerUsed: 'web_speech_synth'
  };
}

function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(blob);
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration || 10);
    });
    audio.addEventListener('error', () => {
      resolve(10);
    });
  });
}

/**
 * Converts AudioBuffer to a valid downloadable WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Auto-fetch available voices from ElevenLabs
 */
export async function fetchElevenLabsVoices(apiKey: string): Promise<Array<{ voice_id: string; name: string; category?: string }>> {
  if (!apiKey.trim()) return [];
  validateElevenLabsKey(apiKey);
  const url = isGhPages() ? 'https://api.elevenlabs.io/v1/voices' : '/eleven-api/v1/voices';
  const response = await fetch(url, {
    headers: {
      'xi-api-key': apiKey.trim()
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    let message = errText || response.statusText;
    try {
      const error = JSON.parse(errText);
      message = error.detail?.message || error.detail || error.message || message;
    } catch { /* Keep the raw response when it is not JSON. */ }
    throw new Error(normaliseElevenLabsError(`ElevenLabs (${response.status}): ${message}`));
  }

  const data = await response.json();
  const rawVoices = Array.isArray(data) ? data : Array.isArray(data.voices) ? data.voices : [];
  return rawVoices
    .map((v: any) => {
      const supportsThai = (v.verified_languages || []).some((language: any) =>
        ['th', 'tha'].includes(String(language.language || language.language_code || '').toLowerCase())
      ) || /thai|thailand/i.test(`${v.labels?.accent || ''} ${v.labels?.language || ''}`);
      return {
        voice_id: v.voice_id,
        name: `${supportsThai ? '🇹🇭 ' : ''}${v.name} (${v.category || 'Standard'})${supportsThai ? ' · เหมาะกับไทย' : ''}`,
        category: v.category,
        supportsThai
      };
    })
    .sort((a: any, b: any) => Number(b.supportsThai) - Number(a.supportsThai));
}

function validateElevenLabsKey(apiKey: string) {
  if (!apiKey.trim().startsWith('sk_')) {
    throw new Error('ค่าที่กรอกเป็น API Key ID ไม่ใช่ Secret API Key — กรุณาสร้างหรือ Rotate Key ใน ElevenLabs แล้วคัดลอกค่าที่ขึ้นต้นด้วย sk_');
  }
}

function normaliseElevenLabsError(message: string): string {
  if (message.includes('504') || message.includes('Gateway Timeout') || message.includes('AbortError')) {
    return 'ElevenLabs ตอบช้าเกินกำหนด (504/Timeout) — ระบบได้เปลี่ยนเป็นโหมด streaming เพื่อแก้ปัญหานี้แล้ว กรุณาลองกดสร้างเสียงใหม่อีกครั้ง หรือย่อบทให้สั้นลงเล็กน้อย';
  }
  if (message.includes('api_key_id_used_as_api_key') || message.includes('API key ID used as API key')) {
    return 'ค่าที่กรอกเป็น API Key ID ไม่ใช่ Secret API Key — กรุณาสร้างหรือ Rotate Key ใน ElevenLabs แล้วคัดลอกค่าที่ขึ้นต้นด้วย sk_';
  }
  if (message.includes('invalid_api_key') || message.includes('Invalid API key')) {
    return 'ElevenLabs API Key ไม่ถูกต้องหรือถูกยกเลิกแล้ว กรุณาสร้าง Key ใหม่ที่ขึ้นต้นด้วย sk_';
  }
  if (message.includes('missing_permissions') || message.includes('voices_read')) {
    return 'ElevenLabs API Key ไม่มีสิทธิ์อ่านเสียง กรุณาเปิดสิทธิ์ Voices: Read แล้วลองอีกครั้ง';
  }
  return message;
}
