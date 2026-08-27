import { AnalysisAiConfig, AnalysisAiProviderType, ProductAnalysis, ReviewScript } from '../types';
import { analyzeProductDetails, generateReviewScript } from './scriptGenerator';
import { ExtractedFrame } from './videoFrameExtractor';

const isGhPages = () => typeof window !== 'undefined' && window.location.hostname.includes('github.io');

const SYSTEM_ANALYSIS_PROMPT = `คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์วิดีโอสินค้าและการตลาด TikTok E-Commerce ของไทย
หน้าที่ของคุณคือวิเคราะห์ข้อมูลสินค้าจากภาพเฟรมวิดีโอและข้อความที่ผู้ใช้ส่งมา แล้วสกัดข้อมูลออกมาเป็น JSON Format ภาษาไทยล้วนดังนี้:
{
  "productName": "ชื่อสินค้าและแบรนด์ที่ชัดเจน (สังเกตจากฉลาก/แพ็กเกจ/ข้อความบนจอในคลิป)",
  "painPoint": "ปัญหาหลักที่ลูกค้ากลุ่มเป้าหมายเจอ (สังเกตจากบริบทในวิดีโอ หรือปัญหาที่สินค้าตัวนี้มาช่วยแก้ สั้น กระชับ โดนใจ)",
  "features": [
    "จุดเด่น/ฟีเจอร์ข้อที่ 1 ที่เห็นในวิดีโอ",
    "จุดเด่น/ฟีเจอร์ข้อที่ 2 ที่เห็นในวิดีโอ",
    "จุดเด่น/ฟีเจอร์ข้อที่ 3 ที่เห็นในวิดีโอ"
  ],
  "targetAudience": "กลุ่มเป้าหมายของสินค้านี้ เช่น ผู้หญิงวัยทำงาน 20-35 ปี หรือสายแกดเจ็ต",
  "usp": "จุดขายเฉพาะตัวที่เห็นจากคลิปและสร้างความน่าเชื่อถือปิดการขายได้ทันที"
}
สำคัญ: ตอบกลับเฉพาะ JSON ที่ถูกต้องเท่านั้น ห้ามใส่คำเกริ่นนำหรือข้อความอื่นนอก JSON`;

/**
 * Helper to clean and parse JSON from AI response text
 */
