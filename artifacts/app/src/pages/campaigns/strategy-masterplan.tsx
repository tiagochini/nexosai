import {
  Target, Users, Zap, BarChart3, Brain, ShieldAlert,
  TrendingUp, MessageSquare, Lightbulb,
  Star, Flame,
} from "lucide-react";

export type StrategyObj = Record<string, unknown>;

export function parseStrategyInsights(strategyD: StrategyObj): StrategyObj {
  const raw = strategyD["executiveSummary"];
  if (typeof raw !== "string") return {};
  const stripped = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    return typeof parsed === "object" && parsed !== null ? parsed as StrategyObj : {};
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]) as StrategyObj; } catch { return {}; }
  }
}

type Obj = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function num(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function obj(v: unknown): Obj {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Obj;
  return {};
}

function SectionHeader({ icon: Icon, label, accent = false }: { icon: React.ElementType; label: string; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${accent ? "border-cyan-400/30" : "border-white/8"}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${accent ? "text-cyan-400" : "text-primary/60"}`} />
      <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${accent ? "text-cyan-400" : "text-muted-foreground/60"}`}>
        {label}
      </span>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">{label}</div>
      <p className="font-mono text-xs text-foreground/85 leading-relaxed">{value}</p>
    </div>
  );
}

function BulletList({ label, items, variant = "default" }: { label: string; items: string[]; variant?: "default" | "green" | "red" | "yellow" }) {
  if (!items.length) return null;
  const dotColor = variant === "green" ? "text-emerald-400" : variant === "red" ? "text-red-400" : variant === "yellow" ? "text-yellow-400" : "text-primary/50";
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">{label}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`${dotColor} shrink-0 mt-0.5 text-xs leading-none`}>·</span>
            <span className="font-mono text-xs text-foreground/80 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-white/8 bg-white/[0.025] p-4 space-y-4 ${className}`}>
      {children}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    low: { label: "RISCO BAIXO", cls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" },
    medium: { label: "RISCO MÉDIO", cls: "border-yellow-500/40 text-yellow-400 bg-yellow-500/5" },
    high: { label: "RISCO ALTO", cls: "border-red-500/40 text-red-400 bg-red-500/5" },
  };
  const cfg = map[level] ?? map.medium;
  return (
    <span className={`inline-block font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function TriggerChip({ label }: { label: string }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 border border-primary/25 bg-primary/5 text-primary/80">
      {label}
    </span>
  );
}

interface StrategyMasterplanProps {
  strategyD: Obj;
  ins: Obj;
}

export function StrategyMasterplan({ strategyD, ins }: StrategyMasterplanProps) {
  const hasIns = Object.keys(ins).length > 0;
  const src = hasIns ? ins : strategyD;

  const executiveSummary = str(src["executiveSummary"]) || str(strategyD["executiveSummary"]);
  const bigDomino = str(src["bigDomino"]) || str(strategyD["bigDomino"]);
  const strategistNotes = str(src["strategistNotes"]) || str(strategyD["strategistNotes"]);

  const market = obj(src["marketDiagnosis"] ?? strategyD["marketDiagnosis"]);
  const positioning = obj(src["offerPositioning"] ?? strategyD["offerPositioning"]);
  const audience = obj(src["audienceSegmentation"] ?? strategyD["audienceSegmentation"]);
  const architecture = obj(src["campaignArchitecture"] ?? strategyD["campaignArchitecture"]);
  const metrics = obj(src["successMetrics"] ?? strategyD["successMetrics"]);
  const risks = obj(src["risks"] ?? strategyD["risks"]);
  const triggerMap = obj(src["triggerMap"] ?? strategyD["triggerMap"]);

  const hasContent = !!(
    executiveSummary || bigDomino ||
    Object.keys(positioning).length > 0 ||
    Object.keys(audience).length > 0 ||
    Object.keys(architecture).length > 0
  );

  if (!hasContent) {
    return (
      <div className="py-6 text-center">
        <p className="font-mono text-xs text-muted-foreground/40">Plano estratégico sendo processado...</p>
      </div>
    );
  }

  const revenueTarget = num(metrics["revenueTarget"]);
  const conversionRate = num(metrics["conversionRateTarget"]);
  const triggerSequence = arr(triggerMap["triggerStackSequence"]);
  const dominantTrigger = str(triggerMap["dominantTrigger"]);
  const dominantTriggerJustification = str(triggerMap["dominantTriggerJustification"]);
  const socialProofBlueprint = str(triggerMap["socialProofBlueprint"]);
  const antiRequisiteAngles = arr(triggerMap["antiRequisiteAngles"]);
  const transformationBridge = str(triggerMap["transformationBridge"]);

  return (
    <div className="space-y-4">

      {/* ── DIAGNÓSTICO EXECUTIVO ─────────────────── */}
      {executiveSummary && (
        <Card className="border-cyan-400/20 bg-cyan-400/[0.03]">
          <SectionHeader icon={Brain} label="Diagnóstico Executivo" accent />
          <p className="font-mono text-xs text-foreground/85 leading-relaxed">{executiveSummary}</p>
        </Card>
      )}

      {/* ── BIG DOMINO ───────────────────────────── */}
      {bigDomino && (
        <Card className="border-primary/25 bg-primary/[0.04]">
          <SectionHeader icon={Zap} label="Big Domino — A Crença Central" />
          <p className="font-mono text-sm text-foreground leading-relaxed font-bold italic">
            "{bigDomino}"
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/40 leading-relaxed">
            Implantando esta crença, todas as objeções colapsam automaticamente.
          </p>
        </Card>
      )}

      {/* ── POSICIONAMENTO DA OFERTA ─────────────── */}
      {Object.keys(positioning).length > 0 && (
        <Card>
          <SectionHeader icon={Target} label="Posicionamento da Oferta" />
          <div className="space-y-4">
            {str(positioning["uniqueValueProposition"]) && (
              <div className="border-l-2 border-primary/40 pl-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">Proposta Única de Valor</div>
                <p className="font-mono text-sm text-foreground/90 leading-snug font-semibold">
                  {str(positioning["uniqueValueProposition"])}
                </p>
              </div>
            )}
            {str(positioning["primaryDifferentiator"]) && (
              <TextBlock label="Mecanismo Único" value={str(positioning["primaryDifferentiator"])} />
            )}
            {str(positioning["positioning"]) && (
              <TextBlock label="Posicionamento Estratégico" value={str(positioning["positioning"])} />
            )}
            {str(positioning["priceJustification"]) && (
              <TextBlock label="Justificativa de Preço" value={str(positioning["priceJustification"])} />
            )}
            {arr(positioning["competitiveAdvantages"]).length > 0 && (
              <BulletList label="Vantagens Competitivas" items={arr(positioning["competitiveAdvantages"])} variant="green" />
            )}
          </div>
        </Card>
      )}

      {/* ── MERCADO ──────────────────────────────── */}
      {Object.keys(market).length > 0 && (
        <Card>
          <SectionHeader icon={TrendingUp} label="Diagnóstico de Mercado" />
          <div className="space-y-4">
            {str(market["marketMaturity"]) && (
              <div className="flex items-center gap-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">Maturidade</div>
                <span className="font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 border border-yellow-500/30 bg-yellow-500/5 text-yellow-400">
                  {str(market["marketMaturity"])}
                </span>
              </div>
            )}
            {str(market["competitiveLandscape"]) && (
              <TextBlock label="Cenário Competitivo" value={str(market["competitiveLandscape"])} />
            )}
            {arr(market["opportunities"]).length > 0 && (
              <BulletList label="Oportunidades" items={arr(market["opportunities"])} variant="green" />
            )}
            {arr(market["threats"]).length > 0 && (
              <BulletList label="Ameaças" items={arr(market["threats"])} variant="red" />
            )}
            {arr(market["entryBarriers"]).length > 0 && (
              <BulletList label="Barreiras de Entrada" items={arr(market["entryBarriers"])} />
            )}
          </div>
        </Card>
      )}

      {/* ── AVATAR E AUDIÊNCIA ───────────────────── */}
      {Object.keys(audience).length > 0 && (
        <Card>
          <SectionHeader icon={Users} label="Segmentação de Audiência" />
          <div className="space-y-4">
            {str(audience["primaryAvatar"]) && (
              <div className="border border-white/10 p-3 bg-white/[0.02]">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5 flex items-center gap-1.5">
                  <Star className="h-2.5 w-2.5" /> Avatar Principal
                </div>
                <p className="font-mono text-xs text-foreground/85 leading-relaxed">{str(audience["primaryAvatar"])}</p>
              </div>
            )}
            {str(audience["psychographicProfile"]) && (
              <TextBlock label="Perfil Psicográfico" value={str(audience["psychographicProfile"])} />
            )}
            {str(audience["sophisticationStrategy"]) && (
              <TextBlock label="Estratégia de Sofisticação" value={str(audience["sophisticationStrategy"])} />
            )}
            {arr(audience["buyingTriggers"]).length > 0 && (
              <BulletList label="Gatilhos de Compra" items={arr(audience["buyingTriggers"])} variant="yellow" />
            )}
            {arr(audience["objections"]).length > 0 && (
              <BulletList label="Objeções Reais" items={arr(audience["objections"])} variant="red" />
            )}
            {arr(audience["secondaryAvatars"]).length > 0 && (
              <BulletList label="Avatares Secundários" items={arr(audience["secondaryAvatars"])} />
            )}
          </div>
        </Card>
      )}

      {/* ── ARQUITETURA DA CAMPANHA ──────────────── */}
      {Object.keys(architecture).length > 0 && (
        <Card>
          <SectionHeader icon={Lightbulb} label="Arquitetura da Campanha" />
          <div className="space-y-4">
            {str(architecture["coreNarrative"]) && (
              <div className="border-l-2 border-cyan-400/40 pl-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">Narrativa Central</div>
                <p className="font-mono text-sm text-foreground/90 leading-relaxed font-semibold">
                  {str(architecture["coreNarrative"])}
                </p>
              </div>
            )}
            {str(architecture["emotionalHook"]) && (
              <TextBlock label="Gancho Emocional" value={str(architecture["emotionalHook"])} />
            )}
            {str(architecture["callToActionStrategy"]) && (
              <TextBlock label="Estratégia de CTA" value={str(architecture["callToActionStrategy"])} />
            )}
            {arr(architecture["keyMessages"]).length > 0 && (
              <BulletList label="Mensagens-Chave" items={arr(architecture["keyMessages"])} variant="green" />
            )}
            {arr(architecture["contentPillars"]).length > 0 && (
              <BulletList label="Pilares de Conteúdo" items={arr(architecture["contentPillars"])} />
            )}
          </div>
        </Card>
      )}

      {/* ── GATILHOS MENTAIS ─────────────────────── */}
      {(dominantTrigger || triggerSequence.length > 0 || transformationBridge || antiRequisiteAngles.length > 0) && (
        <Card>
          <SectionHeader icon={Flame} label="Engenharia de Gatilhos" />
          <div className="space-y-4">
            {dominantTrigger && (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">Gatilho Dominante</div>
                <div className="flex items-center gap-2">
                  <TriggerChip label={dominantTrigger} />
                </div>
                {dominantTriggerJustification && (
                  <p className="font-mono text-[11px] text-muted-foreground/60 mt-1.5 leading-relaxed">{dominantTriggerJustification}</p>
                )}
              </div>
            )}
            {triggerSequence.length > 0 && (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-2">Sequência Dia a Dia</div>
                <div className="space-y-1">
                  {triggerSequence.map((t, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-primary/40 shrink-0 w-8">D{i + 1}</span>
                      <span className="font-mono text-[11px] text-foreground/75">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {transformationBridge && (
              <TextBlock label="Ponte de Transformação" value={transformationBridge} />
            )}
            {antiRequisiteAngles.length > 0 && (
              <BulletList label="Ângulos Anti-Requisito" items={antiRequisiteAngles} variant="yellow" />
            )}
            {socialProofBlueprint && (
              <TextBlock label="Blueprint de Prova Social" value={socialProofBlueprint} />
            )}
          </div>
        </Card>
      )}

      {/* ── MÉTRICAS DE SUCESSO ──────────────────── */}
      {Object.keys(metrics).length > 0 && (
        <Card>
          <SectionHeader icon={BarChart3} label="Métricas de Sucesso" />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {str(metrics["primaryKPI"]) && (
                <div className="border border-white/8 p-3 bg-white/[0.02]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">KPI Principal</div>
                  <p className="font-mono text-xs text-foreground/85 font-semibold">{str(metrics["primaryKPI"])}</p>
                </div>
              )}
              {revenueTarget !== null && revenueTarget > 0 && (
                <div className="border border-emerald-500/20 p-3 bg-emerald-500/[0.03]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">Meta de Receita</div>
                  <p className="font-mono text-xs text-emerald-400 font-bold">
                    R$ {revenueTarget.toLocaleString("pt-BR")}
                  </p>
                </div>
              )}
              {conversionRate !== null && conversionRate > 0 && (
                <div className="border border-white/8 p-3 bg-white/[0.02]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">Taxa de Conv. Alvo</div>
                  <p className="font-mono text-xs text-foreground/85 font-semibold">{(conversionRate * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
            {arr(metrics["criticalAssumptions"]).length > 0 && (
              <BulletList label="Premissas Críticas" items={arr(metrics["criticalAssumptions"])} variant="yellow" />
            )}
          </div>
        </Card>
      )}

      {/* ── RISCOS ───────────────────────────────── */}
      {Object.keys(risks).length > 0 && (
        <Card>
          <SectionHeader icon={ShieldAlert} label="Análise de Riscos" />
          <div className="space-y-4">
            {str(risks["level"]) && <RiskBadge level={str(risks["level"])} />}
            {arr(risks["mainRisks"]).length > 0 && (
              <BulletList label="Principais Riscos" items={arr(risks["mainRisks"])} variant="red" />
            )}
            {arr(risks["mitigations"]).length > 0 && (
              <BulletList label="Mitigações" items={arr(risks["mitigations"])} variant="green" />
            )}
          </div>
        </Card>
      )}

      {/* ── NOTA DO ESTRATEGISTA ─────────────────── */}
      {strategistNotes && (
        <Card className="border-yellow-500/20 bg-yellow-500/[0.03]">
          <SectionHeader icon={MessageSquare} label="Nota do Estrategista" />
          <p className="font-mono text-xs text-foreground/80 leading-relaxed">{strategistNotes}</p>
        </Card>
      )}
    </div>
  );
}
