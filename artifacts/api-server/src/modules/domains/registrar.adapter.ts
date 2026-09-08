/**
 * Contract for a real registrar integration.  Implementations must perform a
 * provider mutation and return its provider identifier; they may never report
 * a local/planned operation as successful.
 */
export interface RegistrarAdapter {
  readonly provider: string;
  availability(domain: string): Promise<{ available: boolean; currency?: string; amount?: string }>;
  /** A supplier-hosted artifact; NexOS never accepts payment data or settles it. */
  prepareOrder(input: { domain: string; years: number; idempotencyKey: string }): Promise<{ orderId: string; paymentReference: string; paymentUrl?: string; paymentInstructions?: string; paymentStatus: "awaiting_payment" | "paid" | "provisioned" | "expired" }>;
  getOrder(input: { orderId: string }): Promise<{ paymentReference: string; paymentStatus: "awaiting_payment" | "paid" | "provisioned" | "expired"; providerDomainId?: string; expiresAt?: Date }>;
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
  prepareOrder(input: { domain: string; years: number; idempotencyKey: string }) { return this.request<{ orderId?: string; paymentReference?: string; paymentUrl?: string; paymentInstructions?: string; paymentStatus?: "awaiting_payment" | "paid" | "provisioned" | "expired" }>("/domains/orders", input).then(r => {
    if (!r.orderId || !r.paymentReference || !r.paymentStatus || (!r.paymentUrl && !r.paymentInstructions)) throw new Error("Provider response lacks an official supplier payment artifact");
    return { orderId: r.orderId, paymentReference: r.paymentReference, paymentUrl: r.paymentUrl, paymentInstructions: r.paymentInstructions, paymentStatus: r.paymentStatus };
  }); }
  getOrder(input: { orderId: string }) { return this.request<{ paymentReference?: string; paymentStatus?: "awaiting_payment" | "paid" | "provisioned" | "expired"; providerDomainId?: string; expiresAt?: string }>(`/domains/orders/${encodeURIComponent(input.orderId)}`).then(r => {
    if (!r.paymentReference || !r.paymentStatus) throw new Error("Provider payment reconciliation response lacks receipt");
    return { paymentReference: r.paymentReference, paymentStatus: r.paymentStatus, providerDomainId: r.providerDomainId, expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined };
  }); }
  register(input: { domain: string; years: number; idempotencyKey: string }) { return this.request<{ providerDomainId: string; expiresAt?: string }>("/domains/register", input).then(r => ({ providerDomainId: r.providerDomainId, expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined })); }
  renew(input: { providerDomainId: string; years: number; idempotencyKey: string }) { return this.request<{ expiresAt?: string }>("/domains/renew", input).then(r => ({ expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined })); }
  upsertDns(input: { providerDomainId: string; type: string; name: string; value: string; ttl: number; idempotencyKey: string }) { return this.request<{ providerRecordId: string }>("/dns/upsert", input); }
  async deleteDns(input: { providerDomainId: string; providerRecordId: string; idempotencyKey: string }) { await this.request<void>("/dns/delete", input); }
}

/** Cloudflare's public API manages zones and DNS, not domain purchases. */
export class CloudflareDnsAdapter implements RegistrarAdapter {
  readonly provider = "cloudflare";
  constructor(private readonly baseUrl: string, private readonly token: string, private readonly accountId: string) {}
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init, headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json", ...init.headers },
    });
    const payload = await response.json() as { success?: boolean; result?: T; errors?: Array<{ message?: string }> };
    if (!response.ok || !payload.success) throw new Error(`Cloudflare request failed: ${payload.errors?.map(e => e.message).join(", ") || response.status}`);
    return payload.result as T;
  }
  private async zoneId(domain: string) {
    const zones = await this.request<Array<{ id: string }>>(`/zones?name=${encodeURIComponent(domain)}&account.id=${encodeURIComponent(this.accountId)}`);
    if (zones[0]?.id) return zones[0].id;
    const created = await this.request<{ id: string }>("/zones", {
      method: "POST", body: JSON.stringify({ name: domain, account: { id: this.accountId }, jump_start: false }),
    });
    if (!created.id) throw new Error("Cloudflare response lacks zone receipt");
    return created.id;
  }
  async availability(): Promise<{ available: boolean }> { throw new Error("Cloudflare does not expose domain registration availability through this adapter"); }
  async prepareOrder(): Promise<never> { throw new Error("Cloudflare cannot create an official domain payment artifact through this integration"); }
  async getOrder(): Promise<never> { throw new Error("Cloudflare cannot reconcile a domain payment artifact through this integration"); }
  async register(): Promise<{ providerDomainId: string }> { throw new Error("Cloudflare domain purchase is not supported by this integration"); }
  async renew(): Promise<{ expiresAt?: Date }> { throw new Error("Cloudflare domain renewal is managed in the provider account"); }
  async upsertDns(input: { providerDomainId: string; type: string; name: string; value: string; ttl: number; idempotencyKey: string }) {
    const zoneId = await this.zoneId(input.providerDomainId);
    const records = await this.request<Array<{ id: string }>>(`/zones/${zoneId}/dns_records?type=${encodeURIComponent(input.type)}&name=${encodeURIComponent(input.name)}`);
    const body = { type: input.type, name: input.name, content: input.value, ttl: input.ttl };
    const record = records[0]
      ? await this.request<{ id: string }>(`/zones/${zoneId}/dns_records/${records[0].id}`, { method: "PUT", body: JSON.stringify(body), headers: { "idempotency-key": input.idempotencyKey } })
      : await this.request<{ id: string }>(`/zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify(body), headers: { "idempotency-key": input.idempotencyKey } });
    if (!record.id) throw new Error("Cloudflare response lacks DNS record receipt");
    return { providerRecordId: record.id };
  }
  async deleteDns(input: { providerDomainId: string; providerRecordId: string; idempotencyKey: string }) {
    const zoneId = await this.zoneId(input.providerDomainId);
    await this.request(`/zones/${zoneId}/dns_records/${input.providerRecordId}`, { method: "DELETE", headers: { "idempotency-key": input.idempotencyKey } });
  }
}