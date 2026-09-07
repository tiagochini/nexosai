import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";

const API = "/api/market-intel/interactions";

export function useInteractionOpportunities() {
  return useQuery({
    queryKey: ["interaction-opportunities"],
    queryFn: () => customFetch<{ opportunities: any[] }>(`${API}/opportunities`),
  });
}

export function useInteractionOpportunity(id: string | null) {
  return useQuery({
    queryKey: ["interaction-opportunities", id],
    queryFn: () => customFetch<any>(`${API}/opportunities/${id}`),
    enabled: !!id,
  });
}

export function useGovernInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customFetch<{ gate: any }>(`${API}/opportunities/${id}/govern`, { method: "POST" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities", id] });
    },
  });
}

export function useRunInteractionCouncil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customFetch<{ gate: any, draft?: any, assessment?: any }>(`${API}/opportunities/${id}/council`, { method: "POST" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities", id] });
    },
  });
}

export function useProposeInteractionDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; content: string; ctaLevel: number; councilAssessment?: any }) =>
      customFetch<{ draft: any }>(`${API}/opportunities/${id}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities", variables.id] });
    },
  });
}

export function useDecideInteractionDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draftId, opportunityId, ...data }: { draftId: string; opportunityId: string; approved: boolean; modifiedContent?: string; reason?: string }) =>
      customFetch(`${API}/drafts/${draftId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities", variables.opportunityId] });
    },
  });
}

export function useMarkInteractionOperatorExecuted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ opportunityId, ...data }: { opportunityId: string; draftId?: string; evidence: any }) =>
      customFetch<{ execution: any }>(`${API}/opportunities/${opportunityId}/operator-executed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities", variables.opportunityId] });
    },
  });
}

export function useRecordInteractionOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, opportunityId, ...data }: { executionId: string; opportunityId: string; result: any; incident?: any }) =>
      customFetch<{ execution: any }>(`${API}/executions/${executionId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["interaction-opportunities", variables.opportunityId] });
    },
  });
}

export function useInteractionPolicy() {
  return useQuery({
    queryKey: ["interaction-policy"],
    queryFn: () => customFetch<{ policy: any }>(`${API}/policies`),
  });
}

export function useUpdateInteractionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      customFetch<{ policy: any }>(`${API}/policies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["interaction-policy"], { policy: data.policy });
    },
  });
}

export function useInteractionCapabilities() {
  return useQuery({
    queryKey: ["interaction-capabilities"],
    queryFn: () => customFetch<{ capabilities: any[] }>(`${API}/capabilities`),
  });
}

export function usePrepareRegionalAudienceInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, integrationId, action }: { id: string; integrationId: string; action: string }) =>
      customFetch<{ opportunity: any }>(`${API}/regional-audience-opportunities/${id}/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, action }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interaction-opportunities"] }),
  });
}
