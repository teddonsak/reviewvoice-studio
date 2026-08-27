// Dictionary for smart brand, tech, and unit Thai phonetic conversion
const PHONETIC_DICTIONARY: Record<string, string> = {
  // Beauty & Skincare
  'cerave': 'เซราวี',
  'cetaphil': 'เซตาฟิล',
  'la roche posay': 'ลา โรช โพเซย์',
  'eucerin': 'ยูเซอริน',
  'the ordinary': 'ดิ ออดินารี',
  'anessa': 'อเนสซ่า',
  'skincare': 'สกินแคร์',
  'skin care': 'สกินแคร์',
  'serum': 'เซรั่ม',
  'toner': 'โทนเนอร์',
  'cleanser': 'คลีนเซอร์',
  'moisturizer': 'มอยส์เจอร์ไรเซอร์',
  'sunscreen': 'ครีมกันแดด',
  'retinol': 'เรตินอล',
  'niacinamide': 'ไนอะซินาไมด์',
  'hyaluron': 'ไฮยาลูรอน',
  'hyaluronic': 'ไฮยาลูรอนิก',
  'vitamin c': 'วิตามินซี',
  'vit c': 'วิตามินซี',
  'bha': 'บีเอชเอ',
  'aha': 'เอเอชเอ',
  'collagen': 'คอลลาเจน',
  'gluta': 'กลูต้า',
  'glutathione': 'กลูตาไธโอน',
  'zinc': 'ซิงค์',
  'biotin': 'ไบโอติน',

  // Tech & Gadgets
  'iphone': 'ไอโฟน',
  'ipad': 'ไอแพด',
  'macbook': 'แมคบุ๊ก',
  'apple': 'แอปเปิ้ล',
  'samsung': 'ซัมซุง',
  'galaxy': 'กาแล็กซี่',
  'xiaomi': 'เสียวหมี่',
  'airpods': 'แอร์พอดส์',
  'wireless': 'ไร้สาย',
  'bluetooth': 'บลูทูธ',
  'gadget': 'แกดเจ็ต',
  'powerbank': 'พาวเวอร์แบงก์',
  'power bank': 'พาวเวอร์แบงก์',
  'type-c': 'ไทป์ซี',
  'type c': 'ไทป์ซี',
  'fast charge': 'ฟาสต์ชาร์จ',
  'pro max': 'โปร แม็กซ์',
  'pro': 'โปร',
  'ultra': 'อัลตร้า',
  'plus': 'พลัส',
  'mini': 'มินิ',

  // Social & E-commerce & Shopping terms
  'tiktok': 'ติ๊กต๊อก',
  'tiktok shop': 'ติ๊กต๊อกช็อป',
  'shopee': 'ช้อปปี้',
  'lazada': 'ลาซาด้า',
  'facebook': 'เฟซบุ๊ก',
  'instagram': 'อินสตาแกรม',
  'reels': 'รีลส์',
  'youtube': 'ยูทูป',
  'flash sale': 'แฟลชเซล',
  'promotion': 'โปรโมชั่น',
  'cashback': 'แคชแบ็ก',
  'voucher': 'วอยเชอร์',
  'discount': 'ส่วนลด',
  'free delivery': 'ส่งฟรี',
  'free shipping': 'ส่งฟรี',
  'review': 'รีวิว',
  'unboxing': 'แกะกล่อง',
  'unbox': 'แกะกล่อง',
  'must have': 'ของมันต้องมี',
  'link in bio': 'กดลิงก์หน้าโปรไฟล์',
  'basket': 'ตะกร้าสีเหลือง',
  'yellow basket': 'ตะกร้าสีเหลือง',
  'bio': 'ไบโอ',
  'click': 'กดคลิก',

  // Units & Specifications
  'spf': 'เอสพีเอฟ',
  'pa++++': 'พีเอสี่บวก',
  'pa+++': 'พีเอสามบวก',
  'pa++': 'พีเอสองบวก',
  'pa+': 'พีเอบวก',
  'fps': 'เฟรมเรตต่อวินาที',
  'mah': 'มิลลิแอมป์',
  'watt': 'วัตต์',
  'gb': 'กิกะไบต์',
  'tb': 'เทระไบต์',
  'kg': 'กิโลกรัม',
  'g': 'กรัม',
  'ml': 'มิลลิลิตร',
  'cm': 'เซนติเมตร',
  'mm': 'มิลลิเมตร',
  'km': 'กิโลเมตร',
  'hr': 'ชั่วโมง',
  'min': 'นาที',
  'sec': 'วินาที',
  'k': 'พัน',
  'm': 'ล้าน',
};

