/**
 * C1 — Integration credential validator
 *
 * Every manual credential (API key, token) goes through a real HTTP ping
 * against the provider's API BEFORE the record is saved to the DB.
 * "connected" status is only assigned when the ping returns a valid account.
 *
 * Providers that have no testable API endpoint (webhook receivers, complex
 * OAuth-only flows) are flagged as `validationSkipped: true` so the caller
 * can still save them but explicitly knows no live check occurred.
 */

export type ValidationResult = {
  valid: boolean;
  accountName?: string;
  accountId?: string;
  /** Human-friendly confirmation shown to user, e.g. "✓ Conta: Minha Empresa" */
  detail?: string;
  /** Human-friendly error shown to user when valid=false */
  error?: string;
  /** true when the provider has no testable endpoint — credential is accepted but unverified */
  validationSkipped?: boolean;
  /** Structured key-value rows for rich UI display — provider-specific details */
  rows?: Array<{ label: string; value: string; status?: "ok" | "warn" | "error" }>;
  /** Profile picture URL for display in UI (Instagram Business accounts) */
  profilePictureUrl?: string;
};

type Credentials = {
  accessToken?: string;
  accountId?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
};

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Individual provider validators ───────────────────────────────────────────

async function validateResend(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "API key obrigatório para Resend" };
  try {
    const res = await fetchWithTimeout("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "API key inválida — Resend retornou acesso negado (401/403)" };
    }
    if (!res.ok) {
      return { valid: false, error: `Resend retornou ${res.status} — verifique a chave` };
    }
    const body = (await res.json()) as { data?: { name: string }[] };
    const domains = body.data ?? [];
    const domainNames = domains.slice(0, 2).map(d => d.name).join(", ");
    const detail = domains.length > 0
      ? `✓ Resend: ${domains.length} domínio(s) — ${domainNames}`
      : "✓ Resend: chave válida (nenhum domínio cadastrado ainda)";
    return { valid: true, detail };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com Resend: ${msg}` };
  }
}

async function validateAsaas(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "API key obrigatório para Asaas" };
  // Try production first; fall back to sandbox on 401.
  // Production keys typically contain "_pr" (e.g. $aact_pr...).
  // Sandbox keys go to sandbox.asaas.com but cannot be reliably detected by prefix alone.
  const urls = [
    { url: "https://api.asaas.com/v3/myAccount", label: "" },
    { url: "https://sandbox.asaas.com/api/v3/myAccount", label: " (sandbox)" },
  ];
  for (const { url, label } of urls) {
    try {
      const res = await fetchWithTimeout(url, {
        headers: { access_token: creds.accessToken },
      });
      if (res.status === 401 || res.status === 403) continue; // try next
      if (!res.ok) {
        return { valid: false, error: `Asaas retornou ${res.status}` };
      }
      const body = (await res.json()) as { name?: string; id?: string; cpfCnpj?: string };
      const name = body.name ?? body.cpfCnpj ?? "Conta Asaas";
      const id = body.id ?? "";
      return {
        valid: true,
        accountName: name,
        accountId: id,
        detail: `✓ Asaas${label}: conta "${name}"`,
      };
    } catch {
      continue;
    }
  }
  return { valid: false, error: "API key inválida — Asaas retornou acesso negado (401/403) em todos os endpoints" };
}

async function validateTelegram(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "Bot token obrigatório para Telegram" };
  const token = creds.accessToken.trim();
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/getMe`, {});
    const body = (await res.json()) as { ok: boolean; result?: { first_name?: string; username?: string; id?: number }; description?: string };
    if (!body.ok) {
      return { valid: false, error: `Token inválido — Telegram: ${body.description ?? "Not Found"}` };
    }
    const name = body.result?.first_name ?? "Bot";
    const username = body.result?.username ? `@${body.result.username}` : "";
    const id = String(body.result?.id ?? "");
    return {
      valid: true,
      accountName: username || name,
      accountId: id,
      detail: `✓ Telegram Bot: ${name} ${username}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com Telegram: ${msg}` };
  }
}

