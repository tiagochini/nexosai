import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, FileDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { getGetCampaignQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { downloadCampaignMasterplanPdf } from "./strategy-masterplan";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";

type CampaignResponse = {
  campaign?: {
    id?: string;
    title?: string;
    status?: string;
    timelineData?: Record<string, unknown>;
    strategyData?: Record<string, unknown>;
    intakeData?: Record<string, unknown>;
    brainData?: Record<string, unknown>;
  };
};
type MasterplanResponse = {
  masterplan?: { status?: string } | null;
  moduleReviews?: Record<string, string>;
};

export default function CampaignPlanReady() {
  const t = useUiText();
  const [, params] = useRoute("/campaigns/:id/plan-ready");
  const campaignId = params?.id ?? "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, workspace } = useAuth();

  const campaignQuery = useQuery({
    queryKey: getGetCampaignQueryKey(campaignId),
    queryFn: () => customFetch<CampaignResponse>(`/api/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    staleTime: 0,
  });
  const masterplanQuery = useQuery<MasterplanResponse>({
    queryKey: ["/api/campaigns", campaignId, "masterplan", "current"],
    queryFn: () => customFetch(`/api/campaigns/${campaignId}/masterplan/current`),
    enabled: Boolean(campaignId && campaignQuery.data),
    retry: false,
  });
  const onboardingQuery = useQuery<{ trialAccess?: boolean }>({
    queryKey: ["/api/onboarding/status"],
    queryFn: () => customFetch("/api/onboarding/status"),
    staleTime: 60000,
  });
  const campaign = campaignQuery.data?.campaign;
  const moduleReviews = masterplanQuery.data?.moduleReviews ?? {};
  const reviewsComplete = Object.values(moduleReviews).filter((status) => status === "approved").length >= 10;
  const planApproved = masterplanQuery.data?.masterplan?.status === "approved"
    || (onboardingQuery.data?.trialAccess === true && reviewsComplete);
  const downloadPdf = () => {
    if (!campaign || !user) {
      toast.error(t("Não foi possível identificar o usuário para gerar o PDF.", "Could not identify the user to generate the PDF.", "No se pudo identificar al usuario para generar el PDF."));
      return;
    }
    const intake = campaign.intakeData ?? {};
    const brainData = campaign.brainData ?? {};
    downloadCampaignMasterplanPdf({
      strategyD: campaign.strategyData ?? {},
      campaignId,
      campaignTitle: String(intake["product.name"] ?? campaign.title ?? t("Masterplan Estratégico", "Strategic master plan", "Plan maestro estratégico")),
      track: String(intake["launch.track"] ?? ""),
      marketValidation: (brainData["marketValidation"] ?? null) as Record<string, unknown> | null,
      userIdentity: {
        name: user.name ?? "",
        email: user.email ?? "",
        userId: user.id,
        workspaceName: workspace?.name ?? "",
        workspaceId: workspace?.id ?? "",
      },
    });
  };
  const storedPreview = campaign?.timelineData?.["schedulePreview"];
  const scheduleAlreadyOpened = Boolean(
    storedPreview && typeof storedPreview === "object" && (storedPreview as Record<string, unknown>)["sourceVersion"] === 3,
  );

  useEffect(() => {
    if (!campaign || campaignQuery.isLoading || masterplanQuery.isLoading || onboardingQuery.isLoading) return;
    if (campaign.status === "draft" || campaign.status === "intake") {
      setLocation(`/campaigns/${campaignId}/intake`);
    } else if (campaign.status === "analyzing") {
      setLocation(`/campaigns/${campaignId}/strategy`);
    } else if (campaign.status !== "strategy_ready") {
      setLocation(`/campaigns/${campaignId}`);
    } else if (!planApproved) {
      setLocation(`/campaigns/${campaignId}/strategy`);
    } else if (scheduleAlreadyOpened) {
      setLocation(`/campaigns/${campaignId}`);
    }
  }, [campaign, campaignId, campaignQuery.isLoading, masterplanQuery.isLoading, onboardingQuery.isLoading, planApproved, scheduleAlreadyOpened, setLocation]);

  const continueMutation = useMutation({
    mutationFn: () => customFetch(`/api/campaigns/${campaignId}/schedule-preview/generate`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      setLocation(`/campaigns/${campaignId}`);
    },
    onError: (error: any) => toast.error(error?.data?.error || error?.message || t(
      "Não foi possível preparar o cronograma. Tente novamente.",
      "Could not prepare the schedule. Please try again.",
      "No se pudo preparar el cronograma. Inténtalo de nuevo.",
    )),
  });

  if (campaignQuery.isLoading || masterplanQuery.isLoading || onboardingQuery.isLoading || !campaign || !planApproved) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-3xl items-center px-4 py-12">
      <section className="w-full space-y-6 border border-cyan-300/25 bg-cyan-300/[0.035] p-6 sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center border border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-300">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">{t("Plano aprovado", "Plan approved", "Plan aprobado")}</p>
          <h1 className="font-mono text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
            {t("Parabéns! Sua consultoria está pronta.", "Congratulations! Your consultation is ready.", "¡Felicidades! Tu consultoría está lista.")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("Veja todos os detalhes do seu plano de negócio em PDF ou continue para organizar as próximas etapas da campanha.", "Review every detail of your business plan in the PDF, or continue to organize the next campaign steps.", "Consulta todos los detalles de tu plan de negocio en PDF o continúa para organizar las próximas etapas de la campaña.")}
          </p>
        </div>
        {campaign.title && <p className="border-y border-border/40 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">{campaign.title}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={downloadPdf} className="h-11 gap-2 rounded-none font-mono text-[10px] font-bold uppercase tracking-wider">
            <FileDown className="h-4 w-4" />{t("Baixar PDF do plano", "Download plan PDF", "Descargar PDF del plan")}
          </Button>
          <Button type="button" onClick={() => continueMutation.mutate()} disabled={continueMutation.isPending} className="h-11 gap-2 rounded-none font-mono text-[10px] font-bold uppercase tracking-wider btn-weapon-primary">
            {continueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /><ArrowRight className="h-4 w-4" /></>}
            {continueMutation.isPending ? t("Preparando cronograma…", "Preparing schedule…", "Preparando cronograma…") : t("Continuar para o cronograma", "Continue to schedule", "Continuar al cronograma")}
          </Button>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/60">
          {t("O cronograma será salvo nesta campanha. Você poderá voltar ao plano e ao PDF depois.", "The schedule will be saved to this campaign. You can return to the plan and PDF later.", "El cronograma se guardará en esta campaña. Podrás volver al plan y al PDF más adelante.")}
        </p>
      </section>
    </main>
  );
}
