import { Switch, Route, Redirect } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { AccessWall } from "@/components/access-wall";
import { hasSeenWelcome } from "@/pages/welcome/index";
import Welcome from "@/pages/welcome/index";
import WarRoom from "@/pages/war-room/index";
import Dashboard from "@/pages/dashboard";
import NewCampaign from "@/pages/campaigns/new";
import CampaignDetail from "@/pages/campaigns/detail";
import CampaignIntake from "@/pages/campaigns/intake";
import SequencesList from "@/pages/sequences/index";
import NewSequence from "@/pages/sequences/new";
import SequenceDetail from "@/pages/sequences/detail";
import SequenceCalendar from "@/pages/sequences/calendar";
import SequenceToday from "@/pages/sequences/today";
import SequenceCopyStudio from "@/pages/sequences/copy";
import SequenceAnalytics from "@/pages/sequences/analytics";
import SequenceContacts from "@/pages/sequences/contacts";
import Onboarding from "@/pages/onboarding";
import CampaignsList from "@/pages/campaigns/list";
import AgentsHub from "@/pages/agents/index";
import AgentChat from "@/pages/agents/chat";
import SocialPage from "@/pages/social/index";
import GroupPlannerPage from "@/pages/social/group-planner";
import SocialModerationPage from "@/pages/social/moderation";
import AgencyClientsPage from "@/pages/agency/clients";
import AgencyProfilesPage from "@/pages/agency/profiles";
import AdminPage from "@/pages/admin/index";
import AuditLogsPage from "@/pages/admin/audit-logs";
import NexosLaunchRoom from "@/pages/admin/nexos-launch";
import VslsPage from "@/pages/vsls/index";
import RevenuePage from "@/pages/revenue/index";
import ContentApproval from "@/pages/campaigns/content";
import CreativesPage from "@/pages/campaigns/creatives";
import CampaignStrategyPage from "@/pages/campaigns/strategy";
import AffiliatePage from "@/pages/affiliate/index";
import SelfProofPage from "@/pages/self-proof/index";
import CompliancePage from "@/pages/compliance/index";
import SettingsPage from "@/pages/settings";
import CreditsPage from "@/pages/credits";
import BillingPage from "@/pages/billing/index";
import MemoryPage from "@/pages/memory/index";
import PreparacaoPage from "@/pages/preparacao";
import AberturaPage from "@/pages/abertura";
import ConversaoPage from "@/pages/conversao";
import CheckoutPage from "@/pages/checkout";
import Login from "@/pages/login";
import Register from "@/pages/register";

import IntegracoesPage from "@/pages/integracoes/index";
import PipelinePage from "@/pages/pipeline/index";
import ProdutosPage from "@/pages/produtos/index";
import ComprarPage from "@/pages/comprar/index";
import VideoEditorPage from "@/pages/video-editor/index";
import SiteBuilderPage from "@/pages/site-builder/index";
import AtendimentoPage from "@/pages/atendimento/index";
import MarketIntelPage from "@/pages/market-intel/index";
import PresencePage from "@/pages/presence/index";
import CloneDigitalPage from "@/pages/clone-digital/index";
import VideoProductionPage from "@/pages/video-production/index";
import FilmingGuide from "@/pages/video-production/filming-guide";
import DirectorGuide from "@/pages/video-production/director-guide";
import LaunchRoom from "@/pages/launch-room/index";
import LauncherDashboard from "@/pages/launcher/index";
import RecordingsPage from "@/pages/recordings/index";
import LeadCapturePage from "@/pages/c/index";
import PaidMediaPage from "@/pages/paid-media/index";
import NotFound from "@/pages/not-found";
import InstitucionalPage from "@/pages/institucional/index";
import VideoDiarioPage from "@/pages/video-diario/index";
import { ErrorBoundary } from "@/components/error-boundary";

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
    </ErrorBoundary>
  );
}