async function validateStripe(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "Secret key obrigatória para Stripe" };
  const key = creds.accessToken.trim();
  try {
    const res = await fetchWithTimeout("https://api.stripe.com/v1/account", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    if (res.status === 401) {
      return { valid: false, error: "Chave Stripe inválida — acesso negado (401)" };
    }
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      return { valid: false, error: `Stripe retornou ${res.status}: ${body.error?.message ?? "erro desconhecido"}` };
    }
    const body = (await res.json()) as { id?: string; business_profile?: { name?: string }; email?: string };
    const name = body.business_profile?.name ?? body.email ?? body.id ?? "Conta Stripe";
    return {
      valid: true,
      accountName: name,
      accountId: body.id,
      detail: `✓ Stripe: "${name}" (${body.id})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com Stripe: ${msg}` };
  }
}

async function validateMailchimp(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "API key obrigatória para Mailchimp" };
  // Mailchimp API key format: <key>-<datacenter>  e.g. abc123def456-us19
  const parts = creds.accessToken.trim().split("-");
  const dc = parts[parts.length - 1];
  if (!dc || parts.length < 2) {
    return { valid: false, error: "API key Mailchimp inválida — formato esperado: <chave>-<datacenter> (ex: abc123-us1)" };
  }
  try {
    const encoded = Buffer.from(`anystring:${creds.accessToken}`).toString("base64");
    const res = await fetchWithTimeout(`https://${dc}.api.mailchimp.com/3.0/ping`, {
      headers: { Authorization: `Basic ${encoded}` },
    });
    if (res.status === 401) {
      return { valid: false, error: "API key Mailchimp inválida — acesso negado (401)" };
    }
    if (!res.ok) {
      return { valid: false, error: `Mailchimp retornou ${res.status}` };
    }
    const body = (await res.json()) as { health_status?: string };
    if (body.health_status !== "Everything's Chimpy!") {
      return { valid: false, error: `Mailchimp ping inesperado: ${JSON.stringify(body)}` };
    }
    return { valid: true, detail: `✓ Mailchimp: API key válida (datacenter: ${dc})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com Mailchimp: ${msg}` };
  }
}

async function validateHubspot(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "Access token obrigatório para HubSpot" };
  try {
    // Validate via token introspection — works for Private App tokens and OAuth tokens
    const res = await fetchWithTimeout("https://api.hubapi.com/crm/v3/owners?limit=1", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    if (res.status === 401) {
      return { valid: false, error: "Token HubSpot inválido — acesso negado (401)" };
    }
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      return { valid: false, error: `HubSpot retornou ${res.status}: ${body.message ?? "erro"}` };
    }
    const body = (await res.json()) as { results?: { firstName?: string; lastName?: string; email?: string }[] };
    const first = body.results?.[0];
    const name = first ? `${first.firstName ?? ""} ${first.lastName ?? ""}`.trim() || first.email : undefined;
    return {
      valid: true,
      accountName: name,
      detail: `✓ HubSpot: token válido${name ? ` — owner: ${name}` : ""}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com HubSpot: ${msg}` };
  }
}

