import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react/custom-fetch";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User, Workspace } from "@workspace/api-client-react";

interface Plan {
  id: string;
  name: string;
  slug: string;
  creditsMonthly: number;
  maxCampaigns: number;
  whiteLabel: boolean;
}

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  user: User | null;
  workspace: Workspace | null;
  plan: Plan | null;
  planSlug: string | null;
  isAdmin: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("accessToken"));
  const [, setLocation] = useLocation();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("accessToken"));
  }, []);

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("accessToken", newToken);
      setTokenState(newToken);
    } else {
      localStorage.removeItem("accessToken");
      setTokenState(null);
    }
  };

  const logout = () => {
    setToken(null);
    setLocation("/login");
  };

  const { data: meData, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (isError) logout();
  }, [isError]);

  // The real API returns { user, workspace, plan } even though the generated
  // type only declares { user, workspace }. Safe to cast here.
  const raw = meData as (typeof meData & { plan?: Plan }) | undefined;
  const plan = raw?.plan ?? null;
  const planSlug = plan?.slug ?? null;
  const isAdmin = (meData?.user?.email ?? "") === "admin@nexos.ai";

  return (
    <AuthContext.Provider value={{
      token,
      setToken,
      user: meData?.user ?? null,
      workspace: meData?.workspace ?? null,
      plan,
      planSlug,
      isAdmin,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
