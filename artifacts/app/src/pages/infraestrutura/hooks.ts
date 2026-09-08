import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";

// --- Domains ---
export type ProviderCapability = "availability" | "registration" | "renewal" | "dns" | "hosting";
export type ProviderMode = "automatic" | "guided" | "connect_existing";
export interface DomainProvider {
  id: string;
  name: string;
  mode: ProviderMode;
  capabilities: ProviderCapability[];
  setupInstructions: string[];
  renewalOwner: "platform" | "customer" | "provider_account";
  configured: boolean;
}
export interface DeploymentTarget extends DomainProvider {
  deploymentMode: ProviderMode;
}
export interface Domain {
  id: string;
  domain: string;
  type: string;
  sslStatus: string;
  lifecycleStatus: string;
  registrarProvider?: string;
  supplierPaymentUrl?: string;
  supplierPaymentReference?: string;
  supplierPaymentStatus?: string;
  expiresAt?: string;
  createdAt: string;
}

export function useGetDomains() {
  return useQuery({
    queryKey: ["/api/domains"],
    queryFn: () => customFetch<{ domains: Domain[] }>("/api/domains").then(r => r.domains),
  });
}

export function useGetDomainProviders() {
  return useQuery({
    queryKey: ["/api/domains/providers"],
    queryFn: () => customFetch<{ providers: DomainProvider[] }>("/api/domains/providers").then(r => r.providers),
  });
}

export function useGetDeploymentTargets() {
  return useQuery({
    queryKey: ["/api/domains/deployment-targets"],
    queryFn: () => customFetch<{ targets: DeploymentTarget[] }>("/api/domains/deployment-targets").then(r => r.targets),
  });
}

export function useConnectExistingDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { domain: string; provider: string; consent: true }) =>
      customFetch("/api/domains/connect-existing", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/domains"] }),
  });
}

export function useCheckDomainAvailability() {
  return useMutation({
    mutationFn: (data: { domain: string; provider: string; idempotencyKey: string }) =>
      customFetch<{ available: boolean }>("/api/domains/availability", { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useRegisterDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { domain: string; provider: string; years: number; consent: true; idempotencyKey: string }) =>
      customFetch("/api/domains/register", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/domains"] }),
  });
}

export function useReconcileSupplierPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) =>
      customFetch(`/api/domains/${domainId}/reconcile-supplier-payment`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/domains"] }),
  });
}

export function useRenewDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { domainId: string; years: number; consent: true; idempotencyKey: string }) =>
      customFetch(`/api/domains/${data.domainId}/renew`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/domains"] }),
  });
}

// --- Telegram ---
export interface TelegramSetupStep {
  id: string;
  state: "human_required" | "ready" | "pending";
  detail: string;
}
export interface TelegramSetup {
  integrationId: string;
  steps: TelegramSetupStep[];
}

export function useGetTelegramSetup(integrationId: string) {
  return useQuery({
    queryKey: [`/api/community/telegram/setup/${integrationId}`],
    queryFn: () => customFetch<TelegramSetup>(`/api/community/telegram/setup/${integrationId}`),
    enabled: !!integrationId,
  });
}

export function useCheckTelegramReadiness() {
  return useMutation({
    mutationFn: (data: { integrationId: string; webhookUrl: string }) =>
      customFetch<{ ready: boolean; bot?: any }>(`/api/community/telegram/setup/${data.integrationId}/readiness`, { method: "POST", body: JSON.stringify({ webhookUrl: data.webhookUrl }) }),
  });
}

export function useDiscoverTelegramGroup() {
  return useQuery({
    queryKey: ["/api/community/telegram/groups"],
    // Not actually implemented fully due to lack of known inputs unless initiated by user, but mapping for capability.
    queryFn: () => null,
    enabled: false,
  });
}

// --- Paid Media ---
export interface PaidMediaCapabilityStatus {
  provider: string;
  verifiedAt: string;
  oauth: "verified" | "unverified";
  advertiserAuthorization: "verified" | "unverified";
  accountSelectionRequired: boolean;
  accounts: { providerAccountId: string; name: string; environment: "test" | "production" }[];
  selectedAccountId: string | null;
  productionReady: boolean;
  capabilities: string[];
}

export function useGetPaidMediaStatus(provider: string) {
  return useQuery({
    queryKey: [`/api/paid-media/setup/${provider}/status`],
    queryFn: () => customFetch<PaidMediaCapabilityStatus>(`/api/paid-media/setup/${provider}/status`),
    retry: false,
  });
}

export function useGetPaidMediaCapabilities() {
  return useQuery({
    queryKey: ["/api/paid-media/providers/capabilities"],
    queryFn: () => customFetch<{ providers: { provider: string; capabilities: string[] }[] }>("/api/paid-media/providers/capabilities").then(r => r.providers),
  });
}

// Integrations (to get telegram integration id if any)
export function useGetWorkspaceIntegrations() {
  return useQuery({
    queryKey: ["/api/integrations"],
    queryFn: () => customFetch<{ integrations: any[] }>("/api/integrations").then(r => r.integrations),
  });
}
