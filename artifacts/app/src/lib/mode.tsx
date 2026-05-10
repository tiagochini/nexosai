import { useState, useCallback } from "react";

export type AppMode = "guided" | "expert";

function readMode(): AppMode {
  try {
    const v = localStorage.getItem("nexos_mode");
    if (v === "expert" || v === "guided") return v;
  } catch {}
  return "guided";
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
    isExpert: mode === "expert",
    isGuided: mode === "guided",
  };
}