function parseCleanJson(text: string): any {
  if (!text) throw new Error('ไม่พบข้อมูลตอบกลับจาก AI');
  
  // Remove markdown code fences ```json ... ```
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  // If there is extra text around JSON, extract the outer { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * Analyze Product directly from Uploaded Video Keyframes using Multimodal Vision AI
 * (Gemini 1.5/2.0 Flash / OpenAI GPT-4o / Claude 3.5)
 */
export async function analyzeProductWithAI(
  inputText: string,
  aiConfig: AnalysisAiConfig,
  videoFrames?: ExtractedFrame[]
): Promise<ProductAnalysis> {
  const provider = aiConfig.activeProvider;
  const hasFrames = Boolean(videoFrames && videoFrames.length > 0);

  // 1. Google Gemini Multimodal Vision API (Best for Video Frames with auto-fallback for high demand)
  if (provider === 'gemini' && aiConfig.geminiApiKey.trim()) {
    const primaryModel = aiConfig.geminiModel || 'gemini-2.0-flash';
    // Fallback list strictly using current stable models (gemini-1.5-pro is retired on v1beta as of 2025)
    const modelsToTry = Array.from(new Set([
      primaryModel,
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.0-flash-lite'
    ]));

    // Build parts with text prompt + image frame parts (limit to top 3 frames for blazing fast 2-second response)
    const selectedFrames = videoFrames ? videoFrames.slice(0, 3) : [];
    const parts: any[] = [
      { 
        text: `${SYSTEM_ANALYSIS_PROMPT}\n\nคำสั่ง: จงวิเคราะห์สินค้าจากภาพเฟรมของวิดีโอด้านล่างนี้ ${selectedFrames.length > 0 ? `(มีภาพสกัดจากวิดีโอ ${selectedFrames.length} ภาพ)` : ''}${inputText ? ` ร่วมกับข้อความเพิ่มเติม: "${inputText}"` : ''}` 
      }
    ];

    // Add image frames as inlineData
    for (const frame of selectedFrames) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: frame.base64
        }
      });
    }

    let lastGeminiError: any = null;

    for (const currentModel of modelsToTry) {
      try {
        const endpoint = isGhPages()
          ? `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${aiConfig.geminiApiKey.trim()}`
          : `/gemini-api/v1beta/models/${currentModel}:generateContent?key=${aiConfig.geminiApiKey.trim()}`;
        
        // Fast 7-second timeout per attempt to never hang
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 600,
              responseMimeType: 'application/json'
            }
          })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errMsg = `Google Gemini (${response.status})`;
          try {
            const errJson = await response.json();
            if (errJson.error?.message) errMsg = errJson.error.message;
          } catch {
            const errText = await response.text().catch(() => '');
            if (errText) errMsg = errText;
          }
          throw new Error(errMsg);
        }

        const data = await response.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const parsed = parseCleanJson(rawJson);
          return {
            productName: parsed.productName || inputText.slice(0, 40) || 'สินค้าจากวิดีโอ',
            painPoint: parsed.painPoint || 'ปัญหาการใช้งานทั่วไป',
            features: Array.isArray(parsed.features) && parsed.features.length >= 3 
              ? parsed.features.slice(0, 3) 
              : (Array.isArray(parsed.features) && parsed.features.length > 0 ? parsed.features : ['ฟังก์ชันตรงปกตามคลิป', 'ใช้งานง่าย ดีไซน์สวยงาม', 'คุณภาพระดับพรีเมียม']),
            targetAudience: parsed.targetAudience || 'ผู้บริโภคยุคใหม่',
            usp: parsed.usp || 'เห็นผลชัดเจน คุ้มค่าคุ้มราคาตามที่แสดงในวิดีโอ',
            rawInputText: inputText
          };
        }
      } catch (err: any) {
        lastGeminiError = err;
        // If aborted, high demand, 404, or deprecated model name, immediately try next stable model!
        const msgLower = String(err.message || '').toLowerCase();
        if (err.name === 'AbortError' || (msgLower && (msgLower.includes('high demand') || msgLower.includes('503') || msgLower.includes('429') || msgLower.includes('404') || msgLower.includes('quota') || msgLower.includes('overloaded') || msgLower.includes('no longer available') || msgLower.includes('not found') || msgLower.includes('not supported for generatecontent') || msgLower.includes('is not found for api version')))) {
          console.warn(`Gemini model ${currentModel} not available or busy (${err.message}), switching to stable model...`);
          continue;
        }
        // If auth error (bad key), stop immediately
        if (err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('400') || err.message.includes('401') || err.message.includes('403'))) {
          throw err;
        }
      }
    }

    if (lastGeminiError) throw lastGeminiError;
  }

  // 2. OpenAI GPT-4o Vision API
  if (provider === 'openai' && aiConfig.openaiApiKey.trim()) {
    const model = aiConfig.openaiModel || 'gpt-4o-mini';
    
    const userContent: any[] = [
      { 
        type: 'text', 
        text: `จงวิเคราะห์สินค้าจากภาพเฟรมวิดีโอดังต่อไปนี้:${inputText ? ` และข้อความ: ${inputText}` : ''}` 
      }
    ];

    if (hasFrames) {
      for (const frame of videoFrames!) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${frame.base64}`,
            detail: 'low'
          }
        });
      }
    }

    const response = await fetch(isGhPages() ? 'https://api.openai.com/v1/chat/completions' : '/openai-api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.openaiApiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_ANALYSIS_PROMPT },
          { role: 'user', content: userContent }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    });

    if (!response.ok) {
      let errMsg = `OpenAI (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson.error?.message) errMsg = errJson.error.message;
      } catch {
        const errText = await response.text().catch(() => '');
        if (errText) errMsg = errText;
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    const rawJson = data.choices?.[0]?.message?.content;
    if (rawJson) {
      const parsed = parseCleanJson(rawJson);
      return {
        productName: parsed.productName || inputText.slice(0, 40) || 'สินค้าจากวิดีโอ',
        painPoint: parsed.painPoint || 'ปัญหาการใช้งานทั่วไป',
        features: Array.isArray(parsed.features) ? parsed.features.slice(0, 3) : ['ฟังก์ชันครบครัน', 'ใช้งานง่าย', 'คุ้มค่าคุ้มราคา'],
        targetAudience: parsed.targetAudience || 'ผู้บริโภคยุคใหม่',
        usp: parsed.usp || 'คุณภาพระดับพรีเมียม',
        rawInputText: inputText
      };
    }
    throw new Error('OpenAI ไม่ส่งข้อมูลผลลัพธ์กลับมา');
  }

  // 3. Anthropic Claude Vision API
  if (provider === 'anthropic' && aiConfig.anthropicApiKey.trim()) {
    const model = aiConfig.anthropicModel || 'claude-3-5-haiku-20241022';
    
    const userContent: any[] = [
      { 
        type: 'text', 
        text: `วิเคราะห์สินค้าจากภาพวิดีโอ:${inputText ? ` และข้อความ: ${inputText}` : ''}` 
      }
    ];

    if (hasFrames) {
      for (const frame of videoFrames!) {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: frame.base64
          }
        });
      }
    }

    const response = await fetch(isGhPages() ? 'https://api.anthropic.com/v1/messages' : '/anthropic-api/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': aiConfig.anthropicApiKey.trim(),
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: SYSTEM_ANALYSIS_PROMPT,
        messages: [
          { role: 'user', content: userContent }
        ]
      })
    });

    if (!response.ok) {
      let errMsg = `Anthropic (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson.error?.message) errMsg = errJson.error.message;
      } catch {
        const errText = await response.text().catch(() => '');
        if (errText) errMsg = errText;
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (text) {
      const parsed = parseCleanJson(text);
      return {
        productName: parsed.productName || inputText.slice(0, 40) || 'สินค้าจากวิดีโอ',
        painPoint: parsed.painPoint || 'ปัญหาการใช้งานทั่วไป',
        features: Array.isArray(parsed.features) ? parsed.features.slice(0, 3) : ['ฟังก์ชันครบครัน', 'ใช้งานง่าย', 'คุ้มค่าคุ้มราคา'],
        targetAudience: parsed.targetAudience || 'ผู้บริโภคยุคใหม่',
        usp: parsed.usp || 'คุณภาพระดับพรีเมียม',
        rawInputText: inputText
      };
    }
    throw new Error('Claude ไม่ส่งข้อมูลผลลัพธ์กลับมา');
  }

  // Fallback to built-in smart analysis if no AI provider configured
  const fallbackText = inputText || 'สินค้าจากวิดีโอคลิป';
  const localResult = analyzeProductDetails(fallbackText);
  return {
    ...localResult,
    rawInputText: inputText
  };
}

/**
 * Auto-fetch available models from Google Gemini API
 */
export async function fetchGeminiModels(apiKey: string): Promise<Array<{ id: string; name: string; displayName: string }>> {
  if (!apiKey.trim()) return [];
  const url = isGhPages()
    ? `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
    : `/gemini-api/v1beta/models?key=${apiKey.trim()}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Google Gemini Error (${response.status}): ${errorData || response.statusText}`);
  }

  const data = await response.json();
  const models = (data.models || [])
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => {
      const cleanId = m.name.replace(/^models\//, '');
      return {
        id: cleanId,
        name: cleanId,
        displayName: m.displayName ? `${m.displayName} (${cleanId})` : cleanId
      };
    });

  return models.length > 0 ? models : [
    { id: 'gemini-2.0-flash', name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash (แนะนำ)' },
    { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
    { id: 'gemini-1.5-flash', name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-flash-latest', name: 'gemini-1.5-flash-latest', displayName: 'Gemini 1.5 Flash Latest' },
  ];
}

/**
 * Auto-fetch available models from OpenAI API
 */
export async function fetchOpenAiModels(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  if (!apiKey.trim()) return [];
  const response = await fetch(isGhPages() ? 'https://api.openai.com/v1/models' : '/openai-api/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI Error (${response.status}): ${errorData || response.statusText}`);
  }

  const data = await response.json();
  const rawModels = data.data || [];
  
  const gptModels = rawModels
    .filter((m: any) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
    .map((m: any) => ({ id: m.id, name: m.id }))
    .sort((a: any, b: any) => b.id.localeCompare(a.id));

  return gptModels.length > 0 ? gptModels : [
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini (แนะนำ/เร็ว)' },
    { id: 'gpt-4o', name: 'gpt-4o (ฉลาดสูงสุด)' },
    { id: 'gpt-4-turbo', name: 'gpt-4-turbo' },
  ];
}

/**
 * Test AI API Key Connectivity
 */
export async function testAiApiKey(
  provider: AnalysisAiProviderType,
  config: AnalysisAiConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const testPrompt = 'วิตามินซี เซรั่ม ผิวใสใน 7 วัน';
    const result = await analyzeProductWithAI(testPrompt, {
      ...config,
      activeProvider: provider
    });

    if (result && result.productName) {
      return {
        success: true,
        message: `เชื่อมต่อ ${provider.toUpperCase()} สำเร็จ! วิเคราะห์สินค้าได้: "${result.productName}"`
      };
    }
    return {
      success: false,
      message: 'ไม่สามารถรับคำตอบจาก AI ได้'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'การเชื่อมต่อล้มเหลว ตรวจสอบความถูกต้องของ API Key'
    };
  }
}