// Thai number reading converter
const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

export function numberToThaiWords(num: number): string {
  if (isNaN(num)) return '';
  if (num === 0) return 'ศูนย์';
  if (num < 0) return 'ลบ' + numberToThaiWords(Math.abs(num));

  // Handle integers
  const integerPart = Math.floor(num);
  if (integerPart >= 10000000) {
    // Large numbers fallback
    return num.toString();
  }

  const str = integerPart.toString();
  const len = str.length;
  let result = '';

  for (let i = 0; i < len; i++) {
    const digit = parseInt(str[i], 10);
    const pos = len - i - 1;

    if (digit !== 0) {
      if (pos === 1 && digit === 1) {
        result += 'สิบ';
      } else if (pos === 1 && digit === 2) {
        result += 'ยี่สิบ';
      } else if (pos === 0 && digit === 1 && len > 1 && str[len - 2] !== '0') {
        result += 'เอ็ด';
      } else {
        result += THAI_DIGITS[digit] + THAI_POSITIONS[pos];
      }
    }
  }

  return result;
}

/**
 * Converts a script to Spoken Thai TTS Script:
 * - English words & brands converted to natural Thai pronunciation
 * - Numbers and percentages converted to Thai words ("100%" -> "หนึ่งร้อยเปอร์เซ็นต์", "390 บาท" -> "สามร้อยเก้าสิบบาท")
 * - Units converted ("50ml" -> "ห้าสิบมิลลิลิตร")
 * - Removes parentheses () entirely so voice doesn't read symbols
 */
