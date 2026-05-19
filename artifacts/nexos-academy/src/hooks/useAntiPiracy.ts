import { useEffect, useRef, useCallback } from "react";

const SESSION_KEY = "nexos-ap-session";
const SESSION_PING_INTERVAL = 8000;
const SESSION_STALE_MS = 20000;

function genSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem("nexos-ap-sid");
  if (!id) {
    id = genSessionId();
    sessionStorage.setItem("nexos-ap-sid", id);
  }
  return id;
}

interface SessionRecord {
  sid: string;
  ts: number;
}

function readSession(): SessionRecord | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

function writeSession(sid: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ sid, ts: Date.now() }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export interface AntiPiracyOptions {
  studentName?: string;
  studentEmail?: string;
  enabled?: boolean;
  onSessionConflict?: () => void;
}

export function useAntiPiracy({
  studentName,
  studentEmail,
  enabled = true,
  onSessionConflict,
}: AntiPiracyOptions) {
  const mySid = useRef(getOrCreateSessionId());
  const conflictFired = useRef(false);

  const checkSession = useCallback(() => {
    if (!enabled) return;
    const rec = readSession();
    if (!rec) {
      writeSession(mySid.current);
      return;
    }
    const isStale = Date.now() - rec.ts > SESSION_STALE_MS;
    if (rec.sid !== mySid.current && !isStale) {
      if (!conflictFired.current) {
        conflictFired.current = true;
        onSessionConflict?.();
      }
    } else {
      writeSession(mySid.current);
      conflictFired.current = false;
    }
  }, [enabled, onSessionConflict]);

  useEffect(() => {
    if (!enabled) return;
    writeSession(mySid.current);
    const interval = setInterval(() => {
      writeSession(mySid.current);
    }, SESSION_PING_INTERVAL);
    return () => {
      clearInterval(interval);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(checkSession, SESSION_PING_INTERVAL + 1000);
    return () => clearInterval(interval);
  }, [enabled, checkSession]);

  useEffect(() => {
    if (!enabled) return;

    function onStorage(e: StorageEvent) {
      if (e.key !== SESSION_KEY) return;
      checkSession();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [enabled, checkSession]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const isWindows = navigator.platform.toUpperCase().includes("WIN");
      const isMac = navigator.platform.toUpperCase().includes("MAC");

      if (
        e.key === "PrintScreen" ||
        (isMac && e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5")) ||
        (isWindows && e.key === "PrintScreen")
      ) {
        e.preventDefault();
        flashWarning("Screenshot detectado — conteúdo marcado com seu nome.");
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "c" || e.key === "u" || e.key === "s" || e.key === "p")
      ) {
        e.preventDefault();
        if (e.key === "p") flashWarning("Impressão bloqueada.");
        return;
      }

      if (e.key === "F12") {
        e.preventDefault();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) {
        e.preventDefault();
        return;
      }
    }

    function handleContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-lesson-content]")) {
        e.preventDefault();
      }
    }

    function handleCopy(e: ClipboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-lesson-content]")) {
        e.preventDefault();
        flashWarning("Copiar desativado — conteúdo protegido.");
      }
    }

    function handleBeforePrint(e: Event) {
      e.preventDefault();
      flashWarning("Impressão bloqueada — conteúdo protegido.");
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    window.addEventListener("beforeprint", handleBeforePrint);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, [enabled, studentName, studentEmail]);

  return { sessionId: mySid.current };
}

let flashTimeout: ReturnType<typeof setTimeout> | null = null;

function flashWarning(msg: string) {
  const existing = document.getElementById("nexos-ap-flash");
  if (existing) existing.remove();
  if (flashTimeout) clearTimeout(flashTimeout);

  const el = document.createElement("div");
  el.id = "nexos-ap-flash";
  el.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    z-index: 99999; background: hsl(0 70% 30%); color: white;
    padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
    border: 1px solid hsl(0 70% 45%); box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    pointer-events: none; white-space: nowrap;
  `;
  el.textContent = "⚠️ " + msg;
  document.body.appendChild(el);
  flashTimeout = setTimeout(() => el.remove(), 3500);
}

export { clearSession };
