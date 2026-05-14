import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppI18nProvider } from "@/lib/i18n";
import AppRoutes from "./routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function I18nBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <AppI18nProvider locale={user?.locale ?? undefined}>{children}</AppI18nProvider>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <I18nBridge>
            <TooltipProvider>
              <AppRoutes />
              <Toaster />
            </TooltipProvider>
          </I18nBridge>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