export function generateTtsScript(rawText: string): string {
  let text = rawText;

  // 1. Remove brackets and parentheses content markings like (อ่านว่า เซราวี) or just ()
  text = text.replace(/\(([^)]+)\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]/g, '$1');

  // 2. Convert common percentage patterns: e.g. "100%" -> "หนึ่งร้อยเปอร์เซ็นต์"
  text = text.replace(/(\d+)\s*%/g, (_, n) => {
    const num = parseInt(n, 10);
    return `${numberToThaiWords(num)}เปอร์เซ็นต์`;
  });

  // 3. Convert units like "50ml", "100g", "20W", "5000mAh"
  text = text.replace(/(\d+)\s*(ml|มล\.)/gi, (_, n) => `${numberToThaiWords(parseInt(n, 10))}มิลลิลิตร`);
  text = text.replace(/(\d+)\s*(g|กรัม)/gi, (_, n) => `${numberToThaiWords(parseInt(n, 10))}กรัม`);
  text = text.replace(/(\d+)\s*(kg|กก\.)/gi, (_, n) => `${numberToThaiWords(parseInt(n, 10))}กิโลกรัม`);
  text = text.replace(/(\d+)\s*(mah)/gi, (_, n) => `${numberToThaiWords(parseInt(n, 10))}มิลลิแอมป์`);
  text = text.replace(/(\d+)\s*(w|watt|วัตต์)/gi, (_, n) => `${numberToThaiWords(parseInt(n, 10))}วัตต์`);
  text = text.replace(/(\d+)\s*(k|พัน)/gi, (_, n) => `${numberToThaiWords(parseInt(n, 10))}พัน`);

  // 4. Convert price formats: "390.-" or "฿390" or "390 บาท"
  text = text.replace(/[฿](\d+)/g, (_, n) => `${numberToThaiWords(parseInt(n, 10))}บาท`);
  text = text.replace(/(\d+)\s*(บาท|\.-)/g, (_, n) => `${numberToThaiWords(parseInt(n, 10))}บาท`);

  // 5. Convert standalone numbers like "1 แถม 1" -> "หนึ่ง แถม หนึ่ง", "3 ข้อเด่น" -> "สาม ข้อเด่น"
  text = text.replace(/\b(\d{1,6})\b/g, (match) => {
    const num = parseInt(match, 10);
    return isNaN(num) ? match : numberToThaiWords(num);
  });

  // 6. Convert English words & Brands from dictionary (case-insensitive)
  // Sort dictionary keys by length descending to match multi-words first
  const dictKeys = Object.keys(PHONETIC_DICTIONARY).sort((a, b) => b.length - a.length);
  for (const key of dictKeys) {
    const regex = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi');
    text = text.replace(regex, PHONETIC_DICTIONARY[key]);
  }

  // 7. Clean up any remaining symbols
  text = text.replace(/[#*~`^\[\](){}<>\\/]/g, ' ');
  text = text.replace(/\s{2,}/g, ' ').trim();

  return text;
}

/**
 * Converts a script to clean on-screen Subtitle Script:
 * - Keeps original brand names and clear digits ("Cerave", "100%", "฿390", "50ml")
 * - Strips any phonetic reading brackets like "(เซราวี)" or "(หนึ่งร้อยเปอร์เซ็นต์)"
 * - Keeps sentences punchy and clean for subtitles
 */
export function generateSubtitleScript(rawText: string): string {
  let text = rawText;

  // Remove any bracketed pronunciation guides that user or AI might have added
  text = text.replace(/\((อ่านว่า|อ่านเสียง|tts)?[^)]+\)/gi, '');
  text = text.replace(/\[(อ่านว่า|อ่านเสียง|tts)?[^\]]+\]/gi, '');

  // Clean redundant spaces and punctuation
  text = text.replace(/[#*~`^]/g, '');
  text = text.replace(/\s{2,}/g, ' ').trim();

  return text;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits a full text into natural timed Thai subtitle phrases/clauses
 * Preserves original spacing only where explicit spaces exist in the script.
 */
export function generateSubtitleSegments(
  fullText: string,
  totalDurationSeconds: number
): { word: string; start: number; end: number }[] {
  if (!fullText || !fullText.trim()) {
    return [{ word: '...', start: 0, end: totalDurationSeconds || 5 }];
  }

  const duration = Math.max(totalDurationSeconds, 1.5);
  const cleanText = fullText.trim();
  
  // Split into natural sentences / clauses
  const rawClauses = cleanText
    .split(/\r?\n+|[!?]+/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const phrases: string[] = [];
  for (const clause of rawClauses) {
    if (clause.length <= 32) {
      phrases.push(clause);
    } else {
      // Break longer sentence at natural spaces or comma boundaries
      const parts = clause.split(/([,;]|\s{2,})/).filter(p => p.trim().length > 0);
      for (const part of parts) {
        if (part.length <= 32) {
          phrases.push(part.trim());
        } else {
          // Break at space
          const spaceChunks = part.split(/\s+/).filter(s => s.trim().length > 0);
          if (spaceChunks.length > 1) {
            let cur = '';
            for (const sc of spaceChunks) {
              if (!cur) cur = sc;
              else if ((cur + ' ' + sc).length <= 30) cur += ' ' + sc;
              else {
                phrases.push(cur);
                cur = sc;
              }
            }
            if (cur) phrases.push(cur);
          } else {
            phrases.push(part.trim());
          }
        }
      }
    }
  }

  if (phrases.length === 0) {
    phrases.push(cleanText);
  }

  // Calculate weights
  const weights = phrases.map(p => Math.max(1.0, p.length * 0.8));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
  let currentStart = 0.1; // small lead-in
  const netDuration = Math.max(1.0, duration - 0.35);

  return phrases.map((phrase, idx) => {
    const pDuration = (weights[idx] / totalWeight) * netDuration;
    const start = Number(currentStart.toFixed(2));
    const end = Number((currentStart + pDuration).toFixed(2));
    currentStart += pDuration + 0.18; // phrase pause

    return {
      word: phrase, // Complete contiguous Thai phrase
      start,
      end: Math.min(duration, end)
    };
  });
}
