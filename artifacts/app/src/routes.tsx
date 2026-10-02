import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { AccessWall } from "@/components/access-wall";
import { hasSeenWelcome } from "@/pages/welcome/index";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";
import InstitucionalPage from "@/pages/institucional/index";
import { ErrorBoundary } from "@/components/error-boundary";

const Welcome = lazy(() => import("@/pages/welcome/index"));
const WarRoom = lazy(() => import("@/pages/war-room/index"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const NewCampaign = lazy(() => import("@/pages/campaigns/new"));
const CampaignDetail = lazy(() => import("@/pages/campaigns/detail"));
const CampaignIntake = lazy(() => import("@/pages/campaigns/intake"));
const ControlRoom = lazy(() => import("@/pages/campaigns/control-room"));
const SequencesList = lazy(() => import("@/pages/sequences/index"));
const NewSequence = lazy(() => import("@/pages/sequences/new"));
const SequenceDetail = lazy(() => import("@/pages/sequences/detail"));
const SequenceCalendar = lazy(() => import("@/pages/sequences/calendar"));
const SequenceToday = lazy(() => import("@/pages/sequences/today"));
const SequenceCopyStudio = lazy(() => import("@/pages/sequences/copy"));
const SequenceAnalytics = lazy(() => import("@/pages/sequences/analytics"));
const SequenceContacts = lazy(() => import("@/pages/sequences/contacts"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const CampaignsList = lazy(() => import("@/pages/campaigns/list"));
const AgentsHub = lazy(() => import("@/pages/agents/index"));
const AgentChat = lazy(() => import("@/pages/agents/chat"));
const SocialPage = lazy(() => import("@/pages/social/index"));
const GroupPlannerPage = lazy(() => import("@/pages/social/group-planner"));
const SocialModerationPage = lazy(() => import("@/pages/social/moderation"));
const AgencyClientsPage = lazy(() => import("@/pages/agency/clients"));
const AgencyProfilesPage = lazy(() => import("@/pages/agency/profiles"));
const AdminPage = lazy(() => import("@/pages/admin/index"));
const AuditLogsPage = lazy(() => import("@/pages/admin/audit-logs"));
const OperationsPage = lazy(() => import("@/pages/admin/operations"));
const NexosLaunchRoom = lazy(() => import("@/pages/admin/nexos-launch"));
const VslsPage = lazy(() => import("@/pages/vsls/index"));
const RevenuePage = lazy(() => import("@/pages/revenue/index"));
const ContentApproval = lazy(() => import("@/pages/campaigns/content"));
const CreativesPage = lazy(() => import("@/pages/campaigns/creatives"));
const CampaignStrategyPage = lazy(() => import("@/pages/campaigns/strategy"));
const AffiliatePage = lazy(() => import("@/pages/affiliate/index"));
const SelfProofPage = lazy(() => import("@/pages/self-proof/index"));
const CompliancePage = lazy(() => import("@/pages/compliance/index"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const CreditsPage = lazy(() => import("@/pages/credits"));
const BillingPage = lazy(() => import("@/pages/billing/index"));
const MemoryPage = lazy(() => import("@/pages/memory/index"));
const PreparacaoPage = lazy(() => import("@/pages/preparacao"));
const AberturaPage = lazy(() => import("@/pages/abertura"));
const ConversaoPage = lazy(() => import("@/pages/conversao"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const IntegracoesPage = lazy(() => import("@/pages/integracoes/index"));
const PipelinePage = lazy(() => import("@/pages/pipeline/index"));
const ProdutosPage = lazy(() => import("@/pages/produtos/index"));
const ComprarPage = lazy(() => import("@/pages/comprar/index"));
const VideoEditorPage = lazy(() => import("@/pages/video-editor/index"));
const SiteBuilderPage = lazy(() => import("@/pages/site-builder/index"));
const AtendimentoPage = lazy(() => import("@/pages/atendimento/index"));
const MarketIntelPage = lazy(() => import("@/pages/market-intel/index"));
const PresencePage = lazy(() => import("@/pages/presence/index"));
const IntakeHub = lazy(() => import("@/pages/intake/index"));
const CloneDigitalPage = lazy(() => import("@/pages/clone-digital/index"));
const VideoProductionPage = lazy(() => import("@/pages/video-production/index"));
const FilmingGuide = lazy(() => import("@/pages/video-production/filming-guide"));
const DirectorGuide = lazy(() => import("@/pages/video-production/director-guide"));
const LaunchRoom = lazy(() => import("@/pages/launch-room/index"));
const LauncherDashboard = lazy(() => import("@/pages/launcher/index"));
const RecordingsPage = lazy(() => import("@/pages/recordings/index"));
const LeadCapturePage = lazy(() => import("@/pages/c/index"));
const PaidMediaPage = lazy(() => import("@/pages/paid-media/index"));
const InfraestruturaPage = lazy(() => import("@/pages/infraestrutura/index"));
const LifecyclePage = lazy(() => import("@/pages/lifecycle/index"));
const VideoDiarioPage = lazy(() => import("@/pages/video-diario/index"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // All hooks must be called unconditionally — no early returns before this
  const { data: accessData, isLoading: accessLoading } = useQuery<{ hasAccess: boolean; reason: string }>({
    queryKey: ["/api/billing/access"],
    queryFn: () => customFetch<{ hasAccess: boolean; reason: string }>("/api/billing/access"),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!token && !isAdmin,
  });

  if (!token) return <Redirect to="/login" />;
  if (isAdmin) return <AppLayout>{children}</AppLayout>;
  if (accessLoading && !accessData) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (accessData && !accessData.hasAccess) {
    return <AccessWall onAccessGranted={() => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/access"] });
    }} />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function VideoEditorProtected() {
  const { token } = useAuth();
  if (!token) return <Redirect to="/login" />;
  return <VideoEditorPage />;
}

function HomeRoute() {
  const { token } = useAuth();
  if (token) return <AppLayout><Dashboard /></AppLayout>;
  return <InstitucionalPage />;
}

function DashboardRoute() {
  const { token } = useAuth();
  if (token) return <AppLayout><Dashboard /></AppLayout>;
  return <Redirect to="/login" />;
}

function OnboardingRoute() {
  const { token } = useAuth();
  if (!token) return <Redirect to="/login" />;
  return <AppLayout><Onboarding /></AppLayout>;
}

function WelcomeRoute() {
  const { token, user } = useAuth();
  if (!token) return <Redirect to="/login" />;
  // After seeing welcome, go to onboarding. DB flag is the source of truth;
  // localStorage avoids a flash while /me is still loading right after signup.
  if (user?.hasSeenOnboarding || hasSeenWelcome()) return <Redirect to="/onboarding" />;
  return <Welcome />;
}

export default function AppRoutes() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/welcome" component={WelcomeRoute} />
      <Route path="/onboarding" component={OnboardingRoute} />
      <Route path="/war-room/:id">
        {() => <ProtectedRoute><WarRoom /></ProtectedRoute>}
      </Route>
      <Route path="/" component={HomeRoute} />
      <Route path="/dashboard" component={DashboardRoute} />
      <Route path="/campaigns">
        {() => (
          <ProtectedRoute>
            <CampaignsList />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/campaigns/new">
        {() => (
          <ProtectedRoute>
            <NewCampaign />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/campaigns/:id/intake">
        {() => (
          <ProtectedRoute>
            <CampaignIntake />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/campaigns/:id/content">
        {() => <ProtectedRoute><ContentApproval /></ProtectedRoute>}
      </Route>
      <Route path="/campaigns/:id/creatives">
        {() => <ProtectedRoute><CreativesPage /></ProtectedRoute>}
      </Route>
      <Route path="/campaigns/:id/strategy">
        {() => <ProtectedRoute><CampaignStrategyPage /></ProtectedRoute>}
      </Route>
      <Route path="/campaigns/:id/control-room">
        {() => (
          <ProtectedRoute>
            <ControlRoom />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/campaigns/:id">
        {() => (
          <ProtectedRoute>
            <CampaignDetail />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sequences/new">
        {() => (
          <ProtectedRoute>
            <NewSequence />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sequences/:id/calendar">
        {() => (
          <ProtectedRoute>
            <SequenceCalendar />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sequences/:id/today">
        {() => (
          <ProtectedRoute>
            <SequenceToday />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sequences/:id/copy">
        {() => (
          <ProtectedRoute>
            <SequenceCopyStudio />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sequences/:id/analytics">
        {() => (
          <ProtectedRoute>
            <SequenceAnalytics />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sequences/:id/contacts">
        {() => (
          <ProtectedRoute>
            <SequenceContacts />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sequences/:id">
        {() => (
          <ProtectedRoute>
            <SequenceDetail />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sequences">
        {() => (
          <ProtectedRoute>
            <SequencesList />
          </ProtectedRoute>
        )}
      </Route>

      {/* Agent Hub */}
      <Route path="/agents/:role">
        {() => <ProtectedRoute><AgentChat /></ProtectedRoute>}
      </Route>
      <Route path="/agents">
        {() => <ProtectedRoute><AgentsHub /></ProtectedRoute>}
      </Route>

      {/* New modules */}
      <Route path="/agency/clients">
        {() => <ProtectedRoute><AgencyClientsPage /></ProtectedRoute>}
      </Route>
      <Route path="/agency/profiles">
        {() => <ProtectedRoute><AgencyProfilesPage /></ProtectedRoute>}
      </Route>
      <Route path="/admin/audit-logs">
        {() => <ProtectedRoute><AuditLogsPage /></ProtectedRoute>}
      </Route>
      <Route path="/admin/operations">
        {() => <ProtectedRoute><OperationsPage /></ProtectedRoute>}
      </Route>
      <Route path="/admin/nexos-launch">
        {() => <ProtectedRoute><NexosLaunchRoom /></ProtectedRoute>}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute><AdminPage /></ProtectedRoute>}
      </Route>
      <Route path="/social/moderation">
        {() => <ProtectedRoute><SocialModerationPage /></ProtectedRoute>}
      </Route>
      <Route path="/social/groups/:id">
        {() => <ProtectedRoute><GroupPlannerPage /></ProtectedRoute>}
      </Route>
      <Route path="/social">
        {() => <ProtectedRoute><SocialPage /></ProtectedRoute>}
      </Route>
      <Route path="/paid-media">
        {() => <ProtectedRoute><PaidMediaPage /></ProtectedRoute>}
      </Route>
      <Route path="/vsls">
        {() => <ProtectedRoute><VslsPage /></ProtectedRoute>}
      </Route>
      <Route path="/revenue">
        {() => <ProtectedRoute><RevenuePage /></ProtectedRoute>}
      </Route>
      <Route path="/lifecycle">
        {() => <ProtectedRoute><LifecyclePage /></ProtectedRoute>}
      </Route>
      <Route path="/affiliate">
        {() => <ProtectedRoute><AffiliatePage /></ProtectedRoute>}
      </Route>
      <Route path="/self-proof">
        {() => <ProtectedRoute><SelfProofPage /></ProtectedRoute>}
      </Route>
      <Route path="/compliance">
        {() => <ProtectedRoute><CompliancePage /></ProtectedRoute>}
      </Route>

      {/* Integrações */}
      <Route path="/integracoes">
        {() => <ProtectedRoute><IntegracoesPage /></ProtectedRoute>}
      </Route>

      <Route path="/infraestrutura">
        {() => <ProtectedRoute><InfraestruturaPage /></ProtectedRoute>}
      </Route>

      {/* Pipeline Regional */}
      <Route path="/pipeline">
        {() => <ProtectedRoute><PipelinePage /></ProtectedRoute>}
      </Route>

      {/* Editor de Vídeo (full-screen, sem sidebar) */}
      <Route path="/video-editor">
        {() => <VideoEditorProtected />}
      </Route>

      {/* Construtor de Sites agente */}
      <Route path="/site-builder">
        {() => <ProtectedRoute><SiteBuilderPage /></ProtectedRoute>}
      </Route>

      {/* Time de Vendas / Atendimento */}
      <Route path="/atendimento">
        {() => <ProtectedRoute><AtendimentoPage /></ProtectedRoute>}
      </Route>

      <Route path="/market-intel">
        {() => <ProtectedRoute><MarketIntelPage /></ProtectedRoute>}
      </Route>

      {/* Presença Social Always-On */}
      <Route path="/presence">
        {() => <ProtectedRoute><PresencePage /></ProtectedRoute>}
      </Route>

      <Route path="/intake/:productId?">
        {() => <ProtectedRoute><IntakeHub /></ProtectedRoute>}
      </Route>

      {/* Produção de Vídeo agente */}
      <Route path="/video-production/filming-guide">
        {() => <ProtectedRoute><FilmingGuide /></ProtectedRoute>}
      </Route>
      <Route path="/video-production/director-guide">
        {() => <ProtectedRoute><DirectorGuide /></ProtectedRoute>}
      </Route>
      <Route path="/video-production">
        {() => <ProtectedRoute><VideoProductionPage /></ProtectedRoute>}
      </Route>

      {/* Gravações */}
      <Route path="/recordings">
        {() => <ProtectedRoute><RecordingsPage /></ProtectedRoute>}
      </Route>

      {/* Vídeo Diário */}
      <Route path="/video-diario">
        {() => <ProtectedRoute><VideoDiarioPage /></ProtectedRoute>}
      </Route>

      {/* Sala de Lançamento */}
      <Route path="/launch-room/:id">
        {() => <ProtectedRoute><LaunchRoom /></ProtectedRoute>}
      </Route>
      <Route path="/launch-room">
        {() => <ProtectedRoute><LaunchRoom /></ProtectedRoute>}
      </Route>

      {/* Dashboard do Lançador */}
      <Route path="/launcher">
        {() => <ProtectedRoute><LauncherDashboard /></ProtectedRoute>}
      </Route>

      {/* Account */}
      <Route path="/configuracoes">
        {() => <Redirect to="/settings" />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute><SettingsPage /></ProtectedRoute>}
      </Route>
      <Route path="/clone-digital">
        {() => <ProtectedRoute><CloneDigitalPage /></ProtectedRoute>}
      </Route>
      <Route path="/credits">
        {() => <ProtectedRoute><CreditsPage /></ProtectedRoute>}
      </Route>
      <Route path="/billing">
        {() => <ProtectedRoute><BillingPage /></ProtectedRoute>}
      </Route>
      <Route path="/memory">
        {() => <ProtectedRoute><MemoryPage /></ProtectedRoute>}
      </Route>
      {/* Produtos (workspace owner) */}
      <Route path="/produtos">
        {() => <ProtectedRoute><ProdutosPage /></ProtectedRoute>}
      </Route>

      {/* Comprar — página pública de checkout de produto */}
      {/* Página pública de captura de leads com chat agente */}
      <Route path="/c/:sequenceId" component={LeadCapturePage} />
      <Route path="/comprar/:productId" component={ComprarPage} />
      <Route path="/preparacao" component={PreparacaoPage} />
      <Route path="/abertura" component={AberturaPage} />
      <Route path="/conversao" component={ConversaoPage} />
      <Route path="/comprar" component={CheckoutPage} />
      <Route path="/checkout" component={CheckoutPage} />

      {/* Public landing page redirects — users may link directly to agencianexos.vip/mapa etc. */}
      <Route path="/mapa">{() => { window.location.replace("/landing/mapa"); return null; }}</Route>
      <Route path="/guia">{() => { window.location.replace("/landing/guia"); return null; }}</Route>
      <Route path="/simulador">{() => { window.location.replace("/landing/simulador"); return null; }}</Route>
      <Route path="/hub">{() => { window.location.replace("/landing/hub"); return null; }}</Route>
      <Route path="/fundador">{() => { window.location.replace("/landing/fundador"); return null; }}</Route>
      <Route path="/privacy">{() => { window.location.replace("/landing/privacy"); return null; }}</Route>
      <Route path="/privacy-policy">{() => { window.location.replace("/landing/privacy-policy"); return null; }}</Route>
      <Route path="/terms">{() => { window.location.replace("/landing/terms"); return null; }}</Route>
      <Route path="/terms-of-service">{() => { window.location.replace("/landing/terms-of-service"); return null; }}</Route>
      <Route path="/data-deletion">{() => { window.location.replace("/landing/data-deletion"); return null; }}</Route>

      <Route component={NotFound} />
    </Switch>
    </Suspense>
    </ErrorBoundary>
  );
}
