import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, DollarSign, Users, AlertTriangle, TrendingUp, Zap, Calendar,
  Brain, ShieldCheck, CheckCircle2, Clock, BarChart3, MessageSquare,
  Sparkles, ArrowRight, Info, ChevronRight,
} from "lucide-react";
import { useUiText } from "@/lib/i18n";

// ── Credit pricing ─────────────────────────────────────────────────────────────
const CREDIT_PRICE_BRL = 0.15;

function creditsToReal(credits: number): string {
  return (credits * CREDIT_PRICE_BRL).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function safeParseJSON(val: unknown): Record<string, unknown> | unknown[] | null {
  if (!val) return null;
  if (typeof val === "object") return val as Record<string, unknown>;
  if (typeof val === "string") {
    try {
      const clean = val.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }
  return null;
}

function safeStr(val: unknown, fallback = ""): string {
  if (!val) return fallback;
  if (typeof val === "string") return val;
  return fallback;
}

function safeArr(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
  return [];
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, badge, color = "primary", children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  color?: "primary" | "cyan" | "yellow" | "green" | "red";
  children: React.ReactNode;
}) {
  const colors = {
    primary: "text-primary border-primary/20",
    cyan: "text-cyan-400 border-cyan-400/20",
    yellow: "text-yellow-400 border-yellow-400/20",
    green: "text-green-400 border-green-400/20",
    red: "text-red-400 border-red-400/20",
  };
  return (
    <div className={`border ${colors[color]} bg-card/30 p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${colors[color].split(" ")[0]}`} />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</span>
        </div>
        {badge && (
          <Badge variant="outline" className={`font-mono text-[10px] px-2 rounded-none ${colors[color]}`}>
            {badge}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function TextBlock({ text }: { text: string }) {
  const t = useUiText();
  if (!text) return <p className="text-xs font-mono text-muted-foreground italic">{t("Não disponível", "Not available", "No disponible")}</p>;
  return <p className="text-sm font-mono text-foreground/90 leading-relaxed">{text}</p>;
}

function BulletList({ items, icon: Icon, color = "primary" }: {
  items: string[];
  icon?: React.ElementType;
  color?: string;
}) {
  const t = useUiText();
  if (!items.length) return <p className="text-xs font-mono text-muted-foreground italic">{t("Nenhum item", "No items", "No hay elementos")}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          {Icon ? (
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
          )}
          <span className="text-xs font-mono text-foreground/80 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Credit investment block ────────────────────────────────────────────────────
function InvestmentBlock({
  campaignType, creditEstimate,
}: {
  campaignType: string;
  creditEstimate: { min: number; typical: number; max: number; label: string } | null;
}) {
  const t = useUiText();
  const est = creditEstimate ?? { min: 290, typical: 420, max: 630, label: campaignType };

  const breakdown = [
    { phase: t("Estratégia", "Strategy", "Estrategia"), description: "Command + Profile + Strategy + Offer + Manager + Finance", credits: 45 },
    { phase: t("Conteúdo", "Content", "Contenido"), description: t("16 especialistas (copy, landing pages, anúncios, compliance e roteiros)", "16 specialists (copy, landing pages, ads, compliance, and scripts)", "16 especialistas (copy, páginas de aterrizaje, anuncios, cumplimiento y guiones)"), credits: 150 },
    { phase: t("Sequência", "Sequence", "Secuencia"), description: t("Builder + 15 itens personalizados por segmento", "Builder + 15 items tailored to each segment", "Builder + 15 elementos personalizados por segmento"), credits: 37 },
    { phase: t("Monitoramento", "Monitoring", "Monitoreo"), description: t("Respostas automáticas no WhatsApp + ciclos de otimização", "WhatsApp auto-replies + optimization cycles", "Respuestas automáticas en WhatsApp + ciclos de optimización"), credits: est.typical - 232 },
  ];

  return (
    <div className="space-y-4">
      {/* Cost summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("Mínimo", "Minimum", "Mínimo"), credits: est.min, sub: t("sem tráfego pago", "without paid traffic", "sin tráfico pagado") },
          { label: t("Típico", "Typical", "Típico"), credits: est.typical, sub: t("lançamento padrão", "standard launch", "lanzamiento estándar"), highlight: true },
          { label: t("Máximo", "Maximum", "Máximo"), credits: est.max, sub: t("com tráfego intenso", "with heavy traffic", "con tráfico intenso") },
        ].map(({ label, credits, sub, highlight }) => (
          <div key={label} className={`border p-3 text-center ${highlight ? "border-primary/40 bg-primary/5" : "border-border/40 bg-card/40"}`}>
            <div className={`font-mono text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
              {credits} cr
            </div>
            <div className={`font-mono text-sm ${highlight ? "text-primary/70" : "text-muted-foreground"}`}>
              {creditsToReal(credits)}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
            <div className="font-mono text-[9px] text-muted-foreground/60">{sub}</div>
          </div>
        ))}
      </div>

      {/* Phase breakdown */}
      <div className="border border-border/40 bg-card/20">
        <div className="px-4 py-2 border-b border-border/40 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
           {t("Detalhamento por fase", "Breakdown by phase", "Detalle por fase")}
        </div>
        <div className="divide-y divide-border/20">
          {breakdown.map(({ phase, description, credits }) => (
            <div key={phase} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="font-mono text-xs text-foreground">{phase}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{description}</div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="font-mono text-sm font-bold text-primary">{credits} cr</div>
                <div className="font-mono text-[10px] text-muted-foreground">{creditsToReal(credits)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-primary/30 bg-primary/5">
          <div className="font-mono text-xs uppercase tracking-widest text-primary">{t("Total típico", "Typical total", "Total típico")}</div>
          <div className="text-right">
            <span className="font-mono text-lg font-bold text-primary">{est.typical} créditos</span>
            <span className="font-mono text-sm text-primary/70 ml-2">≈ {creditsToReal(est.typical)}</span>
          </div>
        </div>
      </div>

      {/* Pricing note */}
      <div className="flex items-start gap-2 p-3 border border-border/30 bg-muted/10">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
          {t("Os créditos são consumidos conforme os agentes executam. Valor avulso: R$0,15 por crédito. Os planos mensais incluem créditos com aproximadamente 33% de desconto. Créditos não utilizados acumulam para o próximo ciclo.", "Credits are consumed as agents run. Pay-as-you-go rate: R$0.15 per credit. Monthly plans include credits at about 33% off. Unused credits roll over to the next cycle.", "Los créditos se consumen a medida que trabajan los agentes. Tarifa individual: R$0,15 por crédito. Los planes mensuales incluyen créditos con aproximadamente un 33% de descuento. Los créditos no utilizados se acumulan para el siguiente ciclo.")}
        </p>
      </div>
    </div>
  );
}

// ── Mental triggers display ────────────────────────────────────────────────────
const TRIGGER_LABELS: Record<string, { label: [string, string, string]; color: string }> = {
  authority: { label: ["Autoridade", "Authority", "Autoridad"], color: "border-blue-400/40 text-blue-400" },
  social_proof: { label: ["Prova social", "Social proof", "Prueba social"], color: "border-green-400/40 text-green-400" },
  reciprocity: { label: ["Reciprocidade", "Reciprocity", "Reciprocidad"], color: "border-cyan-400/40 text-cyan-400" },
  community: { label: ["Comunidade", "Community", "Comunidad"], color: "border-purple-400/40 text-purple-400" },
  scarcity: { label: ["Escassez", "Scarcity", "Escasez"], color: "border-red-400/40 text-red-400" },
  urgency: { label: ["Urgência", "Urgency", "Urgencia"], color: "border-orange-400/40 text-orange-400" },
  anticipation: { label: ["Antecipação", "Anticipation", "Anticipación"], color: "border-yellow-400/40 text-yellow-400" },
  event: { label: ["Evento", "Event", "Evento"], color: "border-pink-400/40 text-pink-400" },
  transformation: { label: ["Transformação", "Transformation", "Transformación"], color: "border-emerald-400/40 text-emerald-400" },
  fear_of_loss: { label: ["Medo de perder", "Fear of loss", "Miedo a perder"], color: "border-red-400/40 text-red-400" },
  curiosity: { label: ["Curiosidade", "Curiosity", "Curiosidad"], color: "border-violet-400/40 text-violet-400" },
  contrast: { label: ["Contraste", "Contrast", "Contraste"], color: "border-amber-400/40 text-amber-400" },
};

// ── Main component ────────────────────────────────────────────────────────────
export interface CampaignBriefProps {
  campaign: {
    id: string;
    title: string;
    type?: string | null;
    track?: string | null;
    status: string;
    revenueTarget?: string | null;
    strategyData?: unknown;
    offerData?: unknown;
    audienceData?: unknown;
    targetingData?: unknown;
    timelineData?: unknown;
  };
  creditEstimate?: { min: number; typical: number; max: number; label: string } | null;
  onApprove?: () => void;
  approveLoading?: boolean;
  showApproveButton?: boolean;
}

export function CampaignBrief({
  campaign, creditEstimate, onApprove, approveLoading, showApproveButton,
}: CampaignBriefProps) {
  const t = useUiText();
  const strategyD = useMemo(() => (safeParseJSON(campaign.strategyData) ?? {}) as Record<string, unknown>, [campaign.strategyData]);
  const offerD = useMemo(() => (safeParseJSON(campaign.offerData) ?? {}) as Record<string, unknown>, [campaign.offerData]);
  const audienceD = useMemo(() => (safeParseJSON(campaign.audienceData) ?? {}) as Record<string, unknown>, [campaign.audienceData]);
  const targetingD = useMemo(() => (safeParseJSON(campaign.targetingData) ?? {}) as Record<string, unknown>, [campaign.targetingData]);

  // timelineData may have launchNarrative as a JSON string
  const timelineRaw = useMemo(() => (safeParseJSON(campaign.timelineData) ?? {}) as Record<string, unknown>, [campaign.timelineData]);
  const timelineD = useMemo(() => {
    const parsed = safeParseJSON(timelineRaw["launchNarrative"]) as Record<string, unknown> | null;
    return parsed ?? timelineRaw;
  }, [timelineRaw]);

  // Financial projection: projectorNotes is often a JSON string
  const financialD = useMemo(() => {
    const fp = (offerD["financialProjection"] ?? {}) as Record<string, unknown>;
    const notes = safeParseJSON(fp["projectorNotes"]) as Record<string, unknown> | null;
    return notes ?? fp;
  }, [offerD]);

  // Extract key data
  const executiveSummary = safeStr(strategyD["executiveSummary"]);
  const marketDiagnosis = (strategyD["marketDiagnosis"] ?? {}) as Record<string, unknown>;
  const offerPositioning = (strategyD["offerPositioning"] ?? {}) as Record<string, unknown>;
  const campaignArchitecture = (strategyD["campaignArchitecture"] ?? {}) as Record<string, unknown>;
  const audienceSegmentation = (strategyD["audienceSegmentation"] ?? {}) as Record<string, unknown>;
  const risks = (strategyD["risks"] ?? {}) as Record<string, unknown>;
  const successMetrics = (strategyD["successMetrics"] ?? {}) as Record<string, unknown>;

  const primaryAvatar = (audienceD["primaryAvatar"] ?? {}) as Record<string, unknown>;
  const segments = safeArr(audienceD["segments"] as unknown);
  const criticalInsights = safeArr(audienceD["criticalInsights"] as unknown);

  const positioning = (targetingD["positioning"] ?? {}) as Record<string, unknown>;
  const marketIntelligence = (targetingD["marketIntelligence"] ?? {}) as Record<string, unknown>;

  const phases = (timelineD["phases"] ?? timelineRaw["phases"] ?? []) as unknown[];
  const totalDays = (timelineD["totalDays"] ?? timelineRaw["totalDays"] ?? 0) as number;
  const conversionDays = (timelineD["conversionWindowDays"] ?? timelineRaw["conversionWindowDays"] ?? 7) as number;
  const launchTitle = safeStr(timelineD["launchTitle"] ?? timelineRaw["launchTitle"] as unknown);
  const launchNarrative = safeStr(timelineD["launchNarrative"] ?? timelineRaw["launchNarrative"] as unknown);
  const scarcityMechanism = safeStr(timelineD["scarcityMechanism"] ?? timelineRaw["scarcityMechanism"] as unknown);

  const keyMessages = safeArr(campaignArchitecture["keyMessages"] as unknown);
  const coreNarrative = safeStr(campaignArchitecture["coreNarrative"] as unknown);
  const mentalTriggers = safeArr(campaignArchitecture["mentalTriggers"] as unknown);

  const objections = safeArr(audienceSegmentation["objections"] as unknown);
  const mainRisks = safeArr(risks["mainRisks"] as unknown);
  const riskLevel = safeStr(risks["level"] as unknown);
  const threats = safeArr(marketDiagnosis["threats"] as unknown);
  const entryBarriers = safeArr(marketDiagnosis["entryBarriers"] as unknown);

  const revenueTarget = successMetrics["revenueTarget"]
    ? Number(successMetrics["revenueTarget"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })
    : campaign.revenueTarget
      ? Number(campaign.revenueTarget).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })
      : null;

  const criticalAssumptions = safeArr(successMetrics["criticalAssumptions"] as unknown);
  const riskAlerts = safeArr((financialD["riskAlerts"] ?? []) as unknown);
  const campaignSummary = (financialD["campaignSummary"] ?? {}) as Record<string, unknown>;
  const scenarios = ((financialD["scenarios"] ?? []) as unknown[]).slice(0, 3) as Record<string, unknown>[];
  const keyMetrics = (financialD["keyMetrics"] ?? {}) as Record<string, unknown>;

  const hasStrategy = Object.keys(strategyD).length > 0;

  if (!hasStrategy) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Brain className="h-10 w-10 text-muted-foreground/30" />
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest text-center">
          {t("Estratégia ainda não foi gerada.", "Strategy has not been generated yet.", "Aún no se generó la estrategia.")}<br />
          {t("Execute a fase de análise para gerar a proposta completa.", "Run the analysis phase to generate the full proposal.", "Ejecuta la fase de análisis para generar la propuesta completa.")}
        </p>
        {showApproveButton && onApprove && (
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Button
              className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs"
              onClick={onApprove}
              disabled={approveLoading}
            >
              {approveLoading
                ? <><ArrowRight className="h-3 w-3 animate-spin" />{t("Gerando...", "Generating...", "Generando...")}</>
                : <><Zap className="h-3 w-3" />{t("Gerar conteúdo agora", "Generate content now", "Generar contenido ahora")}</>}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Doc header ── */}
      <div className="border border-primary/30 bg-primary/5 p-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary/70 mb-1">
          {t("Proposta de campanha · NexOS · Confidencial", "Campaign proposal · NexOS · Confidential", "Propuesta de campaña · NexOS · Confidencial")}
        </div>
        <h2 className="font-mono text-lg font-bold text-foreground uppercase tracking-tight">
          {launchTitle || campaign.title}
        </h2>
        <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>{t("Tipo:", "Type:", "Tipo:")} <span className="text-foreground">{campaign.type}</span></span>
          <span>{t("Trilha:", "Track:", "Nivel:")} <span className="text-foreground">{campaign.track}</span></span>
          {totalDays > 0 && <span>{t("Duração:", "Duration:", "Duración:")} <span className="text-foreground">{totalDays} {t("dias", "days", "días")}</span></span>}
          {conversionDays > 0 && <span>{t("Carrinho aberto:", "Cart open:", "Carrito abierto:")} <span className="text-foreground">{conversionDays} {t("dias", "days", "días")}</span></span>}
          {revenueTarget && <span>{t("Meta:", "Target:", "Meta:")} <span className="text-green-400 font-bold">{revenueTarget}</span></span>}
        </div>
      </div>

      {/* ── 1. Executive Summary ── */}
      {executiveSummary && (
        <Section icon={Sparkles} title={t("Resumo executivo", "Executive summary", "Resumen ejecutivo")} color="primary">
          <TextBlock text={executiveSummary} />
        </Section>
      )}

      {/* ── 2. Investment ── */}
      <Section icon={DollarSign} title={t("Investimento", "Investment", "Inversión")} badge="Créditos + BRL" color="cyan">
        <InvestmentBlock campaignType={campaign.type ?? "launch"} creditEstimate={creditEstimate ?? null} />
      </Section>

      {/* ── 3. Core Narrative & Key Messages ── */}
      {(coreNarrative || keyMessages.length > 0) && (
        <Section icon={MessageSquare} title={t("Narrativa central da campanha", "Campaign core narrative", "Narrativa central de la campaña")} color="primary">
          {coreNarrative && <TextBlock text={coreNarrative} />}
          {keyMessages.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                 {t("Mensagens-chave para os agentes de conteúdo", "Key messages for content agents", "Mensajes clave para los agentes de contenido")}
              </div>
              <BulletList items={keyMessages} icon={ChevronRight} />
            </div>
          )}
        </Section>
      )}

      {/* ── 4. Offer Positioning ── */}
      {(safeStr(offerPositioning["positioning"] as unknown) || safeStr(offerPositioning["priceJustification"] as unknown)) && (
        <Section icon={Target} title={t("Posicionamento da oferta", "Offer positioning", "Posicionamiento de la oferta")} color="cyan">
          <div className="space-y-4">
            {safeStr(offerPositioning["positioning"] as unknown) && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("Posicionamento", "Positioning", "Posicionamiento")}</div>
                <TextBlock text={safeStr(offerPositioning["positioning"] as unknown)} />
              </div>
            )}
            {safeStr(offerPositioning["priceJustification"] as unknown) && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("Justificativa de preço", "Price justification", "Justificación del precio")}</div>
                <TextBlock text={safeStr(offerPositioning["priceJustification"] as unknown)} />
              </div>
            )}
            {safeStr(offerPositioning["mainDifferential"] as unknown) && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("Diferencial principal", "Key differentiator", "Diferencial principal")}</div>
                <TextBlock text={safeStr(offerPositioning["mainDifferential"] as unknown)} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 5. Audience ── */}
      <Section icon={Users} title={t("Público-alvo", "Target audience", "Público objetivo")} color="primary">
        <div className="space-y-4">
          {safeStr(primaryAvatar["name"] as unknown) && (
            <div className="border border-border/40 p-3 bg-card/40">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{t("Avatar primário", "Primary avatar", "Avatar principal")}</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {safeStr(primaryAvatar["name"] as unknown) && <div><span className="text-muted-foreground">{t("Nome:", "Name:", "Nombre:")} </span>{safeStr(primaryAvatar["name"] as unknown)}</div>}
                {safeStr(primaryAvatar["age"] as unknown) && <div><span className="text-muted-foreground">{t("Idade:", "Age:", "Edad:")} </span>{safeStr(primaryAvatar["age"] as unknown)}</div>}
                {safeStr(primaryAvatar["occupation"] as unknown) && <div><span className="text-muted-foreground">{t("Profissão:", "Occupation:", "Profesión:")} </span>{safeStr(primaryAvatar["occupation"] as unknown)}</div>}
                {safeStr(primaryAvatar["awarenessLevel"] as unknown) && <div><span className="text-muted-foreground">{t("Consciência:", "Awareness:", "Nivel de consciencia:")} </span>{safeStr(primaryAvatar["awarenessLevel"] as unknown)}</div>}
              </div>
              {safeStr(primaryAvatar["deepestDesire"] as unknown) && (
                <div className="mt-2 text-xs font-mono">
                  <span className="text-muted-foreground">{t("Desejo profundo:", "Deepest desire:", "Deseo más profundo:")} </span>
                  <span className="text-foreground">{safeStr(primaryAvatar["deepestDesire"] as unknown)}</span>
                </div>
              )}
              {safeArr(primaryAvatar["dailyPains"] as unknown).length > 0 && (
                <div className="mt-3">
                   <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("Dores identificadas", "Identified pain points", "Puntos de dolor identificados")}</div>
                  <BulletList items={safeArr(primaryAvatar["dailyPains"] as unknown)} icon={AlertTriangle} color="text-yellow-400" />
                </div>
              )}
              {safeArr(primaryAvatar["typicalObjections"] as unknown).length > 0 && (
                <div className="mt-3">
                   <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("Objeções típicas", "Common objections", "Objeciones habituales")}</div>
                  <BulletList items={safeArr(primaryAvatar["typicalObjections"] as unknown)} icon={MessageSquare} color="text-cyan-400" />
                </div>
              )}
              {safeArr(primaryAvatar["buyingTriggers"] as unknown).length > 0 && (
                <div className="mt-3">
                   <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("O que os faz comprar", "What makes them buy", "Qué les hace comprar")}</div>
                  <BulletList items={safeArr(primaryAvatar["buyingTriggers"] as unknown)} icon={CheckCircle2} color="text-green-400" />
                </div>
              )}
            </div>
          )}

          {/* Segmentation strategy */}
          {objections.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                 {t("Objeções reais vs. disfarçadas (estratégia de segmentação)", "Real vs. disguised objections (segmentation strategy)", "Objeciones reales vs. encubiertas (estrategia de segmentación)")}
              </div>
              <BulletList items={objections} icon={Brain} color="text-violet-400" />
            </div>
          )}

          {/* Critical insights */}
          {criticalInsights.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                 {t("Insights críticos do perfil", "Critical profile insights", "Hallazgos clave del perfil")}
              </div>
              <BulletList items={criticalInsights} icon={Sparkles} color="text-yellow-400" />
            </div>
          )}

          {/* Segments */}
          {segments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <div className="w-full font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("Segmentos detectados", "Segments identified", "Segmentos detectados")}</div>
              {segments.map((seg, i) => (
                <Badge key={i} variant="outline" className="font-mono text-[10px] rounded-none border-border/40">
                  {seg}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── 6. Market Diagnosis ── */}
      {(threats.length > 0 || entryBarriers.length > 0) && (
        <Section icon={BarChart3} title={t("Diagnóstico de mercado", "Market assessment", "Diagnóstico de mercado")} color="primary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entryBarriers.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                   {t("Barreiras de entrada / objeções de mercado", "Barriers to entry / market objections", "Barreras de entrada / objeciones del mercado")}
                </div>
                <BulletList items={entryBarriers} icon={AlertTriangle} color="text-yellow-400" />
              </div>
            )}
            {threats.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                   {t("Ameaças identificadas", "Identified threats", "Amenazas identificadas")}
                </div>
                <BulletList items={threats} icon={AlertTriangle} color="text-red-400" />
              </div>
            )}
            {safeStr(marketIntelligence["campaignApproach"] as unknown) && (
              <div className="md:col-span-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                   {t("Abordagem de campanha recomendada", "Recommended campaign approach", "Enfoque de campaña recomendado")}
                </div>
                <TextBlock text={safeStr(marketIntelligence["campaignApproach"] as unknown)} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 7. Mental Triggers ── */}
      {mentalTriggers.length > 0 && (
        <Section icon={Brain} title={t("Gatilhos mentais selecionados", "Selected psychological triggers", "Disparadores psicológicos seleccionados")} badge={t(`${mentalTriggers.length} gatilhos`, `${mentalTriggers.length} triggers`, `${mentalTriggers.length} disparadores`)} color="cyan">
          <div className="flex flex-wrap gap-2 mb-3">
            {mentalTriggers.map((trigger, i) => {
              const triggerMeta = TRIGGER_LABELS[trigger] ?? { label: [trigger, trigger, trigger] as [string, string, string], color: "border-primary/40 text-primary" };
              return (
                <Badge key={i} variant="outline" className={`font-mono text-[11px] px-3 py-1 rounded-none ${triggerMeta.color}`}>
                  {t(...triggerMeta.label)}
                </Badge>
              );
            })}
          </div>
          {scarcityMechanism && (
            <div className="mt-3 p-3 border border-orange-400/20 bg-orange-400/5">
               <div className="font-mono text-[10px] uppercase tracking-widest text-orange-400/70 mb-1">{t("Mecanismo de escassez", "Scarcity mechanism", "Mecanismo de escasez")}</div>
              <TextBlock text={scarcityMechanism} />
            </div>
          )}
        </Section>
      )}

      {/* ── 8. Launch Timeline ── */}
      <Section icon={Calendar} title={t("Cronograma do lançamento", "Launch timeline", "Cronograma del lanzamiento")} color="primary">
        <div className="space-y-3">
          {totalDays > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="border border-border/40 p-3 text-center">
                <div className="font-mono text-xl font-bold text-primary">{totalDays}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Dias no total", "Total days", "Días en total")}</div>
              </div>
              <div className="border border-border/40 p-3 text-center">
                <div className="font-mono text-xl font-bold text-cyan-400">{totalDays - conversionDays}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Aquecimento", "Warm-up", "Calentamiento")}</div>
              </div>
              <div className="border border-border/40 p-3 text-center">
                <div className="font-mono text-xl font-bold text-green-400">{conversionDays}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Carrinho aberto", "Cart open", "Carrito abierto")}</div>
              </div>
            </div>
          )}

          {phases.length > 0 ? (
            <div className="space-y-2">
              {(phases as Record<string, unknown>[]).map((phase, i) => (
                <div key={i} className="flex items-start gap-3 border border-border/30 p-3 bg-card/20">
                  <div className="font-mono text-[10px] text-primary/70 shrink-0 w-8 text-center mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {safeStr(phase["name"] as unknown)}
                      </span>
                      {safeStr(phase["duration"] as unknown) && (
                        <Badge variant="outline" className="font-mono text-[9px] px-1.5 rounded-none border-border/40">
                          {safeStr(phase["duration"] as unknown)}
                        </Badge>
                      )}
                    </div>
                    {safeStr(phase["objective"] as unknown) && (
                      <p className="font-mono text-[11px] text-foreground/70">{safeStr(phase["objective"] as unknown)}</p>
                    )}
                    {safeStr(phase["keyActivity"] as unknown) && (
                      <p className="font-mono text-[10px] text-muted-foreground mt-1">{safeStr(phase["keyActivity"] as unknown)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {launchNarrative && <TextBlock text={launchNarrative.slice(0, 600) + (launchNarrative.length > 600 ? "…" : "")} />}
              {!launchNarrative && totalDays > 0 && (
                <div className="space-y-2">
                  <div className="border-l-2 border-cyan-400/50 pl-3 py-1">
                    <div className="font-mono text-xs font-bold text-foreground">{t("Fase 1 — Aquecimento", "Phase 1 — Warm-up", "Fase 1 — Calentamiento")}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{totalDays - conversionDays} {t("dias", "days", "días")} · {t("Construção de audiência e geração de leads qualificados", "Audience building and qualified lead generation", "Creación de audiencia y generación de contactos cualificados")}</div>
                  </div>
                  <div className="border-l-2 border-yellow-400/50 pl-3 py-1">
                    <div className="font-mono text-xs font-bold text-foreground">{t("Fase 2 — Abertura do carrinho", "Phase 2 — Cart open", "Fase 2 — Apertura del carrito")}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{conversionDays} {t("dias", "days", "días")} · {t("Conversão com sequência de nutrição e urgência progressiva", "Conversion with a nurturing sequence and increasing urgency", "Conversión con una secuencia de nutrición y urgencia progresiva")}</div>
                  </div>
                  <div className="border-l-2 border-orange-400/50 pl-3 py-1">
                    <div className="font-mono text-xs font-bold text-foreground">{t("Fase 3 — Fechamento", "Phase 3 — Close", "Fase 3 — Cierre")}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{t("Último dia · Sequência de escassez, última chamada e encerramento", "Final day · scarcity sequence, last call, and close", "Último día · secuencia de escasez, última llamada y cierre")}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {safeStr(timelineD["launchManagerNotes"] as unknown ?? timelineRaw["launchManagerNotes"] as unknown) && (
            <div className="p-3 border border-border/30 bg-muted/10 mt-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("Notas do gerente de lançamento", "Launch manager notes", "Notas del responsable del lanzamiento")}</div>
              <TextBlock text={safeStr(timelineD["launchManagerNotes"] as unknown ?? timelineRaw["launchManagerNotes"] as unknown)} />
            </div>
          )}
        </div>
      </Section>

      {/* ── 9. Financial Projection ── */}
      {(scenarios.length > 0 || Object.keys(keyMetrics).length > 0 || Object.keys(campaignSummary).length > 0) && (
        <Section icon={TrendingUp} title={t("Projeção financeira", "Financial projection", "Proyección financiera")} color="green">
          <div className="space-y-4">
            {Boolean(campaignSummary["totalBudget"] || campaignSummary["expectedRevenue"]) && (
              <div className="grid grid-cols-2 gap-3">
                {Boolean(campaignSummary["totalBudget"]) && (
                  <div className="border border-border/40 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Orçamento total", "Total budget", "Presupuesto total")}</div>
                    <div className="font-mono text-lg font-bold text-foreground">
                      {Number(campaignSummary["totalBudget"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
                {Boolean(campaignSummary["expectedRevenue"]) && (
                  <div className="border border-green-400/20 p-3 bg-green-400/5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-green-400/70">{t("Receita esperada", "Expected revenue", "Ingresos previstos")}</div>
                    <div className="font-mono text-lg font-bold text-green-400">
                      {Number(campaignSummary["expectedRevenue"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {scenarios.length > 0 && (
              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{t("Cenários de projeção", "Projection scenarios", "Escenarios de proyección")}</div>
                {scenarios.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between border border-border/30 px-4 py-2.5 bg-card/20">
                    <span className="font-mono text-xs text-foreground">{safeStr(sc["name"] as unknown) || `${t("Cenário", "Scenario", "Escenario")} ${i + 1}`}</span>
                    <div className="text-right">
                      {Boolean(sc["revenue"]) && (
                        <span className="font-mono text-sm font-bold text-green-400">
                          {Number(sc["revenue"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                        </span>
                      )}
                      {Boolean(sc["roas"]) && (
                        <span className="font-mono text-[11px] text-muted-foreground ml-2">ROAS {Number(sc["roas"]).toFixed(1)}x</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(keyMetrics["breakEvenRevenue"] || keyMetrics["totalLeadsNeeded"]) ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {keyMetrics["breakEvenRevenue"] ? (
                  <div className="border border-border/30 p-2 text-center">
                    <div className="font-mono text-xs font-bold text-foreground">
                      {Number(keyMetrics["breakEvenRevenue"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground uppercase">{t("Ponto de equilíbrio", "Break-even", "Punto de equilibrio")}</div>
                  </div>
                ) : null}
                {keyMetrics["totalLeadsNeeded"] ? (
                  <div className="border border-border/30 p-2 text-center">
                    <div className="font-mono text-xs font-bold text-foreground">
                      {Number(keyMetrics["totalLeadsNeeded"]).toLocaleString("pt-BR")}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground uppercase">{t("Leads necessários", "Leads required", "Contactos necesarios")}</div>
                  </div>
                ) : null}
                {keyMetrics["averageCPLTarget"] ? (
                  <div className="border border-border/30 p-2 text-center">
                    <div className="font-mono text-xs font-bold text-foreground">
                      {Number(keyMetrics["averageCPLTarget"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground uppercase">{t("CPL alvo", "Target CPL", "CPL objetivo")}</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {riskAlerts.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{t("Alertas financeiros", "Financial alerts", "Alertas financieros")}</div>
                <BulletList items={riskAlerts} icon={AlertTriangle} color="text-yellow-400" />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 10. Success Metrics ── */}
      {Object.keys(successMetrics).length > 0 && (
        <Section icon={CheckCircle2} title={t("Métricas de sucesso", "Success metrics", "Métricas de éxito")} color="green">
          <div className="space-y-3">
            {safeStr(successMetrics["primaryKPI"] as unknown) && (
              <div className="p-3 border border-green-400/20 bg-green-400/5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-green-400/70 mb-1">{t("KPI principal", "Primary KPI", "KPI principal")}</div>
                <TextBlock text={safeStr(successMetrics["primaryKPI"] as unknown)} />
              </div>
            )}
            {criticalAssumptions.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  {t("Premissas críticas para atingir a meta", "Critical assumptions for reaching the target", "Supuestos clave para alcanzar el objetivo")}
                </div>
                <BulletList items={criticalAssumptions} icon={CheckCircle2} color="text-green-400" />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 11. Risks ── */}
      {mainRisks.length > 0 && (
        <Section icon={AlertTriangle} title={t("Análise de risco", "Risk analysis", "Análisis de riesgos")} badge={riskLevel ? `${t("Risco", "Risk", "Riesgo")} ${riskLevel}` : undefined} color="red">
          <BulletList items={mainRisks} icon={AlertTriangle} color="text-red-400" />
        </Section>
      )}

      {/* ── 12. Strategist notes ── */}
      {safeStr(strategyD["strategistNotes"] as unknown) && (
        <Section icon={Brain} title={t("Observações do estrategista", "Strategist notes", "Notas del estratega")} color="yellow">
          <TextBlock text={safeStr(strategyD["strategistNotes"] as unknown)} />
        </Section>
      )}

      {/* ── CTA: Approve & Generate Content ── */}
      {showApproveButton && onApprove && (
        <div className="border border-primary/40 bg-primary/5 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-primary mb-1">{t("Próximo passo", "Next step", "Siguiente paso")}</div>
            <p className="font-mono text-sm text-foreground">
              {t("A estratégia está aprovada? Inicie a geração de conteúdo com os 16 especialistas.", "Is the strategy approved? Start content generation with the 16 specialists.", "¿Está aprobada la estrategia? Inicia la generación de contenido con los 16 especialistas.")}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground mt-1">
              {t("Custo estimado: ~150 créditos", "Estimated cost: ~150 credits", "Costo estimado: ~150 créditos")} ({creditsToReal(150)}) {t("para a fase de conteúdo", "for the content phase", "para la fase de contenido")}
            </p>
          </div>
          <Button
            onClick={onApprove}
            disabled={approveLoading}
            className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary shrink-0"
          >
            {approveLoading ? (
              <Clock className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {t("Aprovar e gerar conteúdo", "Approve and generate content", "Aprobar y generar contenido")}
          </Button>
        </div>
      )}
    </div>
  );
}
