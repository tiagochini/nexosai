/**
 * Contract for a real registrar integration.  Implementations must perform a
 * provider mutation and return its provider identifier; they may never report
 * a local/planned operation as successful.
 */
export interface RegistrarAdapter {
  readonly provider: string;
  availability(domain: string): Promise<{ available: boolean; currency?: string; amount?: string }>;
  register(input: { domain: string; years: number; idempotencyKey: string }): Promise<{ providerDomainId: string; expiresAt?: Date }>;
  renew(input: { providerDomainId: string; years: number; idempotencyKey: string }): Promise<{ expiresAt?: Date }>;
  upsertDns(input: { providerDomainId: string; type: string; name: string; value: string; ttl: number; idempotencyKey: string }): Promise<{ providerRecordId: string }>;
  deleteDns(input: { providerDomainId: string; providerRecordId: string; idempotencyKey: string }): Promise<void>;
}

export class HttpRegistrarAdapter implements RegistrarAdapter {
  constructor(readonly provider: string, private readonly baseUrl: string, private readonly apiKey: string) {}

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`Registrar ${this.provider} returned HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }

  availability(domain: string) { return this.request<{ available: boolean; currency?: string; amount?: string }>(`/availability?domain=${encodeURIComponent(domain)}`); }
  register(input: { domain: string; years: number; idempotencyKey: string }) { return this.request<{ providerDomainId: string; expiresAt?: string }>("/domains/register", input).then(r => ({ providerDomainId: r.providerDomainId, expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined })); }
  renew(input: { providerDomainId: string; years: number; idempotencyKey: string }) { return this.request<{ expiresAt?: string }>("/domains/renew", input).then(r => ({ expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined })); }
  upsertDns(input: { providerDomainId: string; type: string; name: string; value: string; ttl: number; idempotencyKey: string }) { return this.request<{ providerRecordId: string }>("/dns/upsert", input); }
  async deleteDns(input: { providerDomainId: string; providerRecordId: string; idempotencyKey: string }) { await this.request<void>("/dns/delete", input); }
}