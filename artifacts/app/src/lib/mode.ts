import { useState, useCallback } from "react";

export type AppMode = "fundador" | "arquiteto";

function readMode(): AppMode {
  try {
    const v = localStorage.getItem("nexos_mode");
    // support legacy values
    if (v === "arquiteto" || v === "expert") return "arquiteto";
    if (v === "fundador"  || v === "guided") return "fundador";
  } catch {}
  return "fundador";
}

export function useMode() {
  const [mode, setModeState] = useState<AppMode>(readMode);

  const setMode = useCallback((m: AppMode) => {
    setModeState(m);
    try { localStorage.setItem("nexos_mode", m); } catch {}
  }, []);

  return {
    mode,
    setMode,
    // New canonical names
    isFundador:  mode === "fundador",
    isArquiteto: mode === "arquiteto",
    // Legacy aliases (backward compat)
    isGuided:    mode === "fundador",
    isExpert:    mode === "arquiteto",
  };
}
