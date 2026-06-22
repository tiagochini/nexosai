/**
 * LaunchAuditScanner — Cinematic pre-launch audit overlay.
 *
 * Triggered when the user clicks "Lançar Campanha". Scans through briefing
 * fields, every content piece (shown as platform mocks), and integrations at
 * brain-capture pace. Ends with APROVADO → confirms launch, or BLOQUEADO →
 * shows exactly what needs to be fixed.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  CheckCircle2, XCircle, AlertTriangle, Rocket, X,
  MessageCircle, Mail, Users, FileText, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Integration { id: string; provider: string; status: string; }
interface ContentPiece {
  id: string; type: string; status: string;
  platform?: string; title?: string; content?: unknown;
}

type ScanKind = "phase" | "briefing" | "piece" | "integration";

interface ScanItem {
  id: string;
  kind: ScanKind;
  ms: number;          // display duration in ms
  // phase
  phaseLabel?: string;
  phaseDetail?: string;
  // briefing
  field?: string;
  value?: string;
  // content piece
  piece?: ContentPiece;
  pieceIdx?: number;
  pieceTotal?: number;
  // integration
  intLabel?: string;
  intIcon?: string;
  intConnected?: boolean;
}

interface GateResult {
  id: string;
  label: string;
  passed: boolean;
  blocker: boolean;    // true = hard block, false = warning only
  detail: string;
  actionLabel?: string;
  actionUrl?: string;
}

interface Props {
  campaignId: string;
  campaignName: string;
  intakeData: Record<string, unknown>;
  onClose: () => void;
  onConfirmLaunch: () => void;
  launching: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNestedStr(obj: Record<string, unknown>, ...paths: string[]): string {
  for (const path of paths) {
    const parts = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = obj;
    for (const p of parts) { if (cur && typeof cur === "object") cur = cur[p]; else { cur = undefined; break; } }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
    if (typeof cur === "number") return String(cur);
  }
  return "";
}

function extractPieceText(content: unknown): string {
  if (typeof content === "string") return content.slice(0, 220);
  if (!content || typeof content !== "object") return "";
  const obj = content as Record<string, unknown>;
  const keys = ["headline","subject","hook","opening","body","copy","text","message","description","title","content","script"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 8) return v.slice(0, 220);
  }
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && v.length > 20) return v.slice(0, 220);
  }
  return "";
}

const PIECE_LABELS: Record<string, string> = {
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

// ─── Platform mock renderers ─────────────────────────────────────────────────

function InstagramMock({ text }: { text: string }) {
  return (
    <div className="w-full max-w-[280px] mx-auto bg-[#0a0a0a] border border-white/10 overflow-hidden text-left">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" />
        <div>
          <div className="font-mono text-[10px] text-white/80">@nexosai</div>
          <div className="font-mono text-[8px] text-white/30">Patrocinado</div>
        </div>
        <div className="ml-auto font-mono text-[14px] text-white/30">···</div>
      </div>
      {/* image area */}
      <div className="h-40 bg-gradient-to-br from-purple-900/50 via-pink-900/30 to-indigo-900/50 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">CRIATIVO IA</div>
          <div className="font-mono text-[11px] text-white/60 leading-relaxed line-clamp-3">{text || "Conteúdo gerado pelo agente Copywriter"}</div>
        </div>
      </div>
      {/* engagement row */}
      <div className="px-3 py-2 flex items-center gap-3 border-t border-white/5">
        <span className="text-[14px]">♡</span>
        <span className="text-[14px]">💬</span>
        <span className="text-[14px]">↗</span>
        <span className="ml-auto font-mono text-[8px] text-white/20">2.4k curtidas</span>
      </div>
    </div>
  );
}