async function validateActiveCampaign(creds: Credentials): Promise<ValidationResult> {
  // accountId is the subdomain (e.g. "minhaempresa" → minhaempresa.api-ac.com)
  if (!creds.accessToken) return { valid: false, error: "API key obrigatória para ActiveCampaign" };
  if (!creds.accountId) return { valid: false, error: "Account ID (subdomínio) obrigatório para ActiveCampaign" };
  const subdomain = creds.accountId.replace(/\.api-ac\.com.*/, "").replace(/^https?:\/\//, "");
  try {
    const res = await fetchWithTimeout(`https://${subdomain}.api-ac.com/api/3/account`, {
      headers: { "Api-Token": creds.accessToken },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "API key ActiveCampaign inválida — acesso negado" };
    }
    if (!res.ok) {
      return { valid: false, error: `ActiveCampaign retornou ${res.status}` };
    }
    const body = (await res.json()) as { account?: { name?: string } };
    const name = body.account?.name ?? subdomain;
    return {
      valid: true,
      accountName: name,
      accountId: subdomain,
      detail: `✓ ActiveCampaign: conta "${name}"`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com ActiveCampaign: ${msg}` };
  }
}

async function validateMercadoPago(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "Access token obrigatório para Mercado Pago" };
  try {
    const res = await fetchWithTimeout("https://api.mercadopago.com/v1/account", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    if (res.status === 401) {
      return { valid: false, error: "Token Mercado Pago inválido — acesso negado (401)" };
    }
    if (!res.ok) {
      return { valid: false, error: `Mercado Pago retornou ${res.status}` };
    }
    const body = (await res.json()) as { id?: number; nickname?: string; email?: string };
    const name = body.nickname ?? body.email ?? String(body.id ?? "Conta MP");
    return {
      valid: true,
      accountName: name,
      accountId: String(body.id ?? ""),
      detail: `✓ Mercado Pago: conta "${name}"`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com Mercado Pago: ${msg}` };
  }
}

async function validatePagarme(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "Secret key obrigatória para Pagar.me" };
  try {
    // Pagar.me v5: Basic auth with sk_xxx as username, empty password
    const encoded = Buffer.from(`${creds.accessToken}:`).toString("base64");
    const res = await fetchWithTimeout("https://api.pagar.me/core/v5/account", {
      headers: { Authorization: `Basic ${encoded}` },
    });
    if (res.status === 401) {
      return { valid: false, error: "Chave Pagar.me inválida — acesso negado (401)" };
    }
    if (!res.ok) {
      return { valid: false, error: `Pagar.me retornou ${res.status}` };
    }
    const body = (await res.json()) as { id?: string; name?: string };
    const name = body.name ?? body.id ?? "Conta Pagar.me";
    return {
      valid: true,
      accountName: name,
      accountId: body.id,
      detail: `✓ Pagar.me: conta "${name}"`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com Pagar.me: ${msg}` };
  }
}

async function validateRdStation(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "Token obrigatório para RD Station" };
  try {
    const res = await fetchWithTimeout("https://api.rd.services/platform/account", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    if (res.status === 401) {
      return { valid: false, error: "Token RD Station inválido — acesso negado (401)" };
    }
    if (!res.ok) {
      return { valid: false, error: `RD Station retornou ${res.status}` };
    }
    const body = (await res.json()) as { name?: string; uuid?: string };
    const name = body.name ?? "Conta RD Station";
    return {
      valid: true,
      accountName: name,
      accountId: body.uuid,
      detail: `✓ RD Station: conta "${name}"`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com RD Station: ${msg}` };
  }
}

