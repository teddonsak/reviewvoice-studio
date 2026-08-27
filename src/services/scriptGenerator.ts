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
  // If matches template
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

  // Smart analysis fallback
  const cleanName = nameOrText.trim() || 'สินค้าพรีเมียมตัวดัง';
  return {
    productName: cleanName,
    painPoint: 'ผู้ใช้ประสบปัญหาการใช้งานในชีวิตประจำวัน ต้องการตัวช่วยที่คุ้มค่า เห็นผลไว และประหยัดเวลา',
    features: [
      `ฟังก์ชันตอบโจทย์การใช้งานจริง ดีไซน์ทันสมัย ใช้งานง่าย`,
      `ผลิตจากวัตถุดิบและวัสดุคุณภาพสูง ปลอดภัยได้มาตรฐาน`,
      `คุ้มค่าคุ้มราคา มีการรับประกันและรีวิวจากผู้ใช้จริงมากมาย`
    ],
    targetAudience: 'ผู้บริโภคยุคใหม่ที่มองหาสินค้าคุณภาพดี คุ้มค่า และแก้ปัญหาได้ตรงจุด',
    usp: `จุดเด่นที่แตกต่างคือคุณภาพระดับพรีเมียม ตอบโจทย์คนไทยในราคาที่เข้าถึงได้จริง`,
  };
}

export function generateReviewScript(
  analysis: ProductAnalysis,
  tone: 'cheerful' | 'friendly' | 'confident' | 'energetic' = 'cheerful',
  gender: 'female' | 'male' = 'female'
): ReviewScript {
  const { productName, painPoint, features, targetAudience: _targetAudience, usp } = analysis;

  let hook = '';
  let problem = '';
  let solution = '';
  let proof = '';
  let cta = '';

  const f1 = features[0] || 'ฟังก์ชันครบครัน';
  const f2 = features[1] || 'ใช้งานง่าย สะดวกสบาย';
  const f3 = features[2] || 'คุณภาพระดับพรีเมียม';

  switch (tone) {
    case 'energetic': // ป้ายยา โปรโมชั่นแรง ตื่นเต้น
      hook = `ทุกคนขา! ใครที่กำลังเจอกับปัญหา ${painPoint} ต้องหยุดดูคลิปนี้ด่วนๆ เลยค่ะ!`;
      problem = `เข้าใจเลยค่ะว่าปัญหานี้มันน่ารำคาญใจแค่ไหน ลองมาหลายวิธีก็ยังไม่ตอบโจทย์สักที`;
      solution = `จนมาเจอตัวนี้เลยค่ะ ${productName} บอกเลยว่าปังมาก เพราะเค้ามาพร้อม ${f1} แถมยังมี ${f2} และที่ชอบที่สุดคือ ${f3}`;
      proof = `จุดเด่นของเค้าคือ ${usp} ลองใช้เองแล้วประทับใจสุดๆ ดีจริงไม่จกตาเลยค่ะ`;
      cta = `ตอนนี้มีโปรโมชั่นพิเศษอยู่นะคะ รีบกดที่ตะกร้าสีเหลืองด้านซ้าย หรือคลิกลิงก์ใต้คลิปนี้ก่อนของจะหมดได้เลยค่ะ!`;
      break;

    case 'confident': // มั่นใจ ผู้เชี่ยวชาญ น่าเชื่อถือ
      hook = `ถ้าคุณกำลังมองหาทางออกของปัญหา ${painPoint} วันนี้มีไอเทมเด็ดมาแนะนำค่ะ`;
      problem = `หลายคนอาจจะเคยเจอปัญหาเหล่านี้จนเสียทั้งเงินและเวลา แต่ก็ยังไม่เจอตัวที่ใช่`;
      solution = `ขอแนะนำ ${productName} ที่ออกแบบมาเพื่อแก้ปัญหานี้โดยเฉพาะ จุดเด่นคือ ${f1} ผสานคุณสมบัติ ${f2} และ ${f3}`;
      proof = `ด้วย ${usp} จึงมั่นใจได้ในผลลัพธ์และความปลอดภัย คุ้มค่าทุกบาทแน่นอนค่ะ`;
      cta = `สำหรับใครที่สนใจ สามารถกดสั่งซื้อผ่านตะกร้าสีเหลืองหรือลิงก์หน้าโปรไฟล์ได้เลยนะคะ แนะนำว่าต้องมีติดบ้านไว้ค่ะ`;
      break;

    case 'cheerful': // หญิงสดใส เป็นกันเอง (Default)
    default:
      hook = `ใครที่เจอปัญหานี้อยู่เหมือนกันบ้างคะ? กับ ${painPoint} วันนี้มีของดีมาบอกต่อค่ะ!`;
      problem = `บอกเลยว่าเมื่อก่อนปวดหัวกับเรื่องนี้มาก ลองมาหลายตัวก็ยังไม่เวิร์ก`;
      solution = `แต่พอได้มาลอง ${productName} คือชีวิตเปลี่ยนเลยค่ะ เค้ามี ${f1} แล้วก็ยังมี ${f2} บอกเลยว่า ${f3} เลิฟมากๆ`;
      proof = `ที่สำคัญคือ ${usp} ใช้แล้วเห็นผลจริง สัมผัสได้ถึงความแตกต่างตั้งแต่ครั้งแรกๆ เลยค่ะ`;
      cta = `ใครอยากได้ แปะพิกัดไว้ที่ตะกร้าสีเหลืองมุมซ้ายล่างแล้วนะคะ กดสั่งตอนนี้ส่งฟรี รีบไปตำกันน้า!`;
      break;
  }

  if (gender === 'male') {
    const toMaleVoice = (value: string) => value
      .replace(/ทุกคนขา/g, 'ทุกคนครับ')
      .replace(/นะคะ|ค่ะ|คะ|น้า/g, 'ครับ')
      .replace(/เค้า/g, 'ตัวนี้');
    hook = toMaleVoice(hook);
    problem = toMaleVoice(problem);
    solution = toMaleVoice(solution);
    proof = toMaleVoice(proof);
    cta = toMaleVoice(cta);
  }

  const fullText = `${hook} ${problem} ${solution} ${proof} ${cta}`;
  const words = fullText.split(/[\s,]+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Thai average reading speed: ~150-180 words/min -> roughly ~2.8 words/sec at 1.22x speed
  const estimatedDurationSeconds = Math.max(10, Math.round(wordCount / 2.8));

  return {
    hook,
    problem,
    solution,
    proof,
    cta,
    fullText,
    wordCount,
    estimatedDurationSeconds,
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
