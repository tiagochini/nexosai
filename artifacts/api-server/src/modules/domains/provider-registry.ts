import { env } from "../../lib/env.js";
import { CloudflareDnsAdapter, HttpRegistrarAdapter, type RegistrarAdapter } from "./registrar.adapter.js";

export type ProviderMode = "automatic" | "guided" | "connect_existing";
export type ProviderCapability = "availability" | "registration" | "renewal" | "dns" | "hosting";

export type DomainProvider = {
  id: string;
  name: string;
  mode: ProviderMode;
  capabilities: ProviderCapability[];
  setupInstructions: string[];
  renewalOwner: "platform" | "customer" | "provider_account";
  configured: boolean;
};

const genericConfigured = () => Boolean(env.REGISTRAR_API_URL && env.REGISTRAR_API_KEY && env.REGISTRAR_PROVIDER);
const hostingerConfigured = () => Boolean(env.HOSTINGER_API_URL && env.HOSTINGER_API_KEY);
const cloudflareConfigured = () => Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID);

/** This catalog intentionally does not imply an unconfigured provider is usable. */
export function domainProviderCatalog(): DomainProvider[] {
  return [
    {
      id: "replit", name: "Replit", mode: "guided", capabilities: ["registration", "dns", "hosting"],
      setupInstructions: ["Compre ou conecte o domínio no painel Replit.", "Confirme o domínio e TLS no painel antes de publicar."],
      renewalOwner: "platform", configured: true,
    },
    {
      id: "cloudflare", name: "Cloudflare", mode: "automatic", capabilities: ["dns"],
      setupInstructions: ["Conecte uma API token com Zone:Read, Zone:Edit e DNS:Edit.", "O domínio deve existir em uma conta Cloudflare autorizada."],
      renewalOwner: "provider_account", configured: cloudflareConfigured(),
    },
    {
      id: "hostinger", name: "Hostinger", mode: hostingerConfigured() ? "automatic" : "guided", capabilities: ["registration", "renewal", "dns", "hosting"],
      setupInstructions: hostingerConfigured()
        ? ["A API Hostinger configurada será usada após confirmação de preço e consentimento."]
        : ["Registre ou conecte o domínio no hPanel Hostinger.", "Adicione os registros DNS indicados e confirme a verificação."],
      renewalOwner: "provider_account", configured: hostingerConfigured(),
    },
    {
      id: "generic", name: "Outro provedor", mode: genericConfigured() ? "automatic" : "connect_existing", capabilities: ["availability", "registration", "renewal", "dns"],
      setupInstructions: genericConfigured()
        ? ["A integração HTTP configurada deve devolver recibos do provedor para cada mutação."]
        : ["Conecte um domínio existente e aplique manualmente os registros DNS fornecidos."],
      renewalOwner: "customer", configured: genericConfigured(),
    },
  ];
}

export function providerById(id: string) {
  return domainProviderCatalog().find((provider) => provider.id === id);
}

/**
 * Only configured HTTP providers are adapters. Guided and connect-existing
 * choices deliberately have no mutation adapter, so they cannot claim success.
 */
export function registrarAdapterFor(providerId: string): RegistrarAdapter | null {
  if (providerId === "cloudflare" && env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
    return new CloudflareDnsAdapter(env.CLOUDFLARE_API_URL, env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID);
  }
  if (providerId === "hostinger" && hostingerConfigured()) {
    return new HttpRegistrarAdapter("hostinger", env.HOSTINGER_API_URL, env.HOSTINGER_API_KEY);
  }
  if (providerId === "generic" && genericConfigured()) {
    return new HttpRegistrarAdapter(env.REGISTRAR_PROVIDER, env.REGISTRAR_API_URL, env.REGISTRAR_API_KEY);
  }
  return null;
}

export function providerBlockReason(provider: DomainProvider | undefined, capability: ProviderCapability) {
  if (!provider) return "Provedor desconhecido";
  if (!provider.capabilities.includes(capability)) return `${provider.name} não oferece ${capability} nesta integração`;
  if (provider.mode !== "automatic") return `${provider.name} exige configuração guiada ou conexão de domínio existente`;
  if (!provider.configured) return `${provider.name} não está configurado com credenciais do provedor`;
  return null;
}