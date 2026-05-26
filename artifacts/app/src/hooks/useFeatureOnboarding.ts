/**
 * useFeatureOnboarding — controla o estado de "primeira visita" por feature.
 *
 * Cada feature tem uma chave única. Na primeira visita, `isFirstVisit` é true.
 * Chamar `markSeen()` persiste no localStorage para nunca mais mostrar automaticamente.
 * O usuário pode re-abrir manualmente via botão "Ver explicação desta área".
 */

import { useState, useEffect, useCallback } from "react";

const STORAGE_PREFIX = "nexos_feature_seen_";

export function useFeatureOnboarding(featureKey: string) {
  const storageKey = `${STORAGE_PREFIX}${featureKey}`;

  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setIsFirstVisit(true);
        setIsOpen(true);
      }
    } catch {
      // localStorage unavailable — skip onboarding
    }
  }, [storageKey]);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    setIsFirstVisit(false);
    setIsOpen(false);
  }, [storageKey]);

  const openManually = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    markSeen();
  }, [markSeen]);

  return {
    /** true apenas na primeira visita (antes de markSeen) */
    isFirstVisit,
    /** controlado — true quando o painel deve ser exibido */
    isOpen,
    /** fecha e persiste "já viu" */
    markSeen,
    /** fecha sem persistir (usuário pode reabrir) */
    close,
    /** abre manualmente (para o botão "Ver explicação") */
    openManually,
  };
}

/** Lista centralizada de chaves de feature para evitar typos */
export const FEATURE_KEYS = {
  BRIEFING:        "briefing_chat",
  WAR_ROOM:        "war_room",
  PLAN_REVIEW:     "plan_review",
  CONTENT:         "content_approval",
  CREATIVES:       "creatives",
  SEQUENCES:       "sequences",
  INTEGRATIONS:    "integrations",
  METRICS:         "metrics",
  LAUNCH_CONTROL:  "launch_control",
  ATENDIMENTO:     "atendimento",
  REVENUE:         "revenue",
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];
