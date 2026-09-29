import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useListCampaigns, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search, Rocket, Workflow, Bot, LayoutDashboard,
  Video, Share2, DollarSign, Shield, Settings, CreditCard,
  ChevronRight, Cpu,
} from "lucide-react";
import { useUiText } from "@/lib/i18n";

interface SearchResult {
  id: string;
  type: "campaign" | "sequence" | "agent" | "page";
  label: string;
  sub?: string;
  href: string;
  icon: React.ElementType;
  color?: string;
}

const STATIC_PAGES = (t: ReturnType<typeof useUiText>): SearchResult[] => [
  { id: "dash", type: "page", label: "Dashboard", sub: t("Painel de controle", "Control panel", "Panel de control"), href: "/", icon: LayoutDashboard },
  { id: "campaigns", type: "page", label: t("Campanhas", "Campaigns", "Campañas"), sub: t("Todas as missões", "All campaigns", "Todas las campañas"), href: "/campaigns", icon: Rocket },
  { id: "sequences", type: "page", label: t("Sequências", "Sequences", "Secuencias"), sub: t("Automação e-mail + WhatsApp", "Email + WhatsApp automation", "Automatización de correo + WhatsApp"), href: "/sequences", icon: Workflow },
  { id: "agents", type: "page", label: t("Especialistas", "Specialists", "Especialistas"), sub: t("Time de especialistas", "Specialist team", "Equipo de especialistas"), href: "/agents", icon: Bot },
  { id: "vsls", type: "page", label: "VSL Studio", sub: t("Roteiros e vídeos", "Scripts and videos", "Guiones y videos"), href: "/vsls", icon: Video },
  { id: "social", type: "page", label: "Social Media", sub: t("Redes sociais", "Social networks", "Redes sociales"), href: "/social", icon: Share2 },
  { id: "revenue", type: "page", label: t("Receita", "Revenue", "Ingresos"), sub: t("Acompanhamento de receita", "Revenue tracking", "Seguimiento de ingresos"), href: "/revenue", icon: DollarSign },
  { id: "compliance", type: "page", label: "Compliance", sub: t("Verificação regulatória", "Regulatory checks", "Verificación normativa"), href: "/compliance", icon: Shield },
  { id: "credits", type: "page", label: t("Créditos do agente", "Agent credits", "Créditos de agentes"), sub: t("Saldo e histórico", "Balance and history", "Saldo e historial"), href: "/credits", icon: CreditCard },
  { id: "settings", type: "page", label: t("Configurações", "Settings", "Configuración"), sub: t("Perfil, workspace e segurança", "Profile, workspace, and security", "Perfil, espacio de trabajo y seguridad"), href: "/settings", icon: Settings },
];

const AGENTS = (t: ReturnType<typeof useUiText>): SearchResult[] => [
  { id: "command", type: "agent", label: t("Comandante", "Commander", "Comandante"), sub: `Claude · ${t("Estratégia", "Strategy", "Estrategia")}`, href: "/agents/command", icon: Cpu, color: "text-primary" },
  { id: "strategy", type: "agent", label: t("Estrategista", "Strategist", "Estratega"), sub: `Claude · ${t("Lançamento", "Launch", "Lanzamiento")}`, href: "/agents/strategy", icon: Cpu, color: "text-primary" },
  { id: "copywriter", type: "agent", label: "Copywriter", sub: "GPT-5.5 · Copy", href: "/agents/copywriter", icon: Cpu, color: "text-purple-400" },
  { id: "compliance", type: "agent", label: "Compliance Officer", sub: `Claude · ${t("Regulatório", "Regulatory", "Normativa")}`, href: "/agents/compliance", icon: Cpu, color: "text-yellow-400" },
  { id: "analytics", type: "agent", label: t("Analista", "Analyst", "Analista"), sub: `Gemini · ${t("Dados", "Data", "Datos")}`, href: "/agents/analytics", icon: Cpu, color: "text-success" },
  { id: "media_buyer", type: "agent", label: "Media Buyer", sub: `GPT-5.5 · ${t("Tráfego", "Traffic", "Tráfico")}`, href: "/agents/media_buyer", icon: Cpu, color: "text-purple-400" },
  { id: "creative_director", type: "agent", label: t("Diretor Criativo", "Creative Director", "Director creativo"), sub: "GPT-5.5 · Visual", href: "/agents/creative_director", icon: Cpu, color: "text-purple-400" },
  { id: "video", type: "agent", label: t("Estrategista de Vídeo", "Video Strategist", "Estratega de video"), sub: "Gemini · VSL", href: "/agents/video", icon: Cpu, color: "text-success" },
  { id: "offer", type: "agent", label: t("Especialista em Oferta", "Offer Specialist", "Especialista en ofertas"), sub: `Claude · ${t("Precificação", "Pricing", "Precios")}`, href: "/agents/offer", icon: Cpu, color: "text-primary" },
];

