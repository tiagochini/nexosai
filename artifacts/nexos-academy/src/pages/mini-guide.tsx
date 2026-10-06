import { useEffect, useState } from 'react';
import Watermark from '@/components/Watermark';
import AntiPiracyModal from '@/components/AntiPiracyModal';
import { academyAccessHeaders } from './owner';
import { generateMiniGuidePDF } from '@/lib/generate-mini-guide-pdf';
interface MiniGuideProps { onNavigate: (page: string, params?: Record<string, string>) => void; studentName?: string; studentEmail?: string; }
export default function MiniGuide({ onNavigate, studentName, studentEmail }: MiniGuideProps) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/academy/content/mini-guide', { headers: academyAccessHeaders(), cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Acesso ao material recusado. Confira seu código ou sessão.'); return response.json(); })
      .then(data => setHtml(data.html)).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);
  async function download() {
    setShowModal(false); setGenerating(true);
    try {
      await generateMiniGuidePDF();
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao baixar material.'); }
    finally { setGenerating(false); }
  }
  if (error) return <p role="alert">{error}</p>;
  if (!html) return <p>Carregando material autorizado...</p>;
  return <Watermark><div className="max-w-4xl mx-auto space-y-12 pb-24 px-4">
    <button className="btn-primary" disabled={generating} onClick={() => setShowModal(true)}>{generating ? 'Gerando PDF...' : '↓ Baixar PDF'}</button>
    <div onClick={event => { if ((event.target as HTMLElement).closest('button')) onNavigate('products'); }} dangerouslySetInnerHTML={{ __html: html }} />
    {showModal && <AntiPiracyModal studentName={studentName || 'Leitor NexOS'} studentEmail={studentEmail || ''} documentTitle="Mini-Guia 10K" onConfirm={download} onCancel={() => setShowModal(false)} />}
  </div></Watermark>;
}
