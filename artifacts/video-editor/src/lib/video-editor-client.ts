import type { CreateStudioProjectInput, StudioProject, StudioProjectCollection } from "../domain/projects";
import type { ProjectDetail, TimelineData, Asset } from "../domain/editor";

const apiBase = `${import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}/../../api`;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("accessToken")
    ?? localStorage.getItem("nexos_access_token")
    ?? sessionStorage.getItem("accessToken")
    ?? sessionStorage.getItem("nexos_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function download(path: string): Promise<Blob> {
  const response = await fetch(`${apiBase}${path}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  return response.blob();
}
async function downloadWithMeta(path: string): Promise<{ blob: Blob; checksum?: string; size?: number }> {
  const response = await fetch(`${apiBase}${path}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const size = Number(response.headers.get("content-length"));
  return { blob: await response.blob(), checksum: response.headers.get("x-content-sha256") ?? undefined, size: Number.isFinite(size) ? size : undefined };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const videoEditorClient = {
  apiBase,
  listProjects: () => request<StudioProjectCollection>("/video-editor/projects"),
  getProject: (id: string) => request<ProjectDetail>(`/video-editor/projects/${id}`),
  createProject: (input: CreateStudioProjectInput) => request<StudioProject>("/video-editor/projects", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }),
  updateTimeline: (id: string, data: TimelineData, expectedRevisionNumber?: number) => request<ProjectDetail>(`/video-editor/projects/${id}/timeline`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, expectedRevisionNumber }),
  }),
  runPlanningEnsemble: <T = unknown>(id: string) => request<T>(`/video-editor/projects/${id}/planning-ensemble`, { method: "POST" }),
  runAutonomousPreproduction: <T = unknown>(id: string) => request<T>(`/video-editor/projects/${id}/autonomous-preproduction`, { method: "POST" }),
  advanceProduction: <T = unknown>(id: string) => request<T>(`/video-editor/projects/${id}/advance-production`, { method: "POST" }),
  createRender: <T = { render: { id: string; status: string } }>(id: string) => request<T>(`/video-editor/projects/${id}/render`, { method: "POST" }),
  getRender: <T = { render: { id: string; status: string; outputUri?: string; errorMessage?: string } }>(projectId: string, renderId: string) =>
    request<T>(`/video-editor/projects/${projectId}/render/${renderId}`),
  submitQc: <T = unknown>(projectId: string, renderJobId: string) => request<T>(`/video-editor/projects/${projectId}/qc`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renderJobId }),
  }),
  getCapabilities: <T = { native?: { available: boolean; workers: Array<{ name: string; capabilities: Array<{ modelId?: string; modelRevision?: string; licenseApproved?: boolean; resolutions?: string[] }> }> }; digitalTwin?: { backend: string; nativeCloneEngineAvailable: boolean } }>() => request<T>("/video-editor/capabilities"),
  renderTrailer: <T = { render: { id: string; status: string } }>(id: string, duration: 15 | 30) => request<T>(`/video-editor/projects/${id}/trailers/${duration}/render`, { method: "POST" }),
  getRenderMedia: (projectId: string, renderJobId: string) => download(`/video-editor/projects/${projectId}/render/${renderJobId}/media`),
  downloadRenderHandoff: (projectId: string, renderJobId: string) => downloadWithMeta(`/video-editor/projects/${projectId}/render/${renderJobId}/download`),
  downloadEditablePackage: (projectId: string, includeOutputs = false) => downloadWithMeta(`/video-editor/projects/${projectId}/export-package?includeOutputs=${includeOutputs}`),
  confirmEditablePackage: <T = { checksum: string; confirmed: boolean }>(projectId: string, checksum: string, confirmation: string) =>
    request<T>(`/video-editor/projects/${projectId}/export-package/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checksum, confirmation }) }),
  importEditablePackage: (file: File) => {
    const form = new FormData(); form.append("package", file);
    return request<ProjectDetail>("/video-editor/projects/import-package", { method: "POST", body: form });
  },
  purgeMedia: <T = { status: string }>(projectId: string, body: { renderJobId: string; expectedChecksum: string; confirmation: string }, retry = false) =>
    request<T>(`/video-editor/projects/${projectId}/purge-media${retry ? "/retry" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  getTrailerMedia: (projectId: string, duration: 15 | 30, renderJobId: string) => download(`/video-editor/projects/${projectId}/trailers/${duration}/${renderJobId}/media`),
  getManifest: <T = unknown>(id: string) => request<T>(`/video-editor/projects/${id}/manifest`),
  upload: (file: File) => {
    const form = new FormData();
    form.append("video", file);
    return request<{ fileId: string; originalName: string; duration: number; size: number }>("/video-editor/upload", { method: "POST", body: form });
  },
  attachUpload: async (id: string, fileId: string, name: string) => {
    const res = await request<{asset: Asset}>(`/video-editor/projects/${id}/assets/from-upload`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId, name }),
    });
    return res.asset;
  },
  getAssetMedia: (projectId: string, assetId: string) => download(`/video-editor/projects/${projectId}/assets/${assetId}/media`),
  deleteFile: (fileId: string) => request<void>(`/video-editor/files/${fileId}`, { method: "DELETE" }),
  downloadFile: (fileId: string) => download(`/video-editor/files/${fileId}?download=1`),
  transcribeTake: (fileId: string) => request<void>(`/video-editor/transcribe/${fileId}`, { method: "POST" }),
  smartEdit: <T>(body: unknown) => request<T>("/video-editor/smart-edit", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }),
  process: (body: unknown) => request<{ jobId: string }>("/video-editor/process", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }),
  getJob: <T>(jobId: string) => request<T>(`/video-editor/jobs/${jobId}`),
  transcribeAudio: (body: unknown) => request<{ text: string }>("/agents/transcribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }),
  visualAnalysis: <T>(fileId: string) => request<T>(`/video-editor/visual-analysis/${fileId}`, { method: "POST" }),
  directorChat: <T>(body: unknown) => request<T>("/video-editor/director-chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }),
};