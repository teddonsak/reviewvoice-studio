import { ProductAnalysis, ReviewScript, DualScript, ScriptTemplate } from '../types';
import { generateTtsScript, generateSubtitleScript } from './thaiConverter';

export const SAMPLE_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'skincare-serum',
    category: 'สกินแคร์และความงาม',
    name: 'เซรั่มวิตามินซีเข้มข้น ผิวใสเร่งด่วน',
    icon: 'Sparkles',
    productName: 'Glow Vit-C 10% Brightening Serum',
    painPoint: 'หน้าหมองคล้ำ รอยสิวหายช้า แต่งหน้าไม่ติดทน',
    features: [
      'วิตามินซีบริสุทธิ์ 10% เกรดพรีเมียมจากญี่ปุ่น',
      'ผสานไฮยาลูรอน 8 โมเลกุล ล็อคความชุ่มชื้น 72 ชม.',
      'เนื้อบางเบา ซึมไว ไม่เหนอะหนะ ไม่อุดตันผิว'
    ],
    targetAudience: 'วัยทำงาน และนักศึกษาที่มีปัญหารอยสิว ผิวหมองคล้ำ พักผ่อนน้อย',
    usp: 'เห็นผลผิวแลดูกระจ่างใส รอยสิวจางลงใน 7 วัน ผ่านการทดสอบจากแพทย์ผิวหนัง',
    sampleHook: 'ใครที่กำลังเจอปัญหารอยสิวกวนใจ หน้าหมองแต่งหน้าไม่ติด ต้องหยุดดูคลิปนี้ด่วนเลยค่ะ!',
  },
  {
    id: 'supplement-collagen',
    category: 'อาหารเสริมและสุขภาพ',
    name: 'คอลลาเจนไดเปปไทด์ บำรุงผิวและข้อเข่า',
    icon: 'HeartPulse',
    productName: 'Pure Marine Collagen Dipeptide 5000mg',
    painPoint: 'ผิวแห้งกร้าน เริ่มมีริ้วรอย ข้อเข่ามีเสียงก๊อบแก๊บเวลาเดิน',
    features: [
      'คอลลาเจนไดเปปไทด์ ดูดซึมไวกว่าปกติ 10 เท่า',
      'ผสมวิตามินซีและซิงค์ ช่วยกระตุ้นการสร้างคอลลาเจนใต้ผิว',
      'ชงดื่มง่าย ไม่คาว ไม่มีน้ำตาล 0 แคลอรี่'
    ],
    targetAudience: 'ผู้หญิงวัย 25+ และผู้ที่ต้องการดูแลผิวพรรณกับสุขภาพกระดูก',
    usp: 'คอลลาเจนแท้นำเข้าจากญี่ปุ่น เกรดพรีเมียม ชงดื่มง่ายเห็นผลชัดเจนในกระปุกแรก',
    sampleHook: 'บอกลาริ้วรอยและผิวแห้งโทรมได้เลยค่ะ วันนี้เจอคอลลาเจนที่กินง่ายที่สุดแล้ว!',
  },
  {
    id: 'mom-kids-wipes',
    category: 'แม่และเด็ก',
    name: 'ทิชชู่เปียกสูตรน้ำแร่บริสุทธิ์ อ่อนโยนพิเศษ',
    icon: 'Baby',
    productName: 'BabyPure Organic Mineral Wet Wipes 80 Sheets',
    painPoint: 'ลูกน้อยผิวแพ้ง่าย ใช้ทิชชู่เปียกทั่วไปแล้วผื่นแดงขึ้น ผ้าขาดง่าย',
    features: [
      'ผลิตจากน้ำแร่บริสุทธิ์ 99.9% ผ่านการฆ่าเชื้อระบบปิด',
      'แผ่นผ้าหนานุ่มพิเศษ ไม่ขาดง่าย ผิวสัมผัสแบบรังผึ้ง',
      'ปราศจากแอลกอฮอล์ น้ำหอม และพาราเบน 100%'
    ],
    targetAudience: 'คุณแม่ลูกอ่อน และครอบครัวที่มีเด็กเล็กหรือผู้มีผิวแพ้ง่าย',
    usp: 'อ่อนโยนเทียบเท่าน้ำต้มสุก รับรองโดยแพทย์ผิวหนังระดับสากล',
    sampleHook: 'คุณแม่คนไหนที่ลูกผิวแพ้ง่าย ต้องรีบเซฟคลิปนี้ไว้เลยค่ะ!',
  },
  {
    id: 'tech-powerbank',
    category: 'สินค้าไอทีและแกดเจ็ต',
    name: 'พาวเวอร์แบงก์ชาร์จเร็วไร้สาย แม่เหล็กแน่น',
    icon: 'Smartphone',
    productName: 'MagCharge Pro 10000mAh 20W Fast Wireless',
    painPoint: 'แบตหมดระหว่างวัน พกสายชาร์จพะรุงพะรัง พาวเวอร์แบงก์เดิมหนักและชาร์จช้า',
    features: [
      'แม่เหล็กแรงดูดสูง แปะหลังเครื่องชาร์จไร้สายได้ทันที',
      'รองรับชาร์จไว 20W Type-C และชาร์จไร้สาย 15W',
      'ขนาดกะทัดรัด น้ำหนักเบา ขึ้นเครื่องบินได้ปลอดภัย'
    ],
    targetAudience: 'คนรุ่นใหม่ วัยทำงาน และสายคอนเทนต์ที่ใช้สมาร์ตโฟนตลอดทั้งวัน',
    usp: 'บางเบาแต่ความจุเต็ม 10,000mAh ชาร์จไอโฟนได้ 2-3 รอบสบายๆ ไม่ต้องพกสาย',
    sampleHook: 'บอกลาปัญหาแบตหมดกลางทางและสายชาร์จพันกันวุ่นวายไปได้เลยค่ะ!',
  }
];

