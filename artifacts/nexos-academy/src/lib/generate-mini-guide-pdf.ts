import { academyAccessHeaders } from '@/pages/owner';
export async function generateMiniGuidePDF(): Promise<void> {
  const response = await fetch('/api/academy/content/mini-guide.pdf', { headers: academyAccessHeaders(), cache: 'no-store' });
  if (!response.ok) throw new Error('Acesso ao material recusado.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = 'nexos-mini-guide.pdf';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
