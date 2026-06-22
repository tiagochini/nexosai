/**
 * LaunchAuditScanner — Cinematic pre-launch audit overlay.
 *
 * State machine:
 *   loading → scanning → gallery (if pieces exist) → approved | blocked
 *
 * New vs. original:
 *   • "gallery" phase: all pieces shown as mocks in a scrollable grid for visual approval
 *   • Social = hard blocker (was warning)
 *   • BLOCKED state shows inline integration wizard for social with step-by-step + connect button
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  CheckCircle2, XCircle, AlertTriangle, Rocket, X,
  FileText, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Integration { id: string; provider: string; status: string; }
export interface ContentPiece {
  id: string; type: string; status: string;
  platform?: string; title?: string; content?: unknown;
}

type ScanKind = "phase" | "briefing" | "piece" | "integration";

interface ScanItem {
  id: string; kind: ScanKind; ms: number;
  phaseLabel?: string; phaseDetail?: string;
  field?: string; value?: string;
  piece?: ContentPiece; pieceIdx?: number; pieceTotal?: number;
  intLabel?: string; intIcon?: string; intConnected?: boolean;
}

interface GateResult {
  id: string; label: string; passed: boolean;
  blocker: boolean; detail: string;
  wizard?: WizardStep[];
  actionLabel?: string; actionUrl?: string;
}

interface WizardStep { title: string; detail: string; url?: string; }

interface Props {
  campaignId: string; campaignName: string;
  intakeData: Record<string, unknown>;
  onClose: () => void; onConfirmLaunch: () => void; launching: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNestedStr(obj: Record<string, unknown>, ...paths: string[]): string {
  for (const path of paths) {
    const parts = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = obj;
    for (const p of parts) {
      if (cur && typeof cur === "object") cur = cur[p]; else { cur = undefined; break; }
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
    if (typeof cur === "number") return String(cur);
  }
  return "";
}

export function extractPieceText(content: unknown, maxLen = 300): string {
  if (typeof content === "string") return content.slice(0, maxLen);
  if (!content || typeof content !== "object") return "";
  const obj = content as Record<string, unknown>;
  const keys = ["headline","hook","subject","opening","body","copy","text","message","description","title","content","script","roteiro","transcricao"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 8) return v.slice(0, maxLen);
  }
  // Try any string value
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && v.length > 20) return v.slice(0, maxLen);
  }
  return "";
}

export const PIECE_LABELS: Record<string, string> = {
  social_post: "Post para Redes Sociais", story_sequence: "Sequência de Stories",
  ad_copy: "Copy de Anúncio", email_sequence: "Sequência de Email",
  whatsapp_message: "Mensagem WhatsApp", vsl_script: "Script VSL",
  landing_page_copy: "Copy Landing Page", video_script: "Script de Vídeo",
  launch_sequence: "Sequência de Lançamento", sales_letter: "Carta de Vendas",
  content_calendar: "Calendário de Conteúdo", webinar_script: "Script de Webinar",
  targeting_config: "Segmentação de Audiência", media_buying_plan: "Plano de Mídia",
  cpl_script: "Script CPL",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "APROVADO", generated: "GERADO", pending: "PENDENTE",
  rejected: "REJEITADO", draft: "RASCUNHO",
};

// ─── Integration wizards ───────────────────────────────────────────────────────

const SOCIAL_WIZARDS: Record<string, { name: string; icon: string; steps: WizardStep[] }> = {
  instagram: {
    name: "Instagram / Meta Business",
    icon: "📸",
    steps: [
      { title: "Acesse o Meta Business Suite", detail: "business.facebook.com → certifique-se que sua Página do Instagram está vinculada à conta Business", url: "https://business.facebook.com" },
      { title: "Crie um App na Meta for Developers", detail: "developers.facebook.com → Meus Apps → Criar App → Negócios. Adicione o produto Instagram Graph API.", url: "https://developers.facebook.com" },
      { title: "Gere um token de acesso", detail: "No painel do App: Ferramentas → Gerador de Token → selecione sua Página → copie o token de longa duração (60 dias)." },
      { title: "Obtenha o Instagram Account ID", detail: "Faça GET em graph.facebook.com/me/accounts com seu token → copie o id da página vinculada ao Instagram." },
      { title: "Cole no NexOS AI", detail: "Configurações → Integrações → Instagram → Colar token + Account ID → Conectar" },
    ],
  },
  tiktok: {
    name: "TikTok Business",
    icon: "🎵",
    steps: [
      { title: "Acesse o TikTok for Business", detail: "business.tiktok.com → crie ou entre na sua conta Business", url: "https://business.tiktok.com" },
      { title: "Crie um App no TikTok Developers", detail: "developers.tiktok.com → Meus Apps → Criar App → Web. Habilite Content Posting API.", url: "https://developers.tiktok.com" },
      { title: "Configure as permissões", detail: "Produtos → Content Posting API → solicite acesso. Adicione o escopo video.publish." },
      { title: "Cole no NexOS AI", detail: "Configurações → Integrações → TikTok Business → Colar Client Key + Secret → Autorizar" },
    ],
  },
  facebook: {
    name: "Facebook / Meta Ads",
    icon: "🔵",
    steps: [
      { title: "Acesse o Meta Business Manager", detail: "business.facebook.com → certifique-se que tem uma Página e conta de anúncios ativa", url: "https://business.facebook.com" },
      { title: "Crie um App na Meta for Developers", detail: "developers.facebook.com → Meus Apps → Criar App → Negócios. Adicione o produto Facebook Login + Marketing API.", url: "https://developers.facebook.com" },
      { title: "Gere credenciais", detail: "Ferramentas → Gerador de Token → selecione sua Página → copie o Page Access Token e o Page ID." },
      { title: "Cole no NexOS AI", detail: "Configurações → Integrações → Facebook / Meta Ads → Colar credenciais → Conectar" },
    ],
  },
};

// ─── Inline social wizard (shown in BLOCKED state) ────────────────────────────

function SocialWizardBlock({ onClose }: { onClose: () => void }) {
  const [openPlatform, setOpenPlatform] = useState<string | null>("instagram");
  const [openStep, setOpenStep] = useState<number | null>(null);

  return (
    <div className="w-full space-y-3 text-left">
      <div className="font-mono text-[9px] text-red-400/50 uppercase tracking-widest">
        Conecte ao menos uma rede social para auto-post de criativos:
      </div>

      {Object.entries(SOCIAL_WIZARDS).map(([key, w]) => (
        <div key={key} className="border border-white/10">
          {/* Platform header */}
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/3 transition-colors"
            onClick={() => setOpenPlatform(openPlatform === key ? null : key)}
          >
            <span className="text-[18px]">{w.icon}</span>
            <span className="font-mono text-[10px] text-white/70 flex-1 text-left">{w.name}</span>
            {openPlatform === key
              ? <ChevronUp className="h-3 w-3 text-white/30" />
              : <ChevronDown className="h-3 w-3 text-white/30" />
            }
          </button>

          {openPlatform === key && (
            <div className="border-t border-white/5 divide-y divide-white/5">
              {w.steps.map((step, i) => (
                <div key={i}>
                  <button
                    className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-white/3 transition-colors"
                    onClick={() => setOpenStep(openStep === i ? null : i)}
                  >
                    <span className="font-mono text-[8px] text-white/20 w-4 shrink-0 mt-0.5">{i + 1}</span>
                    <span className="font-mono text-[9px] text-white/50 flex-1">{step.title}</span>
                    {step.url && (
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[7px] text-primary/50 border border-primary/20 px-1.5 py-0.5 hover:bg-primary/10 transition-colors shrink-0"
                      >
                        Abrir →
                      </a>
                    )}
                  </button>
                  {openStep === i && (
                    <div className="px-3 pb-2 pl-10">
                      <div className="font-mono text-[8px] text-white/30 leading-relaxed">{step.detail}</div>
                    </div>
                  )}
                </div>
              ))}

              {/* Connect CTA */}
              <div className="px-3 py-2.5 flex items-center gap-3 bg-white/2">
                <div className="flex-1 font-mono text-[8px] text-white/25">Após configurar, cole as credenciais em:</div>
                <Link href="/integracoes">
                  <button
                    onClick={onClose}
                    className="font-mono text-[8px] bg-primary/80 hover:bg-primary text-black px-3 py-1.5 uppercase tracking-widest font-bold transition-colors"
                  >
                    Conectar Agora →
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Platform mock renderers (exported for gallery reuse) ─────────────────────

export function InstagramMock({ text, expanded = false }: { text: string; expanded?: boolean }) {
  return (
    <div className={`w-full ${expanded ? "max-w-sm" : "max-w-[280px]"} mx-auto bg-[#0a0a0a] border border-white/10 overflow-hidden text-left`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shrink-0" />
        <div><div className="font-mono text-[10px] text-white/80">@nexosai</div><div className="font-mono text-[8px] text-white/30">Patrocinado</div></div>
        <div className="ml-auto font-mono text-[14px] text-white/30">···</div>
      </div>
      <div className={`${expanded ? "min-h-48" : "h-40"} bg-gradient-to-br from-purple-900/50 via-pink-900/30 to-indigo-900/50 flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">CRIATIVO IA</div>
          <div className={`font-mono text-[11px] text-white/70 leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{text || "Conteúdo gerado pelo agente Copywriter"}</div>
        </div>
      </div>
      <div className="px-3 py-2 flex items-center gap-3 border-t border-white/5">
        <span className="text-[14px]">♡</span><span className="text-[14px]">💬</span><span className="text-[14px]">↗</span>
        <span className="ml-auto font-mono text-[8px] text-white/20">2.4k curtidas</span>
      </div>
    </div>
  );
}

export function WhatsAppMock({ text, expanded = false }: { text: string; expanded?: boolean }) {
  return (
    <div className={`w-full ${expanded ? "max-w-sm" : "max-w-[280px]"} mx-auto bg-[#0b1418] border border-white/10 overflow-hidden text-left`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1f2c33]">
        <div className="w-7 h-7 rounded-full bg-green-600/40 flex items-center justify-center shrink-0"><span className="text-[10px]">💬</span></div>
        <div><div className="font-mono text-[10px] text-white/80">WhatsApp Business</div><div className="font-mono text-[8px] text-green-400/60">● online</div></div>
      </div>
      <div className="p-3 space-y-2">
        <div className="max-w-[90%] ml-auto bg-[#005c4b] rounded-tl-xl rounded-br-xl rounded-bl-xl px-3 py-2">
          <div className={`font-mono text-[10px] text-white/80 leading-relaxed ${expanded ? "" : "line-clamp-4"}`}>{text || "Olá! Temos uma novidade especial para você. Acesse agora e garanta sua vaga exclusiva..."}</div>
          <div className="font-mono text-[7px] text-white/30 text-right mt-1">✓✓ agora</div>
        </div>
      </div>
    </div>
  );
}

export function EmailMock({ text, piece, expanded = false }: { text: string; piece: ContentPiece; expanded?: boolean }) {
  const subj = (piece.title ?? extractPieceText(piece.content)).slice(0, 60) || "Assunto do email de lançamento";
  return (
    <div className={`w-full ${expanded ? "max-w-sm" : "max-w-[280px]"} mx-auto bg-[#0a0a0a] border border-white/10 overflow-hidden text-left`}>
      <div className="px-3 py-2 border-b border-white/5 space-y-1">
        <div className="flex gap-2"><span className="font-mono text-[8px] text-white/25 w-8 shrink-0">DE</span><span className="font-mono text-[9px] text-white/50">contato@nexos.ai</span></div>
        <div className="flex gap-2"><span className="font-mono text-[8px] text-white/25 w-8 shrink-0">PARA</span><span className="font-mono text-[9px] text-white/50">lista de leads</span></div>
        <div className="flex gap-2"><span className="font-mono text-[8px] text-white/25 w-8 shrink-0">ASS.</span><span className="font-mono text-[9px] text-white/70 font-bold line-clamp-1">{subj}</span></div>
      </div>
      <div className="px-3 py-3">
        <div className={`font-mono text-[10px] text-white/50 leading-relaxed ${expanded ? "" : "line-clamp-5"}`}>{text || "Corpo do email com copy persuasivo e CTA principal..."}</div>
      </div>
    </div>
  );
}

export function VSLMock({ text, expanded = false }: { text: string; expanded?: boolean }) {
  return (
    <div className={`w-full ${expanded ? "max-w-sm" : "max-w-[280px]"} mx-auto bg-black border border-white/10 overflow-hidden text-left`}>
      <div className={`${expanded ? "h-48" : "h-36"} bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center relative`}>
        <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center mb-2"><span className="text-[20px] ml-1">▶</span></div>
        <div className="font-mono text-[8px] text-white/30 uppercase tracking-widest">Script VSL</div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10" />
        <div className="absolute bottom-2 right-2 font-mono text-[8px] text-white/20">00:00 / --:--</div>
      </div>
      <div className="px-3 py-2">
        <div className={`font-mono text-[10px] text-white/40 leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{text || "Roteiro completo de vídeo de vendas gerado pelo agente VSL Writer..."}</div>
      </div>
    </div>
  );
}

export function AdMock({ text, piece, expanded = false }: { text: string; piece: ContentPiece; expanded?: boolean }) {
  return (
    <div className={`w-full ${expanded ? "max-w-sm" : "max-w-[280px]"} mx-auto bg-[#0a0a14] border border-white/10 overflow-hidden text-left`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <div className="w-6 h-6 rounded-sm bg-blue-600/40 flex items-center justify-center text-[10px] shrink-0">f</div>
        <div><div className="font-mono text-[9px] text-white/70">NexOS AI</div><div className="font-mono text-[7px] text-white/25">Patrocinado</div></div>
      </div>
      <div className={`${expanded ? "min-h-32" : "h-24"} bg-gradient-to-br from-blue-900/30 to-purple-900/20 flex items-center justify-center p-3`}>
        <div className={`font-mono text-[10px] text-white/40 text-center leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{text || "Copy persuasivo com gatilhos mentais e oferta irresistível..."}</div>
      </div>
      <div className="px-3 py-2 flex items-center justify-between border-t border-white/5">
        <div className="font-mono text-[9px] text-white/40">{piece.platform ?? "nexos.ai"}</div>
        <div className="font-mono text-[8px] border border-blue-400/30 text-blue-400/70 px-2 py-0.5">SAIBA MAIS</div>
      </div>
    </div>
  );
}

export function GenericMock({ text, piece, expanded = false }: { text: string; piece: ContentPiece; expanded?: boolean }) {
  const label = PIECE_LABELS[piece.type] ?? piece.type;
  return (
    <div className={`w-full ${expanded ? "max-w-sm" : "max-w-[280px]"} mx-auto bg-[#0a0a0a] border border-white/10 overflow-hidden text-left`}>
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        <FileText className="h-3 w-3 text-white/20 shrink-0" />
        <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">{label}</span>
      </div>
      <div className="px-3 py-4">
        <div className={`font-mono text-[10px] text-white/50 leading-relaxed ${expanded ? "" : "line-clamp-6"}`}>{text || "Conteúdo gerado pelos agentes NexOS AI..."}</div>
      </div>
    </div>
  );
}

export function PieceMock({ piece, expanded = false }: { piece: ContentPiece; expanded?: boolean }) {
  const text = extractPieceText(piece.content);
  const t = piece.type; const p = piece.platform ?? "";
  if (t === "vsl_script" || t === "video_script" || t === "cpl_script") return <VSLMock text={text} expanded={expanded} />;
  if (t === "email_sequence" || t === "sales_letter" || t === "landing_page_copy") return <EmailMock text={text} piece={piece} expanded={expanded} />;
  if (t === "whatsapp_message" || t === "launch_sequence") return <WhatsAppMock text={text} expanded={expanded} />;
  if (t === "ad_copy" || p.includes("ads") || p.includes("meta") || p.includes("google")) return <AdMock text={text} piece={piece} expanded={expanded} />;
  if (t === "social_post" || t === "story_sequence" || p.includes("instagram") || p.includes("tiktok")) return <InstagramMock text={text} expanded={expanded} />;
  return <GenericMock text={text} piece={piece} expanded={expanded} />;
}

// ─── Scan stage renderer ──────────────────────────────────────────────────────

function ScanStage({ item }: { item: ScanItem }) {
  if (item.kind === "phase") return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="font-mono text-[10px] text-primary/40 uppercase tracking-[0.3em]">{item.phaseDetail}</div>
      <div className="font-mono text-[22px] font-bold text-white/90 tracking-widest uppercase">{item.phaseLabel}</div>
      <div className="w-16 h-px bg-primary/30" />
    </div>
  );

  if (item.kind === "briefing") return (
    <div className="flex flex-col items-center gap-2">
      <div className="font-mono text-[9px] text-white/20 uppercase tracking-[0.3em]">{item.field}</div>
      <div className="font-mono text-[15px] text-white/80 text-center max-w-sm leading-relaxed">{item.value || <span className="text-white/20 italic">não definido</span>}</div>
    </div>
  );

  if (item.kind === "piece") {
    const piece = item.piece!;
    const label = PIECE_LABELS[piece.type] ?? piece.type;
    const ok = piece.status === "approved";
    return (
      <div className="flex flex-col items-center gap-3 w-full">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[9px] text-white/25 uppercase tracking-[0.2em]">{label}</div>
          <div className={`font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 border ${ok ? "border-green-400/30 text-green-400/70" : "border-yellow-400/30 text-yellow-400/70"}`}>{STATUS_LABEL[piece.status] ?? piece.status}</div>
          <div className="font-mono text-[8px] text-white/15">{item.pieceIdx}/{item.pieceTotal}</div>
        </div>
        <PieceMock piece={piece} />
      </div>
    );
  }

  if (item.kind === "integration") {
    const ok = item.intConnected!;
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="text-[36px]">{item.intIcon}</div>
        <div className="font-mono text-[13px] text-white/70">{item.intLabel}</div>
        <div className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest ${ok ? "text-green-400" : "text-red-400"}`}>
          {ok ? <><CheckCircle2 className="h-4 w-4" /> CONECTADO</> : <><XCircle className="h-4 w-4" /> NÃO CONECTADO</>}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

type ScannerState = "loading" | "scanning" | "gallery" | "approved" | "blocked" | "done";

export function LaunchAuditScanner({ campaignId, campaignName, intakeData, onClose, onConfirmLaunch, launching }: Props) {
  const [scannerState, setScannerState] = useState<ScannerState>("loading");
  const [items, setItems]     = useState<ScanItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [gates, setGates]     = useState<GateResult[]>([]);
  const [allPieces, setAllPieces] = useState<ContentPiece[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  // ── Build scan items ────────────────────────────────────────────────────────
  const buildItems = useCallback((integrations: Integration[], pieces: ContentPiece[]): ScanItem[] => {
    const list: ScanItem[] = [];
    let uid = 0;
    const id = () => String(uid++);

    list.push({ id: id(), kind: "phase", ms: 650, phaseLabel: "BRIEFING", phaseDetail: "Verificando dados da campanha" });
    const productName = getNestedStr(intakeData, "product.name", "productName", "produto");
    const audience    = getNestedStr(intakeData, "audience.description", "audience.primaryPersona", "targetAudience", "audience");
    const track       = getNestedStr(intakeData, "launch.track", "track", "trilha");
    const revenue     = getNestedStr(intakeData, "campaign.revenueTarget", "revenueTarget", "meta");
    if (productName) list.push({ id: id(), kind: "briefing", ms: 400, field: "PRODUTO", value: productName });
    if (audience)    list.push({ id: id(), kind: "briefing", ms: 430, field: "PARA QUEM", value: audience.slice(0, 180) });
    if (revenue)     list.push({ id: id(), kind: "briefing", ms: 380, field: "META DE RECEITA", value: `R$ ${revenue}` });
    if (track)       list.push({ id: id(), kind: "briefing", ms: 360, field: "TRILHA", value: track.toUpperCase() });

    if (pieces.length > 0) {
      list.push({ id: id(), kind: "phase", ms: 600, phaseLabel: "CRIATIVOS", phaseDetail: `${pieces.length} peça${pieces.length !== 1 ? "s" : ""} em análise` });
      pieces.forEach((p, i) => list.push({ id: id(), kind: "piece", ms: 650, piece: p, pieceIdx: i + 1, pieceTotal: pieces.length }));
    }

    list.push({ id: id(), kind: "phase", ms: 600, phaseLabel: "INTEGRAÇÕES", phaseDetail: "Verificando canais de disparo" });
    const isConn = (ps: string[]) => integrations.some(i => ps.includes(i.provider) && i.status === "connected");
    const whatsConn = integrations.find(i => i.provider === "whatsapp_business" && i.status === "connected");
    list.push({ id: id(), kind: "integration", ms: 480, intLabel: whatsConn ? "WhatsApp Business" : "Canal de Mensagens", intIcon: "💬", intConnected: isConn(["whatsapp_business", "telegram"]) });
    list.push({ id: id(), kind: "integration", ms: 480, intLabel: "Plataforma de Email", intIcon: "📧", intConnected: isConn(["rd_station", "activecampaign"]) });
    list.push({ id: id(), kind: "integration", ms: 480, intLabel: "Redes Sociais", intIcon: "📸", intConnected: isConn(["instagram", "meta_ads", "tiktok_ads"]) });

    return list;
  }, [intakeData]);

  // ── Compute gates ───────────────────────────────────────────────────────────
  const computeGates = useCallback((integrations: Integration[], pieces: ContentPiece[]): GateResult[] => {
    const isConn = (ps: string[]) => integrations.some(i => ps.includes(i.provider) && i.status === "connected");
    const hasMsg    = isConn(["whatsapp_business", "telegram"]);
    const hasEmail  = isConn(["rd_station", "activecampaign"]);
    const hasSocial = isConn(["instagram", "meta_ads", "tiktok_ads"]);
    const total    = pieces.length;
    const approved = pieces.filter(p => p.status === "approved").length;
    const pending  = pieces.filter(p => p.status !== "approved").length;
    const allApproved = total > 0 && pending === 0;

    return [
      {
        id: "messaging", label: "Canal de Mensagens", passed: hasMsg, blocker: true,
        detail: hasMsg ? "WhatsApp Business ou Telegram conectado" : "WhatsApp Business ou Telegram é obrigatório para disparar sequências",
        actionLabel: hasMsg ? undefined : "Conectar", actionUrl: hasMsg ? undefined : "/integracoes",
      },
      {
        id: "email", label: "Plataforma de Email", passed: hasEmail, blocker: true,
        detail: hasEmail ? "RD Station ou ActiveCampaign conectado" : "RD Station ou ActiveCampaign é obrigatório para disparar emails",
        actionLabel: hasEmail ? undefined : "Conectar", actionUrl: hasEmail ? undefined : "/integracoes",
      },
      {
        id: "content", label: "Aprovação de Conteúdo", passed: allApproved || total === 0,
        blocker: total > 0 && !allApproved,
        detail: total === 0 ? "Nenhuma peça — gere conteúdo antes de lançar" : allApproved ? `${approved} peça${approved !== 1 ? "s" : ""} aprovada${approved !== 1 ? "s" : ""}` : `${pending} peça${pending !== 1 ? "s" : ""} aguardando revisão`,
        actionLabel: (total > 0 && !allApproved) ? "Revisar" : undefined,
        actionUrl:   (total > 0 && !allApproved) ? `/campaigns/${campaignId}/content` : undefined,
      },
      {
        id: "social", label: "Redes Sociais", passed: hasSocial,
        blocker: true,  // ← now a hard blocker
        detail: hasSocial ? "Instagram/Meta/TikTok conectado — auto-post ativo" : "Conecte ao menos uma rede social para publicar os criativos gerados",
        actionLabel: hasSocial ? undefined : "Como Conectar",
        actionUrl: hasSocial ? undefined : "/integracoes",
      },
    ];
  }, [campaignId]);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      customFetch<{ integrations: Integration[] }>("/api/workspaces/me/integrations").catch(() => ({ integrations: [] as Integration[] })),
      customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${campaignId}/content`).catch(() => ({ pieces: [] as ContentPiece[] })),
    ]).then(([intRes, contRes]) => {
      if (cancelled) return;
      const integrations = intRes.integrations ?? [];
      const pieces       = contRes.pieces ?? [];
      setAllPieces(pieces);
      setItems(buildItems(integrations, pieces));
      setGates(computeGates(integrations, pieces));
      setScannerState("scanning");
    });
    return () => { cancelled = true; };
  }, [campaignId, buildItems, computeGates]);

  // ── Animation ticker ────────────────────────────────────────────────────────
  useEffect(() => {
    if (scannerState !== "scanning" || items.length === 0) return;
    const advance = (idx: number) => {
      if (idx >= items.length) { setScannerState("done"); return; }
      timerRef.current = setTimeout(() => { setCurrentIdx(idx + 1); advance(idx + 1); }, items[idx]?.ms ?? 500);
    };
    setCurrentIdx(0);
    advance(0);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scannerState, items]);

  // ── After scan: go to gallery or direct verdict ─────────────────────────────
  useEffect(() => {
    if (scannerState !== "done") return;
    const t = setTimeout(() => {
      if (allPieces.length > 0) {
        setScannerState("gallery");
      } else {
        const hasBlocker = gates.some(g => !g.passed && g.blocker);
        setScannerState(hasBlocker ? "blocked" : "approved");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [scannerState, allPieces.length, gates]);

  // ── From gallery: proceed to verdict ───────────────────────────────────────
  const proceedFromGallery = useCallback(() => {
    const hasBlocker = gates.some(g => !g.passed && g.blocker);
    setScannerState(hasBlocker ? "blocked" : "approved");
  }, [gates]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const progress = items.length > 0 ? Math.min((currentIdx / items.length) * 100, 100) : 0;
  const currentItem = items[Math.min(currentIdx, items.length - 1)];
  const blockers = gates.filter(g => !g.passed && g.blocker);
  const hasSocialBlock = blockers.some(g => g.id === "social");

  // ── Render ──────────────────────────────────────────────────────────────────
  const overlay = (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" style={{ fontFamily: "'JetBrains Mono','Fira Mono',monospace" }}>
      {/* scan lines */}
      <div className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.1) 2px,rgba(255,255,255,.1) 4px)" }} />

      {/* header */}
      <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          <span className="font-mono text-[9px] sm:text-[10px] text-white/30 uppercase tracking-[0.2em] sm:tracking-[0.3em]">NEXOS — AUDITORIA PRÉ-LANÇAMENTO</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="font-mono text-[9px] text-white/15 uppercase tracking-widest truncate max-w-[120px] sm:max-w-[200px] hidden sm:block">{campaignName}</span>
          {(scannerState === "blocked" || scannerState === "approved" || scannerState === "gallery") && (
            <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors"><X className="h-4 w-4" /></button>
          )}
        </div>
      </div>

      {/* progress bar */}
      <div className="relative z-20 h-0.5 bg-white/5">
        <div className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${scannerState === "loading" ? 0 : scannerState === "approved" || scannerState === "blocked" ? 100 : scannerState === "gallery" ? 85 : progress}%` }} />
      </div>

      {/* main stage */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 overflow-hidden">

        {/* LOADING */}
        {scannerState === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 text-primary/50 animate-spin" />
            <div className="font-mono text-[11px] text-white/30 uppercase tracking-widest">Preparando auditoria...</div>
          </div>
        )}

        {/* SCANNING */}
        {scannerState === "scanning" && currentItem && (
          <div className="w-full flex flex-col items-center gap-5">
            <div className="font-mono text-[9px] text-white/15 uppercase tracking-[0.4em]">ITEM {Math.min(currentIdx + 1, items.length)} · {items.length} TOTAL</div>
            <div key={currentItem.id} className="w-full flex flex-col items-center" style={{ animation: "fadeSlideIn .18s ease-out forwards" }}>
              <ScanStage item={currentItem} />
            </div>
            <div className="font-mono text-[9px] text-white/15 uppercase tracking-widest">
              {currentItem.kind === "briefing" ? "BRIEFING" : currentItem.kind === "piece" ? "CRIATIVOS" : currentItem.kind === "integration" ? "INTEGRAÇÕES" : ""}
            </div>
          </div>
        )}

        {/* DONE */}
        {scannerState === "done" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 text-primary/50 animate-spin" />
            <div className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Analisando resultado...</div>
          </div>
        )}

        {/* ── GALLERY — all pieces for visual review ── */}
        {scannerState === "gallery" && (
          <div className="w-full max-w-lg flex flex-col h-full">
            {/* Gallery header */}
            <div className="flex flex-col items-center gap-2 mb-4 shrink-0">
              <div className="font-mono text-[9px] text-primary/40 uppercase tracking-[0.3em]">Revisão Final de Criativos</div>
              <div className="font-mono text-[18px] font-bold text-white/90 tracking-widest">GALERIA DE CONTEÚDO</div>
              <div className="font-mono text-[9px] text-white/25 text-center">
                Revise cada peça abaixo. Quando estiver satisfeito, clique em Continuar.
              </div>
            </div>

            {/* Scrollable pieces grid */}
            <div ref={galleryRef} className="flex-1 overflow-y-auto space-y-5 pb-4 pr-1" style={{ maxHeight: "calc(100vh - 320px)" }}>
              {allPieces.map((piece, i) => {
                const label = PIECE_LABELS[piece.type] ?? piece.type;
                const ok = piece.status === "approved";
                return (
                  <div key={piece.id} className="flex flex-col items-center gap-2" style={{ animation: `fadeSlideIn .25s ease-out ${i * 60}ms both` }}>
                    <div className="flex items-center gap-2 w-full max-w-sm justify-center">
                      <span className="font-mono text-[8px] text-white/20 uppercase tracking-widest">{i + 1}.</span>
                      <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">{label}</span>
                      <span className={`font-mono text-[7px] uppercase tracking-widest px-1.5 py-0.5 border ml-auto ${ok ? "border-green-400/30 text-green-400/60" : "border-yellow-400/30 text-yellow-400/60"}`}>
                        {STATUS_LABEL[piece.status] ?? piece.status}
                      </span>
                    </div>
                    <PieceMock piece={piece} expanded />
                  </div>
                );
              })}
              {allPieces.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="font-mono text-[11px] text-white/25">Nenhuma peça encontrada</div>
                </div>
              )}
            </div>

            {/* Continue CTA */}
            <div className="shrink-0 pt-4 space-y-2 border-t border-white/5">
              <div className="font-mono text-[8px] text-white/20 text-center uppercase tracking-widest">
                {allPieces.length > 0 ? `${allPieces.filter(p => p.status === "approved").length} de ${allPieces.length} peças aprovadas` : ""}
              </div>
              <Button
                onClick={proceedFromGallery}
                className="w-full h-11 rounded-none font-mono text-[10px] uppercase tracking-[0.25em] bg-primary/90 hover:bg-primary text-black font-bold"
              >
                Revisei tudo — Continuar para Auditoria →
              </Button>
            </div>
          </div>
        )}

        {/* APPROVED */}
        {scannerState === "approved" && (
          <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full border border-green-400/30 flex items-center justify-center" style={{ animation: "pulseScale .5s ease-out" }}>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <div className="font-mono text-[28px] font-bold text-green-400 tracking-widest">APROVADO</div>
              <div className="font-mono text-[10px] text-white/30 uppercase tracking-[0.3em]">Campanha cleared for launch</div>
            </div>
            <div className="w-full space-y-2">
              {gates.map(g => (
                <div key={g.id} className="flex items-center gap-3 px-3 py-2 border border-white/5">
                  {g.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                  <div className="flex-1 text-left">
                    <div className="font-mono text-[10px] text-white/60">{g.label}</div>
                    <div className="font-mono text-[9px] text-white/30">{g.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            {!showConfirm ? (
              <Button onClick={() => setShowConfirm(true)} className="w-full h-12 rounded-none font-mono text-[11px] uppercase tracking-[0.3em] bg-green-500 hover:bg-green-400 text-black font-bold">
                <Rocket className="h-4 w-4 mr-2" /> Confirmar Lançamento
              </Button>
            ) : (
              <div className="w-full space-y-3">
                <div className="font-mono text-[10px] text-white/40 text-center uppercase tracking-widest">Esta ação inicia o lançamento. Confirme:</div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setShowConfirm(false)} className="flex-1 h-10 rounded-none font-mono text-[10px] uppercase border border-white/10 text-white/40">Cancelar</Button>
                  <Button onClick={onConfirmLaunch} disabled={launching} className="flex-1 h-10 rounded-none font-mono text-[10px] uppercase bg-green-500 hover:bg-green-400 text-black font-bold">
                    {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "🚀 LANÇAR AGORA"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BLOCKED */}
        {scannerState === "blocked" && (
          <div className="w-full max-w-md overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
            <div className="flex flex-col items-center gap-4 text-center pb-2">
              <div className="w-14 h-14 rounded-full border border-red-400/30 flex items-center justify-center" style={{ animation: "pulseScale .5s ease-out" }}>
                <XCircle className="h-7 w-7 text-red-400" />
              </div>
              <div className="font-mono text-[26px] font-bold text-red-400 tracking-widest">BLOQUEADO</div>
              <div className="font-mono text-[10px] text-white/30 uppercase tracking-[0.2em]">Corrija os itens abaixo para lançar</div>
            </div>

            <div className="space-y-3 mt-4">
              {/* Hard blockers */}
              {blockers.map(g => (
                <div key={g.id} className="border border-red-400/20 bg-red-400/5">
                  <div className="flex items-start gap-3 px-3 py-3">
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 text-left">
                      <div className="font-mono text-[10px] text-red-400/80 font-bold">{g.label}</div>
                      <div className="font-mono text-[9px] text-white/35 mt-0.5">{g.detail}</div>
                    </div>
                    {g.actionUrl && g.id !== "social" && (
                      <Link href={g.actionUrl}>
                        <button onClick={onClose} className="font-mono text-[8px] text-red-400/60 border border-red-400/20 px-2 py-0.5 uppercase tracking-widest hover:bg-red-400/10 transition-colors whitespace-nowrap shrink-0">
                          {g.actionLabel}
                        </button>
                      </Link>
                    )}
                  </div>

                  {/* Social-specific inline wizard */}
                  {g.id === "social" && hasSocialBlock && (
                    <div className="border-t border-red-400/10 px-3 pb-3 pt-2">
                      <SocialWizardBlock onClose={onClose} />
                    </div>
                  )}
                </div>
              ))}

              {/* Passing gates */}
              {gates.filter(g => g.passed).length > 0 && (
                <div className="space-y-1 pt-1">
                  {gates.filter(g => g.passed).map(g => (
                    <div key={g.id} className="flex items-center gap-2 px-3 py-1.5 border border-white/5">
                      <CheckCircle2 className="h-3 w-3 text-green-400/60 shrink-0" />
                      <span className="font-mono text-[9px] text-white/30 flex-1">{g.label}</span>
                      <span className="font-mono text-[8px] text-green-400/40">✓</span>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={onClose} variant="ghost" className="w-full h-10 rounded-none font-mono text-[10px] uppercase tracking-widest border border-white/10 text-white/40 hover:text-white/70 mt-2">
                Fechar e Corrigir
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* bottom bar */}
      {scannerState === "scanning" && (
        <div className="relative z-20 border-t border-white/5 px-4 sm:px-6 py-2 flex items-center justify-between">
          <div className="font-mono text-[8px] text-white/15 uppercase tracking-widest">
            {currentItem?.kind === "piece" ? `CRIATIVO ${currentItem.pieceIdx}/${currentItem.pieceTotal}` : currentItem?.kind === "integration" ? "INTEGRAÇÃO" : currentItem?.kind === "briefing" ? "BRIEFING" : ""}
          </div>
          <div className="font-mono text-[8px] text-white/10 uppercase tracking-widest">{Math.round(progress)}% VARRIDO</div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulseScale { 0% { transform:scale(.7);opacity:0; } 60% { transform:scale(1.05);opacity:1; } 100% { transform:scale(1);opacity:1; } }
      `}</style>
    </div>
  );

  return createPortal(overlay, document.body);
}