async function validateMetaGraph(creds: Credentials, providerLabel: string): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: `Token obrigatório para ${providerLabel}` };
  try {
    // 1. Valida o token e pega dados do usuário
    const meRes = await fetchWithTimeout(
      `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${encodeURIComponent(creds.accessToken)}`,
      {},
    );
    if (meRes.status === 401 || meRes.status === 400) {
      const body = (await meRes.json()) as { error?: { message?: string } };
      return { valid: false, error: `Token ${providerLabel} inválido: ${body.error?.message ?? "acesso negado"}` };
    }
    if (!meRes.ok) {
      return { valid: false, error: `${providerLabel} Graph API retornou ${meRes.status}` };
    }
    const me = (await meRes.json()) as { id?: string; name?: string; error?: { message?: string } };
    if (me.error) {
      return { valid: false, error: `Token ${providerLabel} inválido: ${me.error.message}` };
    }

    const rows: ValidationResult["rows"] = [];
    rows.push({ label: "Usuário", value: `${me.name ?? "—"} (ID: ${me.id ?? "—"})`, status: "ok" });

    // 2. Busca Páginas gerenciadas + Instagram Business Account vinculado
    let pageInfo: string | null = null;
    let igAccountId: string | null = null;
    try {
      const pagesRes = await fetchWithTimeout(
        `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(creds.accessToken)}`,
        {},
      );
      if (pagesRes.ok) {
        const pagesData = (await pagesRes.json()) as {
          data?: Array<{ id: string; name: string; instagram_business_account?: { id: string } }>;
        };
        const pages = pagesData.data ?? [];
        if (pages.length > 0) {
          const pageWithIg = pages.find(p => p.instagram_business_account) ?? pages[0];
          pageInfo = `${pageWithIg.name} (ID: ${pageWithIg.id})`;
          igAccountId = pageWithIg.instagram_business_account?.id ?? null;
          rows.push({ label: "Página Facebook", value: pageInfo, status: "ok" });
          if (igAccountId) {
            rows.push({ label: "Instagram Business", value: `ID: ${igAccountId}`, status: "ok" });

            // Fetch IG Business profile details (username, picture, followers)
            try {
              const igProfileRes = await fetchWithTimeout(
                `https://graph.facebook.com/v20.0/${igAccountId}?fields=username,profile_picture_url,followers_count,media_count&access_token=${encodeURIComponent(creds.accessToken ?? "")}`,
                {},
              );
              if (igProfileRes.ok) {
                const igProfile = (await igProfileRes.json()) as {
                  username?: string;
                  profile_picture_url?: string;
                  followers_count?: number;
                  media_count?: number;
                };
                if (igProfile.username) rows.push({ label: "Username", value: `@${igProfile.username}`, status: "ok" });
                if (igProfile.followers_count !== undefined) rows.push({ label: "Seguidores", value: igProfile.followers_count.toLocaleString("pt-BR"), status: "ok" });
                if (igProfile.media_count !== undefined) rows.push({ label: "Posts publicados", value: igProfile.media_count.toString(), status: "ok" });
                if (igProfile.profile_picture_url) {
                  // Store URL for frontend image display — not shown as plain text row
                  // We include it in a special row so the frontend can detect it
                  rows.push({ label: "__profilePictureUrl", value: igProfile.profile_picture_url, status: "ok" });
                }
              }
            } catch {
              // Non-critical — profile details are optional
            }
          } else {
            rows.push({ label: "Instagram Business", value: "Nenhuma conta IG vinculada à Página", status: "warn" });
          }
          if (pages.length > 1) {
            rows.push({ label: "Outras Páginas", value: `${pages.length - 1} página(s) adicional(is) encontrada(s)`, status: "ok" });
          }
        } else {
          rows.push({ label: "Páginas Facebook", value: "Nenhuma Página gerenciada encontrada — verifique as permissões do token", status: "warn" });
        }
      }
    } catch {
      rows.push({ label: "Páginas Facebook", value: "Não foi possível verificar (escopo pode estar limitado)", status: "warn" });
    }

    // 3. Debug do token — permissões e expiração
    try {
      const debugRes = await fetchWithTimeout(
        `https://graph.facebook.com/v20.0/debug_token?input_token=${encodeURIComponent(creds.accessToken)}&access_token=${encodeURIComponent(creds.accessToken)}`,
        {},
      );
      if (debugRes.ok) {
        const debug = (await debugRes.json()) as {
          data?: {
            expires_at?: number;
            scopes?: string[];
            is_valid?: boolean;
            app_id?: string;
          };
        };
        const d = debug.data;
        if (d) {
          // Expiração
          if (d.expires_at && d.expires_at > 0) {
            const expiresDate = new Date(d.expires_at * 1000);
            const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / 86_400_000);
            const expLabel = daysLeft > 0
              ? `${expiresDate.toLocaleDateString("pt-BR")} (${daysLeft} dias restantes)`
              : `EXPIRADO em ${expiresDate.toLocaleDateString("pt-BR")}`;
            rows.push({ label: "Expira em", value: expLabel, status: daysLeft > 14 ? "ok" : daysLeft > 0 ? "warn" : "error" });
          } else {
            rows.push({ label: "Expira em", value: "Token de longa duração (sem expiração definida)", status: "ok" });
          }

          // Permissões
          const scopes = d.scopes ?? [];
          const keyPerms = ["instagram_basic", "instagram_content_publish", "pages_manage_posts", "pages_show_list"];
          const granted = keyPerms.filter(p => scopes.includes(p));
          const missing = keyPerms.filter(p => !scopes.includes(p));
          if (granted.length > 0) {
            rows.push({ label: "Permissões OK", value: granted.join(", "), status: "ok" });
          }
          if (missing.length > 0) {
            rows.push({ label: "Permissões faltando", value: missing.join(", "), status: "warn" });
          }
        }
      }
    } catch {
      // debug_token falhou silenciosamente — não crítico
    }

    // Prefer Instagram @username (from IG profile row) over the Facebook user/page name
    const igUsernameRow = rows.find(r => r.label === "Username");
    const igDisplayName = igUsernameRow?.value; // e.g. "@agencianexosai"
    const fbName = me.name ?? me.id ?? "Conta Meta";
    const name = igDisplayName ?? fbName;

    const detailLine = pageInfo
      ? `✓ ${providerLabel}: ${name} — Página: ${pageInfo}${igAccountId ? ` — IG: ${igAccountId}` : ""}`
      : `✓ ${providerLabel}: conta "${fbName}" (ID: ${me.id})`;

    return {
      valid: true,
      accountName: name,
      accountId: me.id,
      detail: detailLine,
      rows,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com ${providerLabel}: ${msg}` };
  }
}

async function validateWhatsApp(creds: Credentials): Promise<ValidationResult> {
  if (!creds.accessToken) return { valid: false, error: "Access token obrigatório para WhatsApp Business" };
  if (!creds.accountId) return { valid: false, error: "Phone Number ID (accountId) obrigatório para WhatsApp Business" };
  try {
    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v20.0/${creds.accountId}?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(creds.accessToken)}`,
      {},
    );
    if (res.status === 400 || res.status === 401) {
      const body = (await res.json()) as { error?: { message?: string } };
      return { valid: false, error: `Token WhatsApp inválido: ${body.error?.message ?? "acesso negado"}` };
    }
    if (!res.ok) {
      return { valid: false, error: `WhatsApp Business API retornou ${res.status}` };
    }
    const body = (await res.json()) as { id?: string; display_phone_number?: string; verified_name?: string; error?: { message?: string } };
    if (body.error) {
      return { valid: false, error: `WhatsApp Business: ${body.error.message}` };
    }
    const name = body.verified_name ?? body.display_phone_number ?? body.id ?? "Número WhatsApp";
    return {
      valid: true,
      accountName: name,
      accountId: body.id,
      detail: `✓ WhatsApp Business: "${name}" (${body.display_phone_number ?? body.id})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Erro ao conectar com WhatsApp Business: ${msg}` };
  }
}

