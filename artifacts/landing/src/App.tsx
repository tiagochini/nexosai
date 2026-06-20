import { Switch, Route, Router as WouterRouter } from "wouter";
import MapaPage from "./pages/mapa";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import Landing from "@/pages/landing";
import GuiaPage from "@/pages/guia";
import SimulatorPage from "@/pages/simulator";
import PrivacyPolicy from "@/pages/privacy";
import TermsOfService from "@/pages/terms";
import DataDeletion from "@/pages/data-deletion";
import FounderPage from "@/pages/founder";
import HubPage from "@/pages/hub";
import PlataformaPage from "@/pages/plataforma";
import NotFound from "@/pages/not-found";
import { LangProvider } from "@/lib/i18n";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/hub" component={HubPage} />
      <Route path="/produtos" component={HubPage} />
      <Route path="/guia" component={GuiaPage} />
      <Route path="/mapa" component={MapaPage} />
      <Route path="/simulador" component={SimulatorPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/data-deletion" component={DataDeletion} />
      <Route path="/fundador" component={FounderPage} />
      <Route path="/plataforma" component={() => <PlataformaPage lang="pt-BR" />} />
      <Route path="/platform" component={() => <PlataformaPage lang="en" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster richColors />
      </LangProvider>
    </QueryClientProvider>
  );
}

export default App;