function ResultItem({
  result, active, onClick,
}: { result: SearchResult; active: boolean; onClick: () => void }) {
  const Icon = result.icon;
  const typeColors: Record<string, string> = {
    campaign: "text-primary", sequence: "text-cyan-400",
    agent: "text-purple-400", page: "text-muted-foreground",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all rounded-sm group ${
        active
          ? "bg-primary/10 border-l-2 border-primary"
          : "border-l-2 border-transparent hover:bg-muted/30 hover:border-primary/30"
      }`}
    >
      <div className={`shrink-0 ${result.color ?? typeColors[result.type]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-foreground truncate">{result.label}</div>
        {result.sub && (
          <div className="font-mono text-xs text-muted-foreground/60 uppercase tracking-wider truncate">{result.sub}</div>
        )}
      </div>
      <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-opacity ${active ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-40"}`} />
    </button>
  );
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useUiText();
  const staticPages = STATIC_PAGES(t);
  const agents = AGENTS(t);

  const { data: campaignsData } = useListCampaigns({
    query: { queryKey: getListCampaignsQueryKey(), enabled: open },
  });

  const { data: sequencesData } = useQuery({
    queryKey: ["/api/launch-sequences"],
    enabled: open,
    queryFn: async () => {
      return customFetch<{ sequences: { id: string; name: string; model: string; status: string }[] }>("/api/launch-sequences")
        .catch(() => ({ sequences: [] as { id: string; name: string; model: string; status: string }[] }));
    },
  });

  const campaignResults: SearchResult[] = (campaignsData?.campaigns ?? []).map(c => ({
    id: c.id,
    type: "campaign" as const,
    label: c.title,
    sub: `${t("Campanha", "Campaign", "Campaña")} · ${c.status}`,
    href: `/campaigns/${c.id}`,
    icon: Rocket,
  }));

  const sequenceResults: SearchResult[] = (sequencesData?.sequences ?? []).map(s => ({
    id: s.id,
    type: "sequence" as const,
    label: s.name,
    sub: `${t("Sequência", "Sequence", "Secuencia")} · ${s.status}`,
    href: `/sequences/${s.id}`,
    icon: Workflow,
  }));

  const q = query.toLowerCase().trim();
  const allResults: SearchResult[] = q
    ? [
        ...campaignResults.filter(r => r.label.toLowerCase().includes(q) || (r.sub ?? "").toLowerCase().includes(q)),
        ...sequenceResults.filter(r => r.label.toLowerCase().includes(q) || (r.sub ?? "").toLowerCase().includes(q)),
        ...agents.filter(r => r.label.toLowerCase().includes(q) || (r.sub ?? "").toLowerCase().includes(q)),
        ...staticPages.filter(r => r.label.toLowerCase().includes(q) || (r.sub ?? "").toLowerCase().includes(q)),
      ]
    : [
        ...staticPages.slice(0, 6),
        ...agents.slice(0, 4),
      ];

  useEffect(() => { setActiveIdx(0); }, [query]);
  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [open]);

  const navigate = (result: SearchResult) => {
    setLocation(result.href);
    onClose();
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allResults[activeIdx]) { navigate(allResults[activeIdx]); }
    if (e.key === "Escape") { onClose(); }
  };

  const sections = q ? null : [
    { label: t("Navegação", "Navigation", "Navegación"), items: allResults.slice(0, 6) },
    { label: t("Agentes Rápidos", "Quick Agents", "Agentes rápidos"), items: allResults.slice(6) },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 gap-0 max-w-lg border border-primary/30 bg-card/95 backdrop-blur-xl rounded-none overflow-hidden shadow-[0_0_60px_hsl(var(--primary)/0.2)]">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary pointer-events-none" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary pointer-events-none" />

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <Search className="h-4 w-4 text-primary shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("Buscar campanhas, agentes, páginas...", "Search campaigns, agents, pages...", "Buscar campañas, agentes y páginas...")}
            className="border-0 bg-transparent focus-visible:ring-0 font-mono text-sm placeholder:text-muted-foreground/40 p-0 h-auto"
          />
          <kbd className="font-mono text-[11px] px-1.5 py-0.5 border border-border/40 rounded text-muted-foreground shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {allResults.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">{t(`Nenhum resultado para "${query}"`, `No results for "${query}"`, `No hay resultados para "${query}"`)}</p>
            </div>
          ) : sections ? (
            sections.filter(s => s.items.length > 0).map((section) => (
              <div key={section.label}>
                <div className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
                  {section.label}
                </div>
                {section.items.map((result) => {
                  const idx = allResults.indexOf(result);
                  return (
                    <ResultItem key={result.id} result={result} active={idx === activeIdx} onClick={() => navigate(result)} />
                  );
                })}
              </div>
            ))
          ) : (
            allResults.map((result, idx) => (
              <ResultItem key={result.id} result={result} active={idx === activeIdx} onClick={() => navigate(result)} />
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border/30 flex items-center gap-3 bg-muted/5">
          {[
            ["↑↓", t("navegar", "navigate", "navegar")],
            ["↵", t("ir", "open", "abrir")],
            ["esc", t("fechar", "close", "cerrar")],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <kbd className="font-mono text-[11px] px-1.5 py-0.5 border border-border/40 rounded bg-background/50">{key}</kbd>
              <span className="font-mono text-[11px] text-muted-foreground/40">{label}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen, close: () => setOpen(false) };
}
