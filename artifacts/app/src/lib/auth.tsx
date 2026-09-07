import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react/custom-fetch";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User, Workspace } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";

// ── Synchronous module-level init — ensures token is sent even on the very
// first request before AuthProvider's useEffect has had a chance to run.
setAuthTokenGetter(() => localStorage.getItem("accessToken"));

export interface Plan {
  id: string;
  name: string;
  slug: string;
  creditsMonthly: number;
  maxCampaigns: number;
  whiteLabel: boolean;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  planId: string;
  createdAt: string;
}

export interface WorkspaceEntitlements {
  maxWorkspaces: number;
  allowedSocialNetworks: string[];
  maxAccountsPerNetwork: Record<string, number>;
}

export interface WorkspaceUsage {
  workspacesUsed: number;
  connectedAccountsByNetwork: Record<string, number>;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceDetail[];
  activeWorkspaceId: string;
  entitlements: WorkspaceEntitlements;
  usage: WorkspaceUsage;
}

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null, refreshToken?: string | null) => void;
  user: User | null;
  workspace: Workspace | null;
  plan: Plan | null;
  planSlug: string | null;
  isAdmin: boolean;
  logout: () => void;
  silentRefresh: () => Promise<boolean>;
  workspacesData: WorkspacesResponse | null;
  isWorkspacesLoading: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Token storage helpers ─────────────────────────────────────────────────────
function saveTokens(access: string, refresh?: string | null) {
  localStorage.setItem("accessToken", access);
  if (refresh) localStorage.setItem("refreshToken", refresh);
}

function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

// ── Silent refresh (module-level so custom-fetch can call it) ─────────────────
type RefreshFn = () => Promise<boolean>;
let _globalRefresh: RefreshFn | null = null;
export function setGlobalRefresh(fn: RefreshFn | null) { _globalRefresh = fn; }
export async function globalSilentRefresh(): Promise<boolean> {
  return _globalRefresh ? _globalRefresh() : false;
}

// ACCESS_TTL = 8 hours. Refresh proactively 1 hour before expiry → 7 hour interval.
const REFRESH_INTERVAL_MS = 7 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem("accessToken"),
  );
  const [, setLocation] = useLocation();
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  // ── Silent refresh implementation ─────────────────────────────────────────
  const silentRefresh = async (): Promise<boolean> => {
    const rt = localStorage.getItem("refreshToken");
    if (!rt) return false;
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
      if (!data.accessToken) return false;
      saveTokens(data.accessToken, data.refreshToken ?? rt);
      setTokenState(data.accessToken);
      return true;
    } catch {
      return false;
    }
  };

  // Register global refresh so intake / other pages can call it without prop drilling
  useEffect(() => {
    setGlobalRefresh(silentRefresh);
    return () => setGlobalRefresh(null);
  });

  // ── Auth token getter + 401 auto-retry handler ────────────────────────────
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("accessToken"));
    setUnauthorizedHandler(silentRefresh);
    return () => setUnauthorizedHandler(null);
  }, []);

  // ── Proactive refresh every 12 min while logged in ────────────────────────
  useEffect(() => {
    if (!token) return;
    refreshTimer.current = setInterval(() => { void silentRefresh(); }, REFRESH_INTERVAL_MS);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [!!token]);

  // ── setToken — call with optional refreshToken ────────────────────────────
  const setToken = (newToken: string | null, refreshToken?: string | null) => {
    if (newToken) {
      saveTokens(newToken, refreshToken);
      setTokenState(newToken);
    } else {
      clearTokens();
      setTokenState(null);
    }
  };

  const logout = () => {
    setToken(null);
    queryClient.clear();
    setLocation("/login");
  };

  const { data: meData, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    },
  });

  const { data: workspacesData, isLoading: isWorkspacesLoading } = useQuery({
    queryKey: ["/api/auth/workspaces"],
    queryFn: () => customFetch<WorkspacesResponse>("/api/auth/workspaces"),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const switchWorkspace = async (workspaceId: string) => {
    const res = await customFetch<{ accessToken: string; refreshToken: string }>(`/api/auth/workspaces/${workspaceId}/switch`, {
      method: "POST"
    });
    setToken(res.accessToken, res.refreshToken);
    // Clear user-scoped cache
    queryClient.clear();
    await queryClient.invalidateQueries();
    setLocation("/");
  };

  const createWorkspace = async (name: string) => {
    const res = await customFetch<{ workspace: WorkspaceDetail; accessToken: string; refreshToken: string }>("/api/auth/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setToken(res.accessToken, res.refreshToken);
    queryClient.clear();
    await queryClient.invalidateQueries();
    setLocation("/");
  };

  // On /me failure: try refresh once, only logout if refresh also fails
  useEffect(() => {
    if (!isError) return;
    void (async () => {
      const ok = await silentRefresh();
      if (!ok) logout();
    })();
  }, [isError]);

  const raw = meData as (typeof meData & { plan?: Plan }) | undefined;
  const plan = raw?.plan ?? null;
  const planSlug = plan?.slug ?? null;
  const ADMIN_EMAILS = new Set(["admin@nexos.ai", "founder@nexos.ai", "admin@agencianexos.vip", "founder@agencianexos.vip"]);
  const isAdmin = ADMIN_EMAILS.has(meData?.user?.email ?? "");

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
      silentRefresh,
      workspacesData: workspacesData ?? null,
      isWorkspacesLoading,
      switchWorkspace,
      createWorkspace,
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