function WhatsAppMock({ text }: { text: string }) {
  return (
    <div className="w-full max-w-[280px] mx-auto bg-[#0b1418] border border-white/10 overflow-hidden text-left">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1f2c33]">
        <div className="w-7 h-7 rounded-full bg-green-600/40 flex items-center justify-center">
          <span className="text-[10px]">💬</span>
        </div>
        <div>
          <div className="font-mono text-[10px] text-white/80">WhatsApp Business</div>
          <div className="font-mono text-[8px] text-green-400/60">● online</div>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="max-w-[85%] ml-auto bg-[#005c4b] rounded-tl-xl rounded-br-xl rounded-bl-xl px-3 py-2">
          <div className="font-mono text-[10px] text-white/80 leading-relaxed">{text.slice(0, 140) || "Olá! Temos uma novidade especial para você. Acesse agora e garanta sua vaga..."}</div>
          <div className="font-mono text-[7px] text-white/30 text-right mt-1">✓✓ agora</div>
        </div>
      </div>
    </div>
  );
}

function EmailMock({ text, piece }: { text: string; piece: ContentPiece }) {
  const subj = (piece.title ?? extractPieceText(piece.content)).slice(0, 60) || "Assunto do email de lançamento";
  return (
    <div className="w-full max-w-[280px] mx-auto bg-[#0a0a0a] border border-white/10 overflow-hidden text-left">
      <div className="px-3 py-2 border-b border-white/5 space-y-1">
        <div className="flex gap-2"><span className="font-mono text-[8px] text-white/25 w-8 shrink-0">DE</span><span className="font-mono text-[9px] text-white/50">contato@nexos.ai</span></div>
        <div className="flex gap-2"><span className="font-mono text-[8px] text-white/25 w-8 shrink-0">PARA</span><span className="font-mono text-[9px] text-white/50">lista de leads</span></div>
        <div className="flex gap-2"><span className="font-mono text-[8px] text-white/25 w-8 shrink-0">ASS.</span><span className="font-mono text-[9px] text-white/70 font-bold line-clamp-1">{subj}</span></div>
      </div>
      <div className="px-3 py-3">
        <div className="font-mono text-[10px] text-white/40 leading-relaxed line-clamp-4">{text || "Corpo do email com copy persuasivo e CTA principal..."}</div>
      </div>
    </div>
  );
}

