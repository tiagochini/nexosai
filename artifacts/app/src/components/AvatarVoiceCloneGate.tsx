/**
 * AvatarVoiceCloneGate — persistent dashboard reminder to finish avatar
 * + voice clone setup before a launch track can rely on them.
 *
 * Reappears every time the dashboard mounts until BOTH persona.heygenAvatarId
 * and persona.voiceCloneId are set. Dismissing only hides it for the current
 * session (component state) — it comes back on the next visit/reload.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Camera, Mic, Check, X, ArrowRight } from "lucide-react";
import { useUiText } from "@/lib/i18n";

interface PersonaResponse {
  persona: {
    heygenAvatarId?: string;
    voiceCloneId?: string;
  };
}

export function AvatarVoiceCloneGate() {
  const t = useUiText();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/persona", "avatar-voice-gate"],
    queryFn: () => customFetch<PersonaResponse>("/api/workspaces/me/persona"),
    staleTime: 30_000,
  });

  if (isLoading || dismissed) return null;

  const persona = data?.persona ?? {};
  const hasAvatar = !!persona.heygenAvatarId;
  const hasVoice = !!persona.voiceCloneId;

  if (hasAvatar && hasVoice) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9500] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-primary/40 bg-card relative overflow-hidden">
        {["top-0 left-0 border-t border-l","top-0 right-0 border-t border-r","bottom-0 left-0 border-b border-l","bottom-0 right-0 border-b border-r"].map((c, i) => (
          <div key={i} className={`absolute w-3 h-3 ${c} border-primary`} />
        ))}

        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1">
                {t("Etapa obrigatória do lançamento", "Required launch step", "Paso obligatorio del lanzamiento")}
              </div>
              <h3 className="font-mono text-base font-bold uppercase tracking-tight text-foreground">
                {t("Configure seu Avatar e Voz", "Set up your avatar and voice", "Configura tu avatar y voz")}
              </h3>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
              aria-label={t("Fechar por enquanto", "Close for now", "Cerrar por ahora")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="font-mono text-[12px] text-muted-foreground leading-relaxed">
            {t("Seu track de lançamento usa vídeos com avatar digital e voz clonada para gerar CPLs e VSLs automaticamente. Finalize as duas etapas abaixo para liberar a geração de vídeo com IA.", "Your launch track uses videos with a digital avatar and cloned voice to generate CPLs and VSLs automatically. Complete both steps below to enable AI video generation.", "Tu flujo de lanzamiento usa videos con avatar digital y voz clonada para generar CPL y VSL automáticamente. Completa los dos pasos para habilitar la generación de video con IA.")}
          </p>

          <div className="space-y-2">
            <div className={`flex items-center gap-3 px-3 py-2.5 border ${hasAvatar ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-background/40"}`}>
              {hasAvatar ? <Check className="h-4 w-4 text-green-400 shrink-0" /> : <Camera className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className={`font-mono text-[11px] font-bold uppercase ${hasAvatar ? "text-green-300" : "text-foreground"}`}>
                  {t("Avatar Digital", "Digital Avatar", "Avatar digital")}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/60">
                  {hasAvatar ? t("Avatar configurado", "Avatar configured", "Avatar configurado") : t("Configure seu avatar digital para vídeos", "Set up your digital avatar for videos", "Configura tu avatar digital para videos")}
                </div>
              </div>
            </div>

            <div className={`flex items-center gap-3 px-3 py-2.5 border ${hasVoice ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-background/40"}`}>
              {hasVoice ? <Check className="h-4 w-4 text-green-400 shrink-0" /> : <Mic className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className={`font-mono text-[11px] font-bold uppercase ${hasVoice ? "text-green-300" : "text-foreground"}`}>
                  {t("Clone de Voz", "Voice Clone", "Clon de voz")}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/60">
                  {hasVoice ? t("Voz clonada", "Voice cloned", "Voz clonada") : t("Grave takes rápidos para clonar sua voz", "Record a few quick takes to clone your voice", "Graba unas tomas rápidas para clonar tu voz")}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/settings?tab=identidade")}
              className="flex-1 font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 text-xs"
            >
              {hasAvatar || hasVoice ? t("Continuar configuração", "Continue setup", "Continuar configuración") : t("Configurar agora", "Set up now", "Configurar ahora")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="font-mono text-[11px] uppercase tracking-widest rounded-none text-muted-foreground/50 h-10 px-3"
            >
              {t("Depois", "Later", "Después")}
            </Button>
          </div>

          <p className="font-mono text-[9px] text-muted-foreground/30 leading-relaxed">
            {t("Este lembrete reaparece a cada acesso ao painel até que o avatar e a voz estejam configurados.", "This reminder appears each time you visit the dashboard until your avatar and voice are configured.", "Este recordatorio vuelve a aparecer cada vez que accedes al panel hasta que configures el avatar y la voz.")}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