export function analyzeProductDetails(nameOrText: string): ProductAnalysis {
  const match = SAMPLE_TEMPLATES.find(t => 
    t.productName.toLowerCase().includes(nameOrText.toLowerCase()) || 
    t.name.toLowerCase().includes(nameOrText.toLowerCase())
  );

  if (match) {
    return {
      productName: match.productName,
      painPoint: match.painPoint,
      features: [...match.features],
      targetAudience: match.targetAudience,
      usp: match.usp,
    };
  }

  const cleanName = nameOrText.trim() || 'สินค้าพรีเมียมตัวดัง';
  return {
    productName: cleanName,
    painPoint: 'เจอปัญหาการใช้งานเดิมๆ ที่แก้ไม่หาย เสียทั้งเงินและเวลา อยากได้ตัวช่วยที่เห็นผลจริงและคุ้มค่า',
    features: [
      `ดีไซน์ตอบโจทย์ ใช้งานง่าย พกพาสะดวก`,
      `ผลิตจากวัสดุคุณภาพสูง ทนทาน ได้มาตรฐานสากล`,
      `การันตีรีวิวผู้ใช้จริงเพียบ คุ้มค่าคุ้มราคา`
    ],
    targetAudience: 'ผู้บริโภคยุคใหม่ที่มองหาสินค้าคุณภาพดี คุ้มค่า และแก้ปัญหาได้ตรงจุด',
    usp: `คุณภาพเกรดพรีเมียม ตอบโจทย์คนไทยในราคาที่จับต้องได้จริง`,
  };
}

/**
 * High-Converting Copywriting Generator for TikTok & Shopee Video:
 * Formulates scripts tailored to target duration (15s, 30s, 45s, 60s, 90s)
 * and sales psychology style (Trendy, Direct Sales, Expert, Storytelling, Fast Hook).
 */
