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
import AffiliatePage from "@/pages/affiliate/index";
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
import VideoProductionPage from "@/pages/video-production/index";
import LauncherDashboard from "@/pages/launcher/index";
import LeadCapturePage from "@/pages/c/index";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  if (!token) return <Redirect to="/login" />;

  // Admins always bypass the access wall
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: accessData, isLoading: accessLoading } = useQuery<{ hasAccess: boolean; reason: string }>({
    queryKey: ["/api/billing/access"],
    queryFn: () => customFetch<{ hasAccess: boolean; reason: string }>("/api/billing/access"),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!token && !isAdmin,
  });

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
  window.location.replace("/landing/");
  return null;
}

function OnboardingRoute() {
  const { token } = useAuth();
  if (!token) return <Redirect to="/login" />;
  return <AppLayout><Onboarding /></AppLayout>;
}

function WelcomeRoute() {
  const { token } = useAuth();
  if (!token) return <Redirect to="/login" />;
  // After seeing welcome, go to onboarding
  if (hasSeenWelcome()) return <Redirect to="/onboarding" />;
  return <Welcome />;
}

export default function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/welcome" component={WelcomeRoute} />
      <Route path="/onboarding" component={OnboardingRoute} />
      <Route path="/war-room/:id">
        {() => <ProtectedRoute><WarRoom /></ProtectedRoute>}
      </Route>
      <Route path="/" component={HomeRoute} />
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
      <Route path="/vsls">
        {() => <ProtectedRoute><VslsPage /></ProtectedRoute>}
      </Route>
      <Route path="/revenue">
        {() => <ProtectedRoute><RevenuePage /></ProtectedRoute>}
      </Route>
      <Route path="/affiliate">
        {() => <ProtectedRoute><AffiliatePage /></ProtectedRoute>}
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

      {/* Produção de Vídeo agente */}
      <Route path="/video-production">
        {() => <ProtectedRoute><VideoProductionPage /></ProtectedRoute>}
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

      <Route component={NotFound} />
    </Switch>
  );
}
