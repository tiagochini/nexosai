import { clearPrivateContextStorage } from "./private-context-storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react/custom-fetch";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User, Workspace } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { disconnectSocket, synchronizeSocketAuth } from "./socket";

// ── Synchronous module-level init — ensures token is sent even on the very
// first request before AuthProvider's useEffect has had a chance to run.
setAuthTokenGetter(() => localStorage.getItem("accessToken"));
// Remove credentials persisted by earlier versions. New refresh sessions are
// supplied only by the browser through the HttpOnly cookie.
localStorage.removeItem("refreshToken");
clearPrivateContextStorage(localStorage);

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
  selectedSubscription: {
    id: string;
    productId: string;
    productKey: string;
    productName: string;
    masterPlanKey: string;
  } | null;
}

export interface WorkspaceUsage {
  workspacesUsed: number;
  connectedAccountsByNetwork: Record<string, number>;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceDetail[];
  activeWorkspaceId: string;
  entitlements: WorkspaceEntitlements;
  workspaceCreation: {
    available: boolean;
    internalAccess: boolean;
    status: "internal_access" | "coming_soon";
  };
  usage: WorkspaceUsage;
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
  silentRefresh: () => Promise<boolean>;
  workspacesData: WorkspacesResponse | null;
  isWorkspacesLoading: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Token storage helpers ─────────────────────────────────────────────────────
function saveTokens(access: string) {
  localStorage.setItem("accessToken", access);
  localStorage.removeItem("refreshToken");
  synchronizeSocketAuth();
}

function clearTokens() {
  disconnectSocket();
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

// ── Silent refresh (module-level so custom-fetch can call it) ─────────────────
type RefreshFn = () => Promise<boolean>;
let _globalRefresh: RefreshFn | null = null;
let pendingLogout: Promise<void> | null = null;
export async function waitForPendingLogout(): Promise<void> { await pendingLogout; }
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
  const refreshInFlight = useRef<Promise<boolean> | null>(null);
  const sessionVersion = useRef(0);

  // ── Silent refresh implementation ─────────────────────────────────────────
  const silentRefresh = async (): Promise<boolean> => {
    if (!localStorage.getItem("accessToken")) return false;
    if (refreshInFlight.current) return refreshInFlight.current;
    const version = sessionVersion.current;
    const performRefresh = async () => {
      try {
        if (version !== sessionVersion.current) return false;
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken?: string };
        if (!data.accessToken || version !== sessionVersion.current) return false;
        saveTokens(data.accessToken);
        setTokenState(data.accessToken);
        return true;
      } catch { return false; }
    };
    // Serialize across tabs when Web Locks is available, as rotating a token
    // intentionally allows only one concurrent request to consume it.
    const operation = (async () => {
      if (navigator.locks) return await navigator.locks.request("nexos-session-refresh", performRefresh);
      return performRefresh();
    })();
    const pending = operation.finally(() => { refreshInFlight.current = null; });
    refreshInFlight.current = pending;
    return pending;
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

  // ── Proactive refresh while logged in ─────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    refreshTimer.current = setInterval(() => { void silentRefresh(); }, REFRESH_INTERVAL_MS);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [!!token]);

  const setToken = (newToken: string | null) => {
    clearPrivateContextStorage(localStorage);
    clearPrivateContextStorage(sessionStorage);
    void queryClient.cancelQueries();
    queryClient.clear();
    sessionVersion.current++;
    if (newToken) {
      saveTokens(newToken);
      setTokenState(newToken);
    } else {
      clearTokens();
      setTokenState(null);
    }
  };

  const logout = () => {
    const pendingRefresh = refreshInFlight.current;
    setToken(null);
    queryClient.clear();
    setLocation("/login");
    pendingLogout = (async () => {
      // Let a pending rotation finish before revoking the resulting cookie.
      if (pendingRefresh) await pendingRefresh;
      const revoke = async () => {
        await fetch("/api/auth/logout", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" }, body: "{}",
          signal: AbortSignal.timeout(10000),
        });
      };
      if (navigator.locks) await navigator.locks.request("nexos-session-refresh", revoke);
      else await revoke();
    })().catch(() => { /* Local sign-out already completed; network may be offline. */ });
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
    if (refreshInFlight.current) await refreshInFlight.current;
    const res = await customFetch<{ accessToken: string }>(`/api/auth/workspaces/${workspaceId}/switch`, {
      method: "POST"
    });
    setToken(res.accessToken);
    // Clear user-scoped cache
    queryClient.clear();
    await queryClient.invalidateQueries();
    setLocation("/");
  };

  const createWorkspace = async (name: string) => {
    if (refreshInFlight.current) await refreshInFlight.current;
    const res = await customFetch<{ workspace: WorkspaceDetail; accessToken: string }>("/api/auth/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setToken(res.accessToken);
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
  const isAdmin = meData?.isPlatformAdmin === true;

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