function VSLMock({ text }: { text: string }) {
  return (
    <div className="w-full max-w-[280px] mx-auto bg-black border border-white/10 overflow-hidden text-left">
      <div className="h-36 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center relative">
        <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center mb-2">
          <span className="text-[20px] ml-1">▶</span>
        </div>
        <div className="font-mono text-[8px] text-white/30 uppercase tracking-widest">Script VSL</div>
        {/* progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div className="h-full bg-red-500 w-0 animate-pulse" style={{ width: "0%" }} />
        </div>
        <div className="absolute bottom-2 right-2 font-mono text-[8px] text-white/20">00:00 / --:--</div>
      </div>
      <div className="px-3 py-2">
        <div className="font-mono text-[10px] text-white/40 line-clamp-2">{text.slice(0, 100) || "Roteiro completo de vídeo de vendas gerado pelo agente VSL Writer..."}</div>
      </div>
    </div>
  );
}

function AdMock({ text, piece }: { text: string; piece: ContentPiece }) {
  const platform = piece.platform ?? "meta_ads";
  const isPaid = platform.includes("ads") || platform.includes("meta") || platform.includes("google") || platform.includes("tiktok");
  return (
    <div className="w-full max-w-[280px] mx-auto bg-[#0a0a14] border border-white/10 overflow-hidden text-left">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <div className="w-6 h-6 rounded-sm bg-blue-600/40 flex items-center justify-center text-[10px]">f</div>
        <div>
          <div className="font-mono text-[9px] text-white/70">NexOS AI</div>
          <div className="font-mono text-[7px] text-white/25">{isPaid ? "Patrocinado" : "Publicidade"}</div>
        </div>
      </div>
      <div className="h-24 bg-gradient-to-br from-blue-900/30 to-purple-900/20 flex items-center justify-center">
        <div className="font-mono text-[9px] text-white/30 text-center px-3 line-clamp-3">{text.slice(0, 120) || "Copy persuasivo do anúncio com gatilhos mentais e oferta irresistível..."}</div>
      </div>
      <div className="px-3 py-2 flex items-center justify-between border-t border-white/5">
        <div className="font-mono text-[9px] text-white/40">nexos.ai</div>
        <div className="font-mono text-[8px] border border-blue-400/30 text-blue-400/70 px-2 py-0.5">SAIBA MAIS</div>
      </div>
    </div>
  );
}

function GenericMock({ text, piece }: { text: string; piece: ContentPiece }) {
  const label = PIECE_LABELS[piece.type] ?? piece.type;
  return (
    <div className="w-full max-w-[280px] mx-auto bg-[#0a0a0a] border border-white/10 overflow-hidden text-left">
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        <FileText className="h-3 w-3 text-white/20" />
        <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">{label}</span>
      </div>
      <div className="px-3 py-4">
        <div className="font-mono text-[10px] text-white/50 leading-relaxed line-clamp-5">{text || "Conteúdo gerado pelos agentes NexOS AI..."}</div>
      </div>
    </div>
  );
}

function PieceMock({ piece }: { piece: ContentPiece }) {
  const text = extractPieceText(piece.content);
  const t = piece.type;
  const p = piece.platform ?? "";
  if (t === "vsl_script" || t === "video_script" || t === "cpl_script") return <VSLMock text={text} />;
  if (t === "email_sequence" || t === "sales_letter" || t === "landing_page_copy") return <EmailMock text={text} piece={piece} />;
  if (t === "whatsapp_message" || t === "launch_sequence") return <WhatsAppMock text={text} />;
  if (t === "ad_copy" || p.includes("ads") || p.includes("meta") || p.includes("google") || p.includes("tiktok")) return <AdMock text={text} piece={piece} />;
  if (t === "social_post" || t === "story_sequence" || p.includes("instagram") || p.includes("tiktok")) return <InstagramMock text={text} />;
  return <GenericMock text={text} piece={piece} />;
}

// ─── Scan item renderer ───────────────────────────────────────────────────────

function ScanStage({ item, key: _k }: { item: ScanItem; key: string }) {
  if (item.kind === "phase") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 animate-fade-in">
        <div className="font-mono text-[10px] text-primary/40 uppercase tracking-[0.3em]">
          {item.phaseDetail}
        </div>
        <div className="font-mono text-[22px] font-bold text-white/90 tracking-widest uppercase">
          {item.phaseLabel}
        </div>
        <div className="w-16 h-px bg-primary/30" />
      </div>
    );
  }

  if (item.kind === "briefing") {
    return (
      <div className="flex flex-col items-center gap-2 animate-fade-in">
        <div className="font-mono text-[9px] text-white/20 uppercase tracking-[0.3em]">{item.field}</div>
        <div className="font-mono text-[15px] text-white/80 text-center max-w-sm leading-relaxed">
          {item.value || <span className="text-white/20 italic">não definido</span>}
        </div>
      </div>
    );
  }

  if (item.kind === "piece") {
    const piece = item.piece!;
    const label = PIECE_LABELS[piece.type] ?? piece.type;
    const statusOk = piece.status === "approved";
    return (
      <div className="flex flex-col items-center gap-3 animate-fade-in w-full">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[9px] text-white/25 uppercase tracking-[0.2em]">{label}</div>
          <div className={`font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 border ${
            statusOk
              ? "border-green-400/30 text-green-400/70"
              : "border-yellow-400/30 text-yellow-400/70"
          }`}>
            {STATUS_LABEL[piece.status] ?? piece.status}
          </div>
          <div className="font-mono text-[8px] text-white/15">{item.pieceIdx}/{item.pieceTotal}</div>
        </div>
        <PieceMock piece={piece} />
      </div>
    );
  }

  if (item.kind === "integration") {
    const ok = item.intConnected!;
    return (
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="text-[36px]">{item.intIcon}</div>
        <div className="font-mono text-[13px] text-white/70">{item.intLabel}</div>
        <div className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest ${ok ? "text-green-400" : "text-red-400"}`}>
          {ok
            ? <><CheckCircle2 className="h-4 w-4" /> CONECTADO</>
            : <><XCircle className="h-4 w-4" /> NÃO CONECTADO</>
          }
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

type ScannerState = "loading" | "scanning" | "approved" | "blocked" | "done";

export function LaunchAuditScanner({ campaignId, campaignName, intakeData, onClose, onConfirmLaunch, launching }: Props) {
  const [scannerState, setScannerState] = useState<ScannerState>("loading");
  const [items, setItems]               = useState<ScanItem[]>([]);
  const [currentIdx, setCurrentIdx]     = useState(0);
  const [gates, setGates]               = useState<GateResult[]>([]);
  const [showConfirm, setShowConfirm]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build scan item list from fetched data ─────────────────────────────────
  const buildItems = useCallback((integrations: Integration[], pieces: ContentPiece[]): ScanItem[] => {
    const list: ScanItem[] = [];
    let uid = 0;
    const id = () => String(uid++);

    // ── Phase 1: Briefing ───────────────────────────────────────────────────
    list.push({ id: id(), kind: "phase", ms: 700, phaseLabel: "BRIEFING", phaseDetail: "Verificando dados da campanha" });

    const productName = getNestedStr(intakeData, "product.name", "productName", "produto");
    const audience    = getNestedStr(intakeData, "audience.description", "audience.primaryPersona", "targetAudience", "audience", "para_quem");
    const track       = getNestedStr(intakeData, "launch.track", "track", "trilha");
    const revenue     = getNestedStr(intakeData, "campaign.revenueTarget", "revenueTarget", "meta");

    if (productName) list.push({ id: id(), kind: "briefing", ms: 420, field: "PRODUTO", value: productName });
    if (audience)    list.push({ id: id(), kind: "briefing", ms: 460, field: "PARA QUEM", value: audience.slice(0, 180) });
    if (revenue)     list.push({ id: id(), kind: "briefing", ms: 400, field: "META DE RECEITA", value: `R$ ${revenue}` });
    if (track)       list.push({ id: id(), kind: "briefing", ms: 380, field: "TRILHA", value: track.toUpperCase() });

    // ── Phase 2: Criativos ─────────────────────────────────────────────────
    if (pieces.length > 0) {
      list.push({ id: id(), kind: "phase", ms: 700, phaseLabel: "CRIATIVOS", phaseDetail: `${pieces.length} peça${pieces.length !== 1 ? "s" : ""} verificando` });
      pieces.forEach((p, i) => {
        list.push({ id: id(), kind: "piece", ms: 680, piece: p, pieceIdx: i + 1, pieceTotal: pieces.length });
      });
    }

    // ── Phase 3: Integrações ───────────────────────────────────────────────
    list.push({ id: id(), kind: "phase", ms: 700, phaseLabel: "INTEGRAÇÕES", phaseDetail: "Verificando canais de disparo" });

    const isConn = (providers: string[]) => integrations.some(i => providers.includes(i.provider) && i.status === "connected");
    const hasMsg     = isConn(["whatsapp_business", "telegram"]);
    const hasEmail   = isConn(["rd_station", "activecampaign"]);
    const hasSocial  = isConn(["instagram", "meta_ads", "tiktok_ads"]);
    const whatsConn  = integrations.find(i => i.provider === "whatsapp_business" && i.status === "connected");

    list.push({ id: id(), kind: "integration", ms: 500, intLabel: whatsConn ? "WhatsApp Business" : "Canal de Mensagens", intIcon: "💬", intConnected: hasMsg });
    list.push({ id: id(), kind: "integration", ms: 500, intLabel: "Plataforma de Email", intIcon: "📧", intConnected: hasEmail });
    list.push({ id: id(), kind: "integration", ms: 500, intLabel: "Redes Sociais", intIcon: "📸", intConnected: hasSocial });

    return list;
  }, [intakeData]);

  // ── Compute gate results from fetched data ─────────────────────────────────
  const computeGates = useCallback((integrations: Integration[], pieces: ContentPiece[]): GateResult[] => {
    const isConn = (ps: string[]) => integrations.some(i => ps.includes(i.provider) && i.status === "connected");
    const hasMsg    = isConn(["whatsapp_business", "telegram"]);
    const hasEmail  = isConn(["rd_station", "activecampaign"]);
    const hasSocial = isConn(["instagram", "meta_ads", "tiktok_ads"]);
    const totalPieces   = pieces.length;
    const approvedCount = pieces.filter(p => p.status === "approved").length;
    const pendingCount  = pieces.filter(p => p.status !== "approved").length;
    const allApproved   = totalPieces > 0 && pendingCount === 0;

    return [
      {
        id: "messaging",
        label: "Canal de Mensagens",
        passed: hasMsg,
        blocker: true,
        detail: hasMsg
          ? "WhatsApp Business ou Telegram conectado"
          : "WhatsApp Business ou Telegram é obrigatório para disparar sequências",
        actionLabel: hasMsg ? undefined : "Conectar WhatsApp",
        actionUrl:   hasMsg ? undefined : "/integracoes",
      },
      {
        id: "email",
        label: "Plataforma de Email",
        passed: hasEmail,
        blocker: true,
        detail: hasEmail
          ? "RD Station ou ActiveCampaign conectado"
          : "RD Station ou ActiveCampaign é obrigatório para disparar emails",
        actionLabel: hasEmail ? undefined : "Conectar Email",
        actionUrl:   hasEmail ? undefined : "/integracoes",
      },
      {
        id: "content",
        label: "Aprovação de Conteúdo",
        passed: allApproved || totalPieces === 0,
        blocker: totalPieces > 0 && !allApproved,
        detail: totalPieces === 0
          ? "Nenhuma peça gerada — considere gerar conteúdo antes de lançar"
          : allApproved
            ? `${approvedCount} peça${approvedCount !== 1 ? "s" : ""} aprovada${approvedCount !== 1 ? "s" : ""}`
            : `${pendingCount} peça${pendingCount !== 1 ? "s" : ""} ainda não aprovada${pendingCount !== 1 ? "s" : ""}`,
        actionLabel: (totalPieces > 0 && !allApproved) ? "Revisar Criativos" : undefined,
        actionUrl:   (totalPieces > 0 && !allApproved) ? `/campaigns/${campaignId}/content` : undefined,
      },
      {
        id: "social",
        label: "Redes Sociais",
        passed: hasSocial,
        blocker: false, // warning only
        detail: hasSocial
          ? "Instagram/Meta/TikTok conectado — auto-post ativo"
          : "Sem rede social — auto-post de criativos desativado (lançamento prossegue)",
        actionLabel: hasSocial ? undefined : "Conectar Redes",
        actionUrl:   hasSocial ? undefined : "/integracoes",
      },
    ];
  }, [campaignId]);

  // ── Fetch data and kick off scan ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      customFetch<{ integrations: Integration[] }>("/api/workspaces/me/integrations").catch(() => ({ integrations: [] as Integration[] })),
      customFetch<{ pieces: ContentPiece[] }>(`/api/campaigns/${campaignId}/content`).catch(() => ({ pieces: [] as ContentPiece[] })),
    ]).then(([intRes, contRes]) => {
      if (cancelled) return;
      const integrations = intRes.integrations ?? [];
      const pieces       = contRes.pieces ?? [];
      const built        = buildItems(integrations, pieces);
      const gateResults  = computeGates(integrations, pieces);
      setItems(built);
      setGates(gateResults);
      setScannerState("scanning");
    });
    return () => { cancelled = true; };
  }, [campaignId, buildItems, computeGates]);

  // ── Animation ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    if (scannerState !== "scanning" || items.length === 0) return;
    const advance = (idx: number) => {
      if (idx >= items.length) {
        // All items scanned — compute final state
        setScannerState("done");
        return;
      }
      timerRef.current = setTimeout(() => {
        setCurrentIdx(idx + 1);
        advance(idx + 1);
      }, items[idx]?.ms ?? 500);
    };
    setCurrentIdx(0);
    advance(0);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scannerState, items]);

  // ── When "done", compute final verdict ────────────────────────────────────
  useEffect(() => {
    if (scannerState !== "done") return;
    const hasBlocker = gates.some(g => !g.passed && g.blocker);
    // Small pause before showing result
    const t = setTimeout(() => setScannerState(hasBlocker ? "blocked" : "approved"), 600);
    return () => clearTimeout(t);
  }, [scannerState, gates]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const progress = items.length > 0 ? Math.min((currentIdx / items.length) * 100, 100) : 0;
  const currentItem = items[Math.min(currentIdx, items.length - 1)];
  const blockers  = gates.filter(g => !g.passed && g.blocker);
  const warnings  = gates.filter(g => !g.passed && !g.blocker);

  // ── Render ─────────────────────────────────────────────────────────────────
  const overlay = (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Mono', monospace" }}
    >
      {/* ── Scan lines overlay effect ── */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
        }}
      />

      {/* ── Header bar ── */}
      <div className="relative z-20 flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[10px] text-white/30 uppercase tracking-[0.3em]">NEXOS — AUDITORIA PRÉ-LANÇAMENTO</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest truncate max-w-[200px]">{campaignName}</span>
          {(scannerState === "blocked" || scannerState === "approved") && (
            <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="relative z-20 h-0.5 bg-white/5">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${scannerState === "loading" ? 0 : scannerState === "approved" || scannerState === "blocked" ? 100 : progress}%` }}
        />
      </div>

      {/* ── Main stage ── */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-hidden">

        {/* LOADING */}
        {scannerState === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 text-primary/50 animate-spin" />
            <div className="font-mono text-[11px] text-white/30 uppercase tracking-widest">Preparando auditoria...</div>
          </div>
        )}

        {/* SCANNING */}
        {scannerState === "scanning" && currentItem && (
          <div className="w-full flex flex-col items-center gap-6">
            {/* Phase counter */}
            <div className="font-mono text-[9px] text-white/15 uppercase tracking-[0.4em]">
              ITEM {Math.min(currentIdx + 1, items.length)} · {items.length} TOTAL
            </div>

            {/* Current item */}
            <div
              key={currentItem.id}
              className="w-full flex flex-col items-center"
              style={{ animation: "fadeSlideIn 0.18s ease-out forwards" }}
            >
              <ScanStage item={currentItem} key={currentItem.id} />
            </div>

            {/* Phase label below */}
            <div className="font-mono text-[9px] text-white/15 uppercase tracking-widest">
              {currentItem.kind === "briefing" ? "BRIEFING" :
               currentItem.kind === "piece" ? "CRIATIVOS" :
               currentItem.kind === "integration" ? "INTEGRAÇÕES" : ""}
            </div>
          </div>
        )}

        {/* DONE (brief flash before result) */}
        {scannerState === "done" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 text-primary/50 animate-spin" />
            <div className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Calculando resultado...</div>
          </div>
        )}

        {/* APPROVED */}
        {scannerState === "approved" && (
          <div className="flex flex-col items-center gap-8 text-center max-w-sm w-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full border border-green-400/30 flex items-center justify-center" style={{ animation: "pulseScale 0.5s ease-out" }}>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <div className="font-mono text-[28px] font-bold text-green-400 tracking-widest">APROVADO</div>
              <div className="font-mono text-[10px] text-white/30 uppercase tracking-[0.3em]">Campanha cleared for launch</div>
            </div>

            {/* Gate summary */}
            <div className="w-full space-y-2">
              {gates.map(g => (
                <div key={g.id} className="flex items-center gap-3 px-3 py-2 border border-white/5">
                  {g.passed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    : <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  }
                  <div className="flex-1 text-left">
                    <div className="font-mono text-[10px] text-white/60">{g.label}</div>
                    <div className="font-mono text-[9px] text-white/30">{g.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Confirm button */}
            {!showConfirm ? (
              <Button
                onClick={() => setShowConfirm(true)}
                className="w-full h-12 rounded-none font-mono text-[11px] uppercase tracking-[0.3em] bg-green-500 hover:bg-green-400 text-black font-bold"
              >
                <Rocket className="h-4 w-4 mr-2" />
                Confirmar Lançamento
              </Button>
            ) : (
              <div className="w-full space-y-3">
                <div className="font-mono text-[10px] text-white/40 text-center uppercase tracking-widest">
                  Esta ação inicia o lançamento. Confirme:
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 h-10 rounded-none font-mono text-[10px] uppercase border border-white/10 text-white/40"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={onConfirmLaunch}
                    disabled={launching}
                    className="flex-1 h-10 rounded-none font-mono text-[10px] uppercase bg-green-500 hover:bg-green-400 text-black font-bold"
                  >
                    {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "🚀 LANÇAR AGORA"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BLOCKED */}
        {scannerState === "blocked" && (
          <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full border border-red-400/30 flex items-center justify-center">
                <XCircle className="h-7 w-7 text-red-400" />
              </div>
              <div className="font-mono text-[26px] font-bold text-red-400 tracking-widest">BLOQUEADO</div>
              <div className="font-mono text-[10px] text-white/30 uppercase tracking-[0.2em]">
                Corrija os itens abaixo para lançar
              </div>
            </div>

            {/* Blockers */}
            <div className="w-full space-y-2">
              {blockers.map(g => (
                <div key={g.id} className="border border-red-400/20 bg-red-400/5">
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 text-left">
                      <div className="font-mono text-[10px] text-red-400/80 font-bold">{g.label}</div>
                      <div className="font-mono text-[9px] text-white/40 mt-0.5">{g.detail}</div>
                    </div>
                    {g.actionUrl && (
                      <Link href={g.actionUrl}>
                        <button
                          onClick={onClose}
                          className="font-mono text-[8px] text-red-400/60 border border-red-400/20 px-2 py-0.5 uppercase tracking-widest hover:bg-red-400/10 transition-colors whitespace-nowrap shrink-0"
                        >
                          {g.actionLabel}
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}

              {/* Warnings (non-blockers that also failed) */}
              {warnings.length > 0 && (
                <>
                  <div className="font-mono text-[8px] text-white/15 uppercase tracking-widest text-left pt-1 pb-0.5">Avisos (não bloqueiam)</div>
                  {warnings.map(g => (
                    <div key={g.id} className="border border-yellow-400/15 bg-yellow-400/3">
                      <div className="flex items-start gap-3 px-3 py-2">
                        <AlertTriangle className="h-3 w-3 text-yellow-400/60 shrink-0 mt-0.5" />
                        <div className="flex-1 text-left">
                          <div className="font-mono text-[9px] text-yellow-400/60">{g.label}</div>
                          <div className="font-mono text-[8px] text-white/30 mt-0.5">{g.detail}</div>
                        </div>
                        {g.actionUrl && (
                          <Link href={g.actionUrl}>
                            <button onClick={onClose} className="font-mono text-[7px] text-yellow-400/40 border border-yellow-400/15 px-1.5 py-0.5 uppercase tracking-widest hover:bg-yellow-400/5 transition-colors whitespace-nowrap shrink-0">
                              {g.actionLabel}
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Passing gates */}
              {gates.filter(g => g.passed).length > 0 && (
                <div className="space-y-1 pt-1">
                  {gates.filter(g => g.passed).map(g => (
                    <div key={g.id} className="flex items-center gap-2 px-3 py-1.5 border border-white/5">
                      <CheckCircle2 className="h-3 w-3 text-green-400/60 shrink-0" />
                      <span className="font-mono text-[9px] text-white/30">{g.label}</span>
                      <span className="font-mono text-[8px] text-green-400/40 ml-auto">✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full h-10 rounded-none font-mono text-[10px] uppercase tracking-widest border border-white/10 text-white/40 hover:text-white/70"
            >
              Fechar e Corrigir
            </Button>
          </div>
        )}
      </div>

      {/* ── Bottom status bar ── */}
      {scannerState === "scanning" && (
        <div className="relative z-20 border-t border-white/5 px-6 py-2 flex items-center justify-between">
          <div className="font-mono text-[8px] text-white/15 uppercase tracking-widest">
            {currentItem?.kind === "piece" ? `CRIATIVO ${currentItem.pieceIdx} DE ${currentItem.pieceTotal}` :
             currentItem?.kind === "integration" ? "INTEGRAÇÃO" :
             currentItem?.kind === "briefing" ? "BRIEFING" : ""}
          </div>
          <div className="font-mono text-[8px] text-white/10 uppercase tracking-widest">
            {Math.round(progress)}% VARRIDO
          </div>
        </div>
      )}

      {/* ── CSS animation keyframes ── */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseScale {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return createPortal(overlay, document.body);
}
