/**
 * IdentityMemoryCard — Modo Arquiteto
 *
 * Mostra o perfil estratégico longitudinal do workspace:
 * tom preferido, gatilhos, padrões, perfil do founder.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Brain, RefreshCw, ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { useUiText, useUiLocale, intlLocale } from "@/lib/i18n";

interface StrategicPattern {
  pattern:  string;
  strength: "strong" | "moderate" | "weak";
  evidence: string;
  lastSeen: string;
}

interface IdentityProfile {
  version:              number;
  lastUpdatedAt:        string;
  campaignsLearned:     number;
  preferredTone:        string | null;
  preferredEmotion:     string | null;
  aggressionLevel:      "low" | "moderate" | "high" | null;
  brandVoiceKeywords:   string[];
  successfulTriggers:   string[];
  saturatedApproaches:  string[];
  topPositioning:       string | null;
  preferredCampaignTypes: string[];
  icpEvolution:         string[];
  conversionContext:    string[];
  strategicPatterns:    StrategicPattern[];
  founderNotes:         string[];
}

type TranslationTriple = readonly [string, string, string];

const STRENGTH_COLOR = {
  strong:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  moderate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  weak:     "text-white/30 bg-white/5 border-white/10",
};

const AGGRESSION_LABEL: Record<NonNullable<IdentityProfile["aggressionLevel"]>, TranslationTriple> = {
  low:      ["Conservador", "Conservative", "Conservador"],
  moderate: ["Equilibrado", "Balanced", "Equilibrado"],
  high:     ["Agressivo", "Aggressive", "Agresivo"],
};

const STRENGTH_LABEL: Record<StrategicPattern["strength"], TranslationTriple> = {
  strong: ["Forte", "Strong", "Fuerte"],
  moderate: ["Moderado", "Moderate", "Moderado"],
  weak: ["Fraco", "Weak", "Débil"],
};

const AGGRESSION_COLOR = {
  low:      "text-blue-400",
  moderate: "text-violet-400",
  high:     "text-red-400",
};

export function IdentityMemoryCard() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["identity-profile"],
    queryFn:  () => customFetch<{ profile: IdentityProfile }>("/api/workspaces/me/identity"),
    staleTime: 60_000,
  });

  const refresh = useMutation({
    mutationFn: () => customFetch<{ profile: IdentityProfile }>("/api/workspaces/me/identity/refresh", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["identity-profile"] }),
  });

  const profile = data?.profile;

  return (
    <div className="border border-violet-500/20 rounded-xl bg-[#08051a] overflow-hidden shadow-[0_0_32px_rgba(139,92,246,0.05)]">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/2 transition-colors text-left border-b border-white/5"
      >
        <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Brain className="h-4 w-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-mono text-sm font-bold text-white uppercase tracking-widest">
             {t("Memória de Identidade", "Identity Memory", "Memoria de identidad")}
          </h3>
          <p className="font-mono text-[10px] text-violet-400/60 uppercase tracking-widest">
            {isLoading ? t("Carregando...", "Loading...", "Cargando...") : t(`${profile?.campaignsLearned ?? 0} campanhas aprendidas · perfil estratégico persistente`, `${profile?.campaignsLearned ?? 0} campaigns learned · persistent strategic profile`, `${profile?.campaignsLearned ?? 0} campañas aprendidas · perfil estratégico persistente`)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile && (
            <button
              onClick={e => { e.stopPropagation(); refresh.mutate(); }}
              className="p-1.5 rounded-lg border border-white/10 hover:border-violet-500/30 hover:bg-violet-500/10 transition-colors"
              disabled={refresh.isPending}
              title={t("Atualizar perfil", "Refresh profile", "Actualizar perfil")}
              aria-label={t("Atualizar perfil", "Refresh profile", "Actualizar perfil")}
            >
              <RefreshCw className={`h-3 w-3 text-white/40 ${refresh.isPending ? "animate-spin" : ""}`} />
            </button>
          )}
          {expanded
            ? <ChevronDown className="h-4 w-4 text-white/30" />
            : <ChevronRight className="h-4 w-4 text-white/30" />
          }
        </div>
      </button>

      {/* Collapsed preview */}
      {!expanded && profile && profile.campaignsLearned > 0 && (
        <div className="flex items-center gap-6 px-6 py-3">
          {profile.preferredTone && (
            <div>
               <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">{t("Tom", "Tone", "Tono")}</p>
              <p className="text-xs font-mono text-violet-300">{profile.preferredTone}</p>
            </div>
          )}
          {profile.aggressionLevel && (
            <div>
               <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">{t("Estilo", "Style", "Estilo")}</p>
              <p className={`text-xs font-mono ${AGGRESSION_COLOR[profile.aggressionLevel]}`}>
                {t(...AGGRESSION_LABEL[profile.aggressionLevel])}
              </p>
            </div>
          )}
          {profile.topPositioning && (
            <div>
              <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">{t("Posicionamento", "Positioning", "Posicionamiento")}</p>
              <p className="text-xs font-mono text-blue-300">{profile.topPositioning}</p>
            </div>
          )}
          {profile.successfulTriggers.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">{t("Top gatilho", "Top trigger", "Principal detonante")}</p>
              <p className="text-xs font-mono text-emerald-300">{profile.successfulTriggers[0]}</p>
            </div>
          )}
        </div>
      )}

      {!expanded && (!profile || profile.campaignsLearned === 0) && !isLoading && (
        <div className="px-6 py-3">
          <p className="text-xs font-mono text-white/20">
             {t("Perfil será construído automaticamente após a primeira campanha executada.", "Your profile will be built automatically after your first campaign is run.", "El perfil se creará automáticamente después de ejecutar la primera campaña.")}
          </p>
        </div>
      )}

      {/* Expanded */}
      {expanded && profile && (
        <div className="px-6 py-4 space-y-5">

          {/* Top stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("Campanhas", "Campaigns", "Campañas"), value: String(profile.campaignsLearned), color: "text-white" },
              { label: t("Tom preferido", "Preferred tone", "Tono preferido"), value: profile.preferredTone ?? "—", color: "text-violet-300" },
              { label: t("Estilo", "Style", "Estilo"), value: profile.aggressionLevel ? t(...AGGRESSION_LABEL[profile.aggressionLevel]) : "—", color: profile.aggressionLevel ? AGGRESSION_COLOR[profile.aggressionLevel] : "text-white/30" },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-lg border border-white/8 bg-white/2">
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
                <p className={`text-sm font-mono font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Strategic patterns */}
          {profile.strategicPatterns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-3 w-3 text-violet-400" />
                <p className="text-[10px] font-mono text-violet-400/70 uppercase tracking-widest font-semibold">{t("Padrões estratégicos", "Strategic patterns", "Patrones estratégicos")}</p>
              </div>
              <div className="space-y-2">
                {profile.strategicPatterns.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-white/8 bg-white/2">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${STRENGTH_COLOR[p.strength]} shrink-0`}>
                       {t(...STRENGTH_LABEL[p.strength])}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-white/70">{p.pattern}</p>
                      <p className="text-[10px] font-mono text-white/30 mt-0.5">{p.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Triggers + Brand voice */}
          <div className="grid grid-cols-2 gap-4">
            {profile.successfulTriggers.length > 0 && (
              <div>
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">{t("Gatilhos que convertem", "Triggers that convert", "Detonantes que convierten")}</p>
                <div className="flex flex-wrap gap-1">
                  {profile.successfulTriggers.map((t, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/8 text-emerald-300">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.brandVoiceKeywords.length > 0 && (
              <div>
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">{t("Voz da marca", "Brand voice", "Voz de marca")}</p>
                <div className="flex flex-wrap gap-1">
                  {profile.brandVoiceKeywords.map((k, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded border border-violet-500/20 bg-violet-500/8 text-violet-300">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ICP evolution */}
          {profile.icpEvolution.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">{t("Evolução do ICP", "ICP evolution", "Evolución del ICP")}</p>
              <div className="space-y-1">
                {profile.icpEvolution.map((desc, i) => (
                  <p key={i} className="text-[11px] font-mono text-white/40">· {desc}</p>
                ))}
              </div>
            </div>
          )}

          {/* Founder notes */}
          {profile.founderNotes.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">{t("Notas do founder", "Founder notes", "Notas del fundador")}</p>
              <div className="space-y-1">
                {profile.founderNotes.map((n, i) => (
                  <p key={i} className="text-[11px] font-mono text-white/40 italic">"{n}"</p>
                ))}
              </div>
            </div>
          )}

          <p className="text-[9px] font-mono text-white/15 uppercase tracking-widest">
            {t("Última atualização:", "Last updated:", "Última actualización:")} {new Date(profile.lastUpdatedAt).toLocaleDateString(intlLocale(locale))}
          </p>
        </div>
      )}
    </div>
  );
}
