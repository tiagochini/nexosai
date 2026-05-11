import { useState } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, Link2, AlertTriangle,
  Wifi, WifiOff, ChevronRight, ExternalLink, Zap,
  MessageSquare, Mail, CreditCard, BarChart2, Instagram,
  Phone, Music2, Video, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Provider =
  | "whatsapp_business" | "telegram"
  | "rd_station" | "activecampaign" | "resend"
  | "hotmart" | "kiwify" | "stripe"
  | "meta_ads" | "google_ads" | "tiktok_ads"
  | "instagram" | "tiktok"
  | "hubspot";

interface WorkspaceIntegration {
  id: string;
  provider: Provider;
  status: "connected" | "disconnected" | "error";
  accountName?: string;
  isPaymentGateway: boolean;
  blocksExecution: boolean;
  createdAt: string;
}

interface CatalogEntry {
  provider: Provider;
  label: string;
  description: string;
  why: string;
  category: string;
  color: string;
  icon: React.ElementType;
  required: boolean;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

// ── Catalog ───────────────────────────────────────────────────────────────────
const CATALOG: CatalogEntry[] = [
  {
    provider: "whatsapp_business",
    label: "WhatsApp Business",
    description: "Disparo automatizado de mensagens e auto-resposta com IA",
    why: "Obrigatório para disparar sequências de mensagens durante o lançamento. Sem isso o NexOS não consegue executar uma campanha completa.",
    category: "Mensagens",
    color: "text-green-400",
    icon: MessageSquare,
    required: true,
    fields: [
      { key: "accountId", label: "Phone Number ID", placeholder: "123456789012345" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
      { key: "accessToken", label: "Access Token (Meta)", placeholder: "EAAxxxx...", type: "password" },
    ],
  },
  {
    provider: "telegram",
    label: "Telegram",
    description: "Bot de automação e notificações via canal do Telegram",
    why: "Alternativa ao WhatsApp para disparo automático de mensagens e notificações do lançamento.",
    category: "Mensagens",
    color: "text-sky-400",
    icon: MessageSquare,
    required: false,
    fields: [
      { key: "accountId", label: "Bot Token", placeholder: "1234567890:AAFxxxx..." },
      { key: "accountName", label: "Nome do Bot", placeholder: "@meubot" },
    ],
  },
  {
    provider: "rd_station",
    label: "RD Station",
    description: "E-mail marketing e automação de leads integrados ao lançamento",
    why: "Obrigatório para enviar a sequência de e-mails de lançamento. Conecete RD Station, ActiveCampaign ou Resend.",
    category: "E-mail",
    color: "text-blue-400",
    icon: Mail,
    required: true,
    fields: [
      { key: "accountId", label: "Client ID", placeholder: "seu-client-id" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Workspace RD" },
      { key: "accessToken", label: "API Token", placeholder: "rdst_xxxx...", type: "password" },
    ],
  },
  {
    provider: "activecampaign",
    label: "ActiveCampaign",
    description: "CRM e automação de e-mail com segmentação avançada",
    why: "Alternativa ao RD Station com CRM e automações comportamentais integradas.",
    category: "E-mail",
    color: "text-blue-400",
    icon: Mail,
    required: false,
    fields: [
      { key: "accountId", label: "Account Name", placeholder: "minhaempresa" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha AC" },
      { key: "accessToken", label: "API Key", placeholder: "xxxxxx...", type: "password" },
    ],
  },
  {
    provider: "resend",
    label: "Resend",
    description: "E-mail transacional de alta entregabilidade",
    why: "Opção mais simples para envio de e-mails. Basta a API Key do Resend.",
    category: "E-mail",
    color: "text-violet-400",
    icon: Mail,
    required: false,
    fields: [
      { key: "accountId", label: "Audience ID", placeholder: "78261eea-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Meu Workspace Resend" },
      { key: "accessToken", label: "API Key", placeholder: "re_xxxx...", type: "password" },
    ],
  },
  {
    provider: "instagram",
    label: "Instagram",
    description: "Auto-post de conteúdo orgânico sincronizado ao calendário",
    why: "Publica automaticamente posts, stories e reels gerados pela IA nos horários certos do lançamento.",
    category: "Social Orgânico",
    color: "text-pink-300",
    icon: Instagram,
    required: false,
    fields: [
      { key: "accountId", label: "Instagram Account ID", placeholder: "17841400000000000" },
      { key: "accountName", label: "Nome da Conta", placeholder: "@meucanal" },
      { key: "accessToken", label: "Access Token (Meta)", placeholder: "EAAxxxx...", type: "password" },
    ],
  },
  {
    provider: "tiktok",
    label: "TikTok",
    description: "Auto-post de vídeos e reels no TikTok sincronizados ao lançamento",
    why: "Publica vídeos gerados pela IA no TikTok automaticamente. Essencial para lançamentos que dependem de audiência jovem e vídeos curtos.",
    category: "Social Orgânico",
    color: "text-pink-400",
    icon: Music2,
    required: false,
    fields: [
      { key: "accountId", label: "TikTok Account ID", placeholder: "6912345678901234567" },
      { key: "accountName", label: "Nome da Conta", placeholder: "@meucanal" },
      { key: "accessToken", label: "Access Token", placeholder: "act.xxxx...", type: "password" },
    ],
  },
  {
    provider: "hotmart",
    label: "Hotmart",
    description: "Produtos digitais — compra converte contato automaticamente",
    why: "Quando alguém compra pelo Hotmart, o NexOS move o contato para 'convertido' em tempo real.",
    category: "Pagamentos",
    color: "text-orange-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accountId", label: "Client ID", placeholder: "hotmart-client-id" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Hotmart Workspace" },
    ],
  },
  {
    provider: "kiwify",
    label: "Kiwify",
    description: "Checkout e gestão de produtos com auto-conversão de leads",
    why: "Compras no Kiwify ativam automações de pós-venda no NexOS instantaneamente.",
    category: "Pagamentos",
    color: "text-orange-400",
    icon: CreditCard,
    required: false,
    fields: [
      { key: "accountId", label: "Account ID", placeholder: "kiwify-account-id" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Kiwify" },
      { key: "accessToken", label: "API Key", placeholder: "kwf_xxxx...", type: "password" },
    ],
  },
  {
    provider: "meta_ads",
    label: "Meta Ads",
    description: "Facebook e Instagram Ads — remarketing automático",
    why: "Remarketing automático para leads que não converteram. O agente Media Buyer otimiza os anúncios durante o lançamento.",
    category: "Mídia Paga",
    color: "text-cyan-400",
    icon: BarChart2,
    required: false,
    fields: [
      { key: "accountId", label: "Ad Account ID", placeholder: "act_123456789" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Conta Ads" },
      { key: "accessToken", label: "Access Token", placeholder: "EAAxxxx...", type: "password" },
    ],
  },
  {
    provider: "tiktok_ads",
    label: "TikTok Ads",
    description: "Anúncios pagos no TikTok sincronizados ao lançamento",
    why: "O agente Media Buyer gerencia campanhas pagas no TikTok, otimizando automaticamente durante o lançamento.",
    category: "Mídia Paga",
    color: "text-pink-400",
    icon: Music2,
    required: false,
    fields: [
      { key: "accountId", label: "Advertiser ID", placeholder: "6912345678901234567" },
      { key: "accountName", label: "Nome da Conta", placeholder: "TikTok Ads" },
      { key: "accessToken", label: "Access Token", placeholder: "act.xxxx...", type: "password" },
    ],
  },
  {
    provider: "google_ads",
    label: "Google Ads",
    description: "Campanhas de pesquisa e display no Google",
    why: "Captura de leads via pesquisa durante o lançamento, gerenciada pelo agente Media Buyer.",
    category: "Mídia Paga",
    color: "text-cyan-400",
    icon: BarChart2,
    required: false,
    fields: [
      { key: "accountId", label: "Customer ID", placeholder: "123-456-7890" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Google Ads" },
      { key: "accessToken", label: "Developer Token", placeholder: "xxxx...", type: "password" },
    ],
  },
  {
    provider: "hubspot",
    label: "HubSpot",
    description: "CRM e pipeline de vendas integrado com campanhas",
    why: "CRM completo integrado — leads das campanhas entram automaticamente no pipeline de vendas.",
    category: "CRM",
    color: "text-orange-300",
    icon: BarChart2,
    required: false,
    fields: [
      { key: "accountId", label: "Portal ID", placeholder: "12345678" },
      { key: "accountName", label: "Nome da Conta", placeholder: "HubSpot CRM" },
      { key: "accessToken", label: "Private App Token", placeholder: "pat-xxxx...", type: "password" },
    ],
  },
];

const CATEGORIES = ["Mensagens", "E-mail", "Social Orgânico", "Pagamentos", "Mídia Paga", "CRM"];

// ── Connect Modal ─────────────────────────────────────────────────────────────
function ConnectModal({
  entry,
  onClose,
  onConnect,
}: {
  entry: CatalogEntry;
  onClose: () => void;
  onConnect: (provider: Provider, fields: Record<string, string>) => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    setLoading(true);
    try { onConnect(entry.provider, fields); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="border border-border/70 bg-card w-full max-w-md shadow-2xl">
        <div className="border-b border-border/50 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-wide">Conectar {entry.label}</h3>
            <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{entry.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 bg-primary/5 border-b border-border/30">
          <div className="flex items-start gap-2">
            <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs font-mono text-muted-foreground/70">{entry.why}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {entry.fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{f.label}</label>
              <input
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                value={fields[f.key] ?? ""}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full bg-background border border-border/50 px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50 rounded-none"
              />
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 px-5 py-4 flex gap-3">
          <Button onClick={handleConnect} disabled={loading} className="flex-1 font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Conectar
          </Button>
          <Button variant="outline" onClick={onClose} className="font-mono uppercase tracking-widest rounded-none border-border/50 h-9 px-4">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IntegracoesPage() {
  const queryClient = useQueryClient();
  const [connectModal, setConnectModal] = useState<CatalogEntry | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/workspaces/me/integrations");
      if (!res.ok) return { integrations: [] as WorkspaceIntegration[] };
      return res.json() as Promise<{ integrations: WorkspaceIntegration[] }>;
    },
    staleTime: 30_000,
  });

  const integrations = data?.integrations ?? [];
  const connectedMap = new Map(integrations.filter(i => i.status === "connected").map(i => [i.provider, i]));

  const CRITICAL = ["whatsapp_business", "telegram", "rd_station", "activecampaign", "resend"];
  const hasMessaging = ["whatsapp_business", "telegram"].some(p => connectedMap.has(p as Provider));
  const hasEmail = ["rd_station", "activecampaign", "resend"].some(p => connectedMap.has(p as Provider));
  const isFullAuto = hasMessaging && hasEmail;
  const connectedCount = integrations.filter(i => i.status === "connected").length;

  const connectMutation = useMutation({
    mutationFn: async ({ provider, fields }: { provider: Provider; fields: Record<string, string> }) => {
      const res = await customFetch<Response>("/api/workspaces/me/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          accountId: fields["accountId"],
          accountName: fields["accountName"],
          accessToken: fields["accessToken"],
          metadata: fields,
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao conectar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Integração conectada com sucesso.");
      setConnectModal(null);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);
    try {
      const res = await customFetch<Response>(`/api/workspaces/me/integrations/${integrationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao desconectar");
      toast.success("Integração removida.");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    } catch {
      toast.error("Erro ao desconectar.");
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold uppercase tracking-tighter text-foreground">
          Integrações
        </h1>
        <p className="text-sm font-mono text-muted-foreground/60 mt-1">
          Conecte seus canais para ativar o modo Full Auto — disparos automáticos durante o lançamento.
        </p>
      </div>

      {/* Full Auto status bar */}
      <div className={`border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        isFullAuto ? "border-success/30 bg-success/5" : "border-yellow-400/25 bg-yellow-400/5"
      }`}>
        <div className="flex items-center gap-3">
          {isFullAuto
            ? <Wifi className="h-5 w-5 text-success shrink-0" />
            : <WifiOff className="h-5 w-5 text-yellow-400 shrink-0" />}
          <div>
            <div className={`font-mono font-bold uppercase tracking-widest text-sm ${isFullAuto ? "text-success" : "text-yellow-400"}`}>
              {isFullAuto ? "Full Auto — Pronto para lançar" : "Modo Parcial — Configure para lançar"}
            </div>
            <div className="text-xs font-mono text-muted-foreground/60 mt-0.5">
              {isFullAuto
                ? `${connectedCount} integrações ativas. Todos os disparos automáticos ativados.`
                : `Conecte ${!hasMessaging ? "um canal de Mensagens" : ""}${!hasMessaging && !hasEmail ? " e " : ""}${!hasEmail ? "um canal de E-mail" : ""} para lançar campanhas.`}
            </div>
          </div>
        </div>
        {!isFullAuto && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {!hasMessaging && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 bg-yellow-400/10 rounded-none px-2 py-1 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />Mensagens — obrigatório para lançar
              </Badge>
            )}
            {!hasEmail && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 bg-yellow-400/10 rounded-none px-2 py-1 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />E-mail — obrigatório para lançar
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Integration catalog grouped by category */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map(cat => {
            const items = CATALOG.filter(c => c.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40">{cat}</span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
                <div className="space-y-2">
                  {items.map(entry => {
                    const isConn = connectedMap.has(entry.provider);
                    const integration = connectedMap.get(entry.provider);
                    const Icon = entry.icon;
                    return (
                      <div
                        key={entry.provider}
                        className={`border flex flex-col sm:flex-row sm:items-center gap-4 p-4 transition-all ${
                          isConn
                            ? "border-success/30 bg-success/5"
                            : entry.required
                            ? "border-yellow-400/25 bg-yellow-400/5"
                            : "border-border/50 bg-card/30"
                        }`}
                      >
                        {/* Icon + name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`h-8 w-8 border flex items-center justify-center shrink-0 ${isConn ? "border-success/30 bg-success/10" : "border-border/40 bg-muted/20"}`}>
                            <Icon className={`h-4 w-4 ${isConn ? "text-success" : entry.color}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-sm">{entry.label}</span>
                              {entry.required && !isConn && (
                                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 rounded-none px-1.5 py-0">obrigatório</Badge>
                              )}
                              {isConn && (
                                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-success/40 text-success rounded-none px-1.5 py-0 gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" />conectado
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{entry.description}</p>
                            {isConn && integration?.accountName && (
                              <p className="text-[10px] font-mono text-success/70 mt-0.5">{integration.accountName}</p>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0 flex items-center gap-2">
                          {isConn ? (
                            <button
                              onClick={() => integration && handleDisconnect(integration.id)}
                              disabled={disconnecting === integration?.id}
                              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-destructive transition-colors flex items-center gap-1"
                            >
                              {disconnecting === integration?.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <XCircle className="h-3 w-3" />}
                              Desconectar
                            </button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setConnectModal(entry)}
                              className={`font-mono uppercase tracking-widest rounded-none gap-1.5 h-8 px-3 text-[11px] ${
                                entry.required
                                  ? "btn-weapon-primary"
                                  : "bg-muted/40 hover:bg-muted/60 text-foreground border border-border/50"
                              }`}
                            >
                              <Link2 className="h-3 w-3" />
                              Conectar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect modal */}
      {connectModal && (
        <ConnectModal
          entry={connectModal}
          onClose={() => setConnectModal(null)}
          onConnect={(provider, fields) => connectMutation.mutate({ provider, fields })}
        />
      )}
    </div>
  );
}
