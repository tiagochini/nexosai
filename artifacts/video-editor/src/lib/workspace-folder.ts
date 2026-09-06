export type WorkspaceIdentity = { id: string; name: string };
export type FolderStatus = "connected" | "permission-needed" | "unavailable" | "not-configured";

export type AuthorizedDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options?: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options?: { mode: "readwrite" }): Promise<PermissionState>;
};
type DirectoryHandle = AuthorizedDirectoryHandle;
type Picker = (options: { mode: "readwrite" }) => Promise<DirectoryHandle>;
type DownloadFallback = (blob: Blob, filename: string) => void;

const DB_NAME = "nexos-video-editor-folders";
const STORE = "workspace-folders";

export function sanitizeFolderSegment(value: string): string {
  const cleaned = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "").replace(/-+/g, "-").trim();
  return (cleaned || "workspace").slice(0, 72);
}

function stableWorkspaceSuffix(workspaceId: string): string {
  let hash = 0x811c9dc5;
  for (const character of workspaceId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function workspaceFolderName(workspace: WorkspaceIdentity): string {
  return `${sanitizeFolderSegment(workspace.name)}-${stableWorkspaceSuffix(workspace.id)}`;
}

export function workspaceFolderKey(workspaceId: string, origin = window.location.origin): string {
  return `${origin}::${workspaceId}`;
}

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function record(operation: IDBTransactionMode, key: string, value?: DirectoryHandle): Promise<DirectoryHandle | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, operation);
    const request = operation === "readonly"
      ? transaction.objectStore(STORE).get(key)
      : operation === "readwrite" && value
        ? transaction.objectStore(STORE).put(value, key)
        : transaction.objectStore(STORE).delete(key);
    request.onsuccess = () => resolve(request.result as DirectoryHandle | undefined);
    request.onerror = () => reject(request.error);
  });
}

export function folderApiAvailable(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window && "indexedDB" in window;
}

export async function getWorkspaceFolder(workspace: WorkspaceIdentity): Promise<{ handle?: DirectoryHandle; status: FolderStatus }> {
  if (!folderApiAvailable()) return { status: "unavailable" };
  const handle = await record("readonly", workspaceFolderKey(workspace.id));
  if (!handle) return { status: "not-configured" };
  const permission = await handle.queryPermission({ mode: "readwrite" });
  return { handle, status: permission === "granted" ? "connected" : "permission-needed" };
}

/** Must be called only by a button/input event handler. */
export async function configureWorkspaceFolder(workspace: WorkspaceIdentity, picker?: Picker): Promise<DirectoryHandle> {
  if (!folderApiAvailable()) throw new Error("Este navegador não oferece acesso autorizado a pastas.");
  const selectDirectory = picker ?? ((window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker.bind(window));
  const base = await selectDirectory({ mode: "readwrite" });
  const folder = await createWorkspaceDirectory(base, workspace);
  await record("readwrite", workspaceFolderKey(workspace.id), folder);
  return folder;
}

export async function createWorkspaceDirectory(base: DirectoryHandle, workspace: WorkspaceIdentity): Promise<DirectoryHandle> {
  const nexos = await base.getDirectoryHandle("NexOS", { create: true });
  return await nexos.getDirectoryHandle(workspaceFolderName(workspace), { create: true }) as DirectoryHandle;
}

export async function forgetWorkspaceFolder(workspace: WorkspaceIdentity): Promise<void> {
  if (folderApiAvailable()) await record("readwrite", workspaceFolderKey(workspace.id));
}

/** Must be called from a direct user gesture; browsers reject silent permission prompts. */
export async function requestWorkspaceFolderPermission(handle: DirectoryHandle): Promise<FolderStatus> {
  const permission = await handle.requestPermission({ mode: "readwrite" });
  return permission === "granted" ? "connected" : "permission-needed";
}

export function collisionSafeFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const extension = dot > 0 ? filename.slice(dot).replace(/[^.a-z0-9]/gi, "") : "";
  const stem = sanitizeFolderSegment(dot > 0 ? filename.slice(0, dot) : filename).replace(/\s/g, "-");
  const nonce = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${stem}-${Date.now()}-${nonce}${extension}`;
}

async function checksum(blob: Blob): Promise<string | undefined> {
  if (!crypto?.subtle) return undefined;
  const bytes = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export type SaveResult = { verified: boolean; filename: string; size: number; checksum?: string; path?: string; fallbackMessage?: string };

export async function saveWorkspaceFile(
  blob: Blob,
  filename: string,
  workspace: WorkspaceIdentity,
  handle?: DirectoryHandle,
  fallbackDownload?: DownloadFallback,
): Promise<SaveResult> {
  const safeName = collisionSafeFilename(filename);
  if (handle && await handle.queryPermission({ mode: "readwrite" }) === "granted") {
    const file = await handle.getFileHandle(safeName, { create: true });
    const writable = await file.createWritable();
    await writable.write(blob);
    await writable.close();
    return { verified: true, filename: safeName, size: blob.size, checksum: await checksum(blob), path: `NexOS/${workspaceFolderName(workspace)}/${safeName}` };
  }
  if (fallbackDownload) {
    fallbackDownload(blob, safeName);
  } else {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = safeName; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { verified: false, filename: safeName, size: blob.size, fallbackMessage: "O navegador abriu o download/compartilhamento; o sistema operacional escolhe Downloads ou Arquivos. A gravação não foi verificada pelo NexOS." };
}