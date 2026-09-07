import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";

const API = "/api/market-intel";

export function useRegionalAcquisitionHealth() {
  return useQuery({
    queryKey: ["regional-intel", "health"],
    queryFn: () => customFetch<{ scheduler: any; paused: boolean }>(`${API}/acquisition/health`),
  });
}

export function useRunAcquisition() {
  return useMutation({
    mutationFn: ({ campaignId, mode }: { campaignId: string; mode: "lightweight" | "detailed" }) =>
      customFetch(`${API}/campaigns/${campaignId}/acquisition/run-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      }),
  });
}

export function useRegionalConfig(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "config", campaignId],
    queryFn: () => customFetch<{ profile: any }>(`${API}/campaigns/${campaignId}/config`),
    enabled: !!campaignId,
  });
}

export function useUpdateRegionalConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, ...data }: any) =>
      customFetch<{ profile: any }>(`${API}/campaigns/${campaignId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["regional-intel", "config", variables.campaignId], { profile: data.profile });
    },
  });
}

export function useRegionalCompetitors(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "competitors", campaignId],
    queryFn: () => customFetch<{ competitors: any[] }>(`${API}/campaigns/${campaignId}/competitors`),
    enabled: !!campaignId,
  });
}

export function useCreateCompetitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, ...data }: any) =>
      customFetch<{ competitor: any }>(`${API}/campaigns/${campaignId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["regional-intel", "competitors", variables.campaignId] });
    },
  });
}

export function useRegionalEvidence(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "evidence", campaignId],
    queryFn: () => customFetch<{ evidence: any[] }>(`${API}/campaigns/${campaignId}/evidence`),
    enabled: !!campaignId,
  });
}

export function useRegionalObservations(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "observations", campaignId],
    queryFn: () => customFetch<{ observations: any[] }>(`${API}/campaigns/${campaignId}/observations`),
    enabled: !!campaignId,
  });
}

export function useRegionalRuns(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "runs", campaignId],
    queryFn: () => customFetch<{ runs: any[] }>(`${API}/campaigns/${campaignId}/runs`),
    enabled: !!campaignId,
  });
}

export function useRegionalAlerts(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "alerts", campaignId],
    queryFn: () => customFetch<{ alerts: any[] }>(`${API}/campaigns/${campaignId}/alerts`),
    enabled: !!campaignId,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId }: { alertId: string; campaignId: string }) =>
      customFetch<{ alert: any }>(`${API}/alerts/${alertId}/acknowledge`, { method: "POST" }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["regional-intel", "alerts", variables.campaignId] });
    },
  });
}

export function useRegionalSignals(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "signals", campaignId],
    queryFn: () => customFetch<{ signals: any[] }>(`${API}/campaigns/${campaignId}/signals`),
    enabled: !!campaignId,
  });
}

export function useRegionalOpportunities(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "opportunities", campaignId],
    queryFn: () => customFetch<{ opportunities: any[] }>(`${API}/campaigns/${campaignId}/opportunities`),
    enabled: !!campaignId,
  });
}

export function useTransitionOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ opportunityId, lifecycle }: { opportunityId: string; lifecycle: string; campaignId: string }) =>
      customFetch<{ opportunity: any; activation: string }>(`${API}/opportunities/${opportunityId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecycle }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["regional-intel", "opportunities", variables.campaignId] });
    },
  });
}

export function useRegionalSegments(campaignId: string | null) {
  return useQuery({
    queryKey: ["regional-intel", "segments", campaignId],
    queryFn: () => customFetch<{ segments: any[] }>(`${API}/campaigns/${campaignId}/segments`),
    enabled: !!campaignId,
  });
}

export function useGetCampaigns() {
  return useQuery({
    queryKey: ["campaigns-lite"],
    queryFn: () => customFetch<{ campaigns: { id: string; title: string; status: string }[] }>("/api/campaigns"),
  });
}

export function useRegionalCatalog() {
  return useQuery({
    queryKey: ["regional-intel", "catalog"],
    queryFn: () => customFetch<{ packages: any[] }>(`${API}/regional/catalog`),
  });
}

export function useRegionalEntitlement() {
  return useQuery({
    queryKey: ["regional-intel", "entitlement"],
    queryFn: () => customFetch<{
      entitlement: any;
      usage: Record<string, number>;
      pendingRequest: { package: string; currency: string; createdAt: string } | null;
      nextEligibleScanAt: string | null;
    }>(`${API}/regional/entitlement`),
  });
}

export function useRequestRegionalUpgrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { package: string; currency: string; idempotencyKey: string; notes?: string }) =>
      customFetch<{ request: any }>(`${API}/regional/purchase-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regional-intel", "entitlement"] });
    },
  });
}
