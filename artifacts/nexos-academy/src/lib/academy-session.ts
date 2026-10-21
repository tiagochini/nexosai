export interface StudentSession {
  user: { id: string; name: string; email: string };
  products: { productId: string }[];
  progress?: Record<string, boolean>;
}
export async function academyFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, credentials: "include", cache: "no-store" });
  if (response.status === 401) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.code === "ACADEMY_SESSION_ENDED") window.dispatchEvent(new CustomEvent("academy-session-ended", { detail: body.error }));
  }
  return response;
}
export async function studentRequest(path: string, body?: unknown, method = "POST") {
  const response = await academyFetch(`/api/academy/student/${path}`, {
    method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir. Tente novamente.");
  return result;
}
