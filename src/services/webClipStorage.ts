/**
 * Web clip share - อัปโหลดไฟล์ขึ้น file.io (หรือ 0x0.st fallback) และให้ลิงก์อยู่ 3 วันแล้วลบอัตโนมัติ
 * ใช้ได้ทั้ง Netlify และ GitHub Pages (ยิงตรงจากเบราว์เซอร์)
 */
export interface WebShareResult {
  url: string;
  expiresAt: string; // ISO
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function uploadClipToWeb(blob: Blob, fileName: string): Promise<WebShareResult> {
  const form = new FormData();
  // file.io ต้องใช้ field ชื่อ "file"
  form.append('file', blob, fileName);

  // ลอง file.io ก่อน (รองรับ ?expires=3d)
  try {
    const res = await fetch('https://file.io/?expires=3d', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({} as any));
    if (res.ok && data.success && data.link) {
      return { url: data.link as string, expiresAt: new Date(Date.now() + THREE_DAYS_MS).toISOString() };
    }
    // ถ้า file.io ตอบไม่สำเร็จ ให้ตกไป fallback
    if (data.message) throw new Error(data.message);
  } catch (e) {
    console.warn('file.io upload failed, trying 0x0.st fallback', e);
  }

  // Fallback: 0x0.st (เก็บยาว แต่เราจะลบจากประวัติในเว็บหลัง 3 วันอยู่ดี)
  const form2 = new FormData();
  form2.append('file', blob, fileName);
  const res2 = await fetch('https://0x0.st', { method: 'POST', body: form2 });
  if (!res2.ok) throw new Error(`อัปโหลดไม่สำเร็จ (${res2.status})`);
  const url = (await res2.text()).trim();
  if (!url.startsWith('http')) throw new Error('ลิงก์ที่ได้รับไม่ถูกต้อง');
  return { url, expiresAt: new Date(Date.now() + THREE_DAYS_MS).toISOString() };
}

export function formatExpiresCountdown(expiresAt?: string): string {
  if (!expiresAt) return '';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'หมดอายุแล้ว';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (days > 0) return `เหลือ ${days} วัน ${h} ชม.`;
  return `เหลือ ${hours} ชม.`;
}
