import { Switch, Route, Redirect } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
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
import Login from "@/pages/login";
import Register from "@/pages/register";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Redirect to="/login" />;
  return <AppLayout>{children}</AppLayout>;
}

export default function AppRoutes() {
  return (
    <Switch>
      <Route path="/home" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        {() => (
          <ProtectedRoute>
            <Dashboard />
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
      <Route component={NotFound} />
    </Switch>
  );
}
