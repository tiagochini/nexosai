const RECOVERY_KEY = "nexos:chunk-recovery";

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk [\w-]+ failed/i.test(message);
}

export function recoverChunkLoad(
  error: unknown,
  version: string,
  storage: Pick<Storage, "getItem" | "setItem">,
  reload: () => void,
): boolean {
  if (!isChunkLoadError(error)) return false;
  try {
    // Keep the marker after a successful load: a broken deployment must never
    // trap this tab in a reload loop. A new entry bundle permits a new attempt.
    if (storage.getItem(RECOVERY_KEY) === version) return false;
    storage.setItem(RECOVERY_KEY, version);
  } catch {
    // Without persistent state we cannot safely limit automatic reloads.
    return false;
  }
  reload();
  return true;
}

export function installChunkRecovery() {
  const version = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
  if (!version) return;
  window.addEventListener("vite:preloadError", (event) => {
    const error = (event as Event & { payload: unknown }).payload;
    try {
      if (recoverChunkLoad(error, version, window.sessionStorage, () => window.location.reload())) {
        event.preventDefault();
      }
    } catch {
      // sessionStorage may be unavailable; leave the error boundary in control.
    }
  });
}