// ── Providers where validation is skipped (webhook receivers / complex OAuth) ─

const SKIP_VALIDATION_REASONS: Partial<Record<string, string>> = {
  hotmart: "Hotmart usa webhooks de entrada — não há endpoint de validação de chave disponível",
  eduzz: "Eduzz usa webhooks de entrada — não há endpoint de validação de chave disponível",
  kiwify: "Kiwify usa webhooks de entrada — não há endpoint de validação de chave disponível",
  paypal: "PayPal usa OAuth client_id/secret — validação exige troca de token server-to-server",
  tiktok_ads: "TikTok Ads usa OAuth — token gerado via fluxo OAuth foi aceito pela plataforma",
  google_ads: "Google Ads usa OAuth — token gerado via fluxo OAuth foi aceito pela plataforma",
  linkedin_ads: "LinkedIn Ads usa OAuth — token gerado via fluxo OAuth foi aceito pela plataforma",
  crypto_native: "Integração nativa — sem endpoint de validação externo",
  custom_webhook: "Webhook customizado — não é possível validar URL de entrada",
};

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function testIntegrationCredential(
  provider: string,
  credentials: Credentials,
): Promise<ValidationResult> {
  switch (provider) {
    case "resend":
      return validateResend(credentials);
    case "asaas":
      return validateAsaas(credentials);
    case "telegram":
      return validateTelegram(credentials);
    case "stripe":
      return validateStripe(credentials);
    case "mailchimp":
      return validateMailchimp(credentials);
    case "hubspot":
      return validateHubspot(credentials);
    case "activecampaign":
      return validateActiveCampaign(credentials);
    case "mercado_pago":
      return validateMercadoPago(credentials);
    case "pagarme":
      return validatePagarme(credentials);
    case "rd_station":
      return validateRdStation(credentials);
    case "meta_ads":
      return validateMetaGraph(credentials, "Meta Ads");
    case "instagram":
      return validateMetaGraph(credentials, "Instagram");
    case "facebook":
      return validateMetaGraph(credentials, "Facebook");
    case "whatsapp_business":
      return validateWhatsApp(credentials);

    // Skip-validation providers
    case "hotmart":
    case "eduzz":
    case "kiwify":
    case "paypal":
    case "tiktok_ads":
    case "tiktok":
    case "google_ads":
    case "linkedin_ads":
    case "crypto_native":
    case "custom_webhook": {
      const reason = SKIP_VALIDATION_REASONS[provider] ?? "Sem endpoint de validação disponível para este provedor";
      return {
        valid: true,
        validationSkipped: true,
        detail: `⚠️ Validação automática não disponível: ${reason}. Credencial salva — verifique manualmente se está correta.`,
      };
    }

    default:
      return {
        valid: true,
        validationSkipped: true,
        detail: `⚠️ Provedor "${provider}" sem validação automática configurada. Credencial aceita sem verificação.`,
      };
  }
}