export function generateReviewScript(
  analysis: ProductAnalysis,
  tone: 'cheerful' | 'friendly' | 'confident' | 'energetic' = 'cheerful',
  gender: 'female' | 'male' = 'female',
  copywritingStyle: 'trendy_influencer' | 'direct_sales' | 'expert' | 'storytelling' | 'fast_hook' = 'trendy_influencer',
  targetDurationSeconds: number = 30,
  speed: number = 1.22
): ReviewScript {
  const { productName, painPoint, features, usp } = analysis;

  const f1 = features[0] || 'ฟังก์ชันครบครัน';
  const f2 = features[1] || 'ใช้งานง่าย สะดวกสบาย';
  const f3 = features[2] || 'คุณภาพระดับพรีเมียม';

  let hook = '';
  let problem = '';
  let solution = '';
  let proof = '';
  let cta = '';

  // 1. Script Styles based on Copywriting Strategy
  if (copywritingStyle === 'fast_hook' || targetDurationSeconds <= 20) {
    // ⚡ 15-20s Fast Hook (Short & Punchy)
    hook = `หยุดดูด่วน! ใครเจอปัญหา ${painPoint} ฟังทางนี้เลยค่ะ`;
    problem = `ไม่ต้องทนหงุดหงิดอีกต่อไป`;
    solution = `เพราะมี ${productName} ตัวนี้ ตัวเดียวจบ มาพร้อม ${f1}`;
    proof = `การันตีด้วย ${usp} ปังจริงไม่จกตา`;
    cta = `พิกัดในตะกร้าสีเหลืองมุมซ้ายล่าง รีบกดก่อนหมดโปรนะคะ!`;
  } else if (copywritingStyle === 'direct_sales') {
    // 🔥 Direct Sales / Flash Sale (กระตุ้นโปรแรง ปิดการขายไว)
    hook = `ทุกคนขา! ใครที่กำลังอยากแก้ปัญหา ${painPoint} ต้องรีบดูคลิปนี้ให้จบเลยค่ะ!`;
    problem = `บอกเลยว่าอย่าปล่อยไว้นานจนเสียเงินเปล่า ลองมาหลายตัวก็ไม่ตอบโจทย์`;
    solution = `จนมาเจอ ${productName} บอกเลยว่าตอบโจทย์มาก เพราะเค้าจัดเต็ม ${f1} แถมยังมี ${f2} ใช้งานสะดวกสุดๆ`;
    proof = `จุดเด่นคือ ${usp} คนใช้จริงรีวิวเพียบ คุ้มค่าทุกบาทแน่นอนค่ะ`;
    cta = `ตอนนี้กำลังจัดโปรโมชั่นลดพิเศษอยู่นะคะ รีบกดที่ตะกร้าสีเหลืองด้านซ้ายก่อนของจะหมดได้เลยค่ะ!`;
  } else if (copywritingStyle === 'expert') {
    // 💎 Expert & Authority (ผู้เชี่ยวชาญ เจาะลึก น่าเชื่อถือ)
    hook = `ถ้าคุณกำลังมองหาวิธีแก้ปัญหา ${painPoint} อย่างตรงจุด คลิปนี้มีคำตอบให้ค่ะ`;
    problem = `หลายคนอาจเคยเสียเวลาลองผิดลองถูกกับสินค้าที่ไม่ได้มาตรฐาน`;
    solution = `ขอแนะนำ ${productName} ที่ออกแบบมาเพื่อแก้ปัญหานี้โดยเฉพาะ จุดเด่นคือ ${f1} ผสานคุณสมบัติ ${f2} และ ${f3}`;
    proof = `ด้วย ${usp} จึงมั่นใจได้ในผลลัพธ์และความปลอดภัยสูงสุดค่ะ`;
    cta = `สำหรับใครที่สนใจ สามารถกดสั่งซื้อผ่านตะกร้าสีเหลืองมุมซ้ายล่างได้ทันที มีรับประกันสินค้าของแท้ 100% ค่ะ`;
  } else if (copywritingStyle === 'storytelling') {
    // 🎭 Storytelling (เล่าเรื่องเปลี่ยนชีวิต จากปัญหาสู่ความประทับใจ)
    hook = `ใครที่เจอปัญหานี้เหมือนกันบ้างคะ? กับ ${painPoint} วันนี้มีของดีมาบอกต่อค่ะ!`;
    problem = `เมื่อก่อนเครียดกับเรื่องนี้มาก ลองมาสารพัดวิธีก็ยังไม่เวิร์ก`;
    solution = `แต่พอได้เปิดใจลอง ${productName} บอกเลยว่าชีวิตเปลี่ยนมาก เค้ามี ${f1} แล้วก็ยังมี ${f2} บอกเลยว่า ${f3} ประทับใจสุดๆ`;
    proof = `ที่สำคัญคือ ${usp} ใช้แล้วเห็นผลชัดเจน สัมผัสได้ถึงความเปลี่ยนแปลงทันทีค่ะ`;
    cta = `ใครอยากได้ แปะพิกัดไว้ที่ตะกร้าสีเหลืองมุมซ้ายล่างแล้วนะคะ กดสั่งตอนนี้ส่งฟรี รีบไปตำกันน้า!`;
  } else {
    // 🌟 Trendy Influencer (ป้ายยาตัวแม่ เป็นกันเอง เล่าสนุก - Default)
    if (targetDurationSeconds >= 45) {
      hook = `ทุกคนนน! ใครที่กำลังปวดหัวกับปัญหา ${painPoint} ต้องหยุดดูคลิปนี้ด่วนๆ เลยค่ะ!`;
      problem = `เข้าใจความรู้สึกเลยค่ะว่ามันน่ารำคาญใจแค่ไหน เสียเงินซื้อมาลองตั้งเยอะก็ยังไม่โดนใจสักที`;
      solution = `จนเพื่อนมาป้ายยาตัวนี้ค่ะ ${productName} บอกเลยว่าเลิฟมากก เค้ามาพร้อม ${f1} แถมยังมี ${f2} และที่ชอบมากๆ คือ ${f3}`;
      proof = `จุดเด่นที่แตกต่างคือ ${usp} ลองใช้เองแล้วติดใจ ดีจริงแบบไม่อวยเลยค่ะ`;
      cta = `แปะพิกัดของแท้พร้อมโปรส่งฟรีไว้ที่ตะกร้าสีเหลืองมุมซ้ายล่างแล้วนะคะ รีบกดใส่ตะกร้าก่อนโปรจะหมดน้า!`;
    } else {
      hook = `ใครเจอปัญหา ${painPoint} ต้องหยุดดูคลิปนี้ด่วนเลยค่ะ!`;
      problem = `เข้าใจเลยค่ะว่ามันน่ารำคาญใจ ลองมาเยอะก็ยังไม่หาย`;
      solution = `จนมาเจอ ${productName} บอกเลยว่าปังมาก มี ${f1} แถมยังมี ${f2}`;
      proof = `จุดเด่นคือ ${usp} ใช้แล้วประทับใจมาก ดีจริงไม่จกตาค่ะ`;
      cta = `แปะพิกัดไว้ที่ตะกร้าสีเหลืองมุมซ้ายล่างแล้วนะคะ รีบกดสั่งได้เลยน้า!`;
    }
  }

  // Adjust for Male voiceover
  if (gender === 'male') {
    const toMaleVoice = (value: string) => value
      .replace(/ทุกคนขา/g, 'ทุกคนครับ')
      .replace(/ทุกคนนน/g, 'ทุกคนครับ')
      .replace(/แกรรรร/g, 'ทุกคนครับ')
      .replace(/นะคะ|ค่ะ|คะ|น้า/g, 'ครับ')
      .replace(/เค้า/g, 'ตัวนี้');
    hook = toMaleVoice(hook);
    problem = toMaleVoice(problem);
    solution = toMaleVoice(solution);
    proof = toMaleVoice(proof);
    cta = toMaleVoice(cta);
  }

  const fullText = `${hook} ${problem} ${solution} ${proof} ${cta}`.trim();
  const words = fullText.split(/[\s,]+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Thai accurate duration calculation:
  // Base speech rate: ~10.5 Thai characters per second at 1.0x speed
  const thaiChars = (fullText.match(/[\u0E00-\u0E7F0-9A-Za-z]/g) || []).length;
  const estimatedDurationSeconds = Math.max(5, Math.round(thaiChars / (10.5 * Math.max(0.8, speed))));

  return {
    hook,
    problem,
    solution,
    proof,
    cta,
    fullText,
    wordCount,
    estimatedDurationSeconds,
    targetDurationSeconds,
    copywritingStyle,
  };
}

export function buildDualScripts(script: ReviewScript): DualScript {
  const fullText = script.fullText;
  const ttsScript = generateTtsScript(fullText);
  const subtitleScript = generateSubtitleScript(fullText);

  return {
    ttsScript,
    subtitleScript,
  };
}
