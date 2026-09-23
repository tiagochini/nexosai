import { useState, type ReactNode } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { 
  ArrowLeft, Activity, ShieldCheck, Database, 
  Layers, Clock, CheckCircle2, AlertTriangle, 
  Terminal, RefreshCw, XCircle, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface ControlRoomResponse {
  campaign: {
    id: string;
    title: string;
    status: string;
    currentPhase: string;
    createdAt: string;
    updatedAt: string;
    executionStartedAt: string | null;
    completedAt: string | null;
  };
  masterplan: {
    available: boolean;
    reason?: string;
    id?: string;
    version?: number;
    status?: string;
    approvedAt?: string;
    contentHash?: string;
    contextFingerprint?: string;
    title?: string;
    objective?: string;
  };
  pendingCheckpoints: {
    available: boolean;
    reason?: string;
    records?: {
      id: string;
      assetId: string;
      checkpointType: string;
      status: string;
      createdAt: string;
      approvedAt: string | null;
      dueAt: string | null;
      masterplanVersionId: number;
       contextFingerprint: string | null;
    }[];
  };
  deliverables: {
    available: boolean;
    reason?: string;
    total?: number;
    previewReady?: number;
    records?: {
      kind: string;
      status: string;
      type: string;
      platform: string;
      total: number;
    }[];
  };
  credentials: {
    available: boolean;
    reason?: string;
    records?: {
      provider: string;
      accountId: string;
      accountName: string;
      status: string;
      tokenExpiresAt: string | null;
      updatedAt: string;
      health: {
        state: string;
        reason?: string;
      };
    }[];
  };
  executionEvidence: {
    available: boolean;
    reason?: string;
    records?: {
      id: string;
      subjectType: string;
      subjectId: string;
      state: string;
      createdAt: string;
      masterplanVersionId: number | null;
       contextFingerprint: string | null;
      details: unknown;
    }[];
  };
}

function Metric({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex flex-col border border-border/30 bg-background/20 p-2">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">{label}</span>
      <span className="font-mono text-xs text-white truncate">{value}</span>
    </div>
  );
}

function UnavailablePanel({ title, icon: Icon, reason }: { title: string, icon: any, reason?: string }) {
  return (
    <section className="border border-border/20 bg-black/40 border-dashed p-6 flex flex-col items-center justify-center text-center h-full min-h-[150px]">
      <div className="w-10 h-10 rounded-full border border-border/30 bg-background/30 flex items-center justify-center mb-3">
        <Icon className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">{title}</h2>
      <p className="font-mono text-[10px] text-muted-foreground/50">{reason || "Data currently unavailable"}</p>
    </section>
  );
}

type CounterTone = "primary" | "success" | "warning" | "danger" | "neutral";

const COUNTER_TONE: Record<CounterTone, string> = {
  primary: "border-primary/35 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/70",
  success: "border-success/35 bg-success/10 text-success hover:bg-success/20 hover:border-success/70",
  warning: "border-[#FFB000]/35 bg-[#FFB000]/10 text-[#FFB000] hover:bg-[#FFB000]/20 hover:border-[#FFB000]/70",
  danger: "border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/70",
  neutral: "border-border/40 bg-background/30 text-muted-foreground hover:bg-white/10 hover:text-white",
};

function ActionCounter({
  label,
  value,
  tone = "neutral",
  onClick,
  title,
}: {
  label: string;
  value: number | string;
  tone?: CounterTone;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={`${label}: ${value}. ${title}`}
      className={`min-w-[54px] border px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${COUNTER_TONE[tone]}`}
    >
      <span className="block font-mono text-[8px] uppercase tracking-widest opacity-70">{label}</span>
      <span className="block font-mono text-xs font-bold leading-none mt-0.5">{value}</span>
    </button>
  );
}

function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh] border-primary/25 bg-[#030712] text-foreground">
        <div className="mx-auto w-full max-w-3xl overflow-hidden flex flex-col">
          <DrawerHeader className="border-b border-border/20">
            <DrawerTitle className="font-mono text-sm uppercase tracking-widest text-primary">{title}</DrawerTitle>
            <DrawerDescription className="font-mono text-[10px] uppercase tracking-wider">
              {description}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-4">{children}</div>
          <DrawerFooter className="border-t border-border/20 sm:flex-row sm:justify-end">
            {footer}
            <DrawerClose asChild>
              <Button variant="outline" className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function MasterplanPanel({ data, campaignId }: { data: ControlRoomResponse["masterplan"], campaignId: string }) {
  if (!data.available) {
    return <UnavailablePanel title="Masterplan" icon={Database} reason={data.reason} />;
  }

  return (
    <section className="border border-primary/30 bg-black/60 backdrop-blur-md overflow-hidden relative group">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="p-3 border-b border-primary/20 flex justify-between items-center bg-primary/5">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">Masterplan</h2>
        </div>
        <div className="px-2 py-0.5 border border-success/40 bg-success/10 text-success font-mono text-[9px] uppercase tracking-wider">
          {data.status || "Active"}
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Title</div>
          <div className="text-sm font-sans font-medium text-white/90">{data.title || "Strategy Draft"}</div>
        </div>
        
        {data.objective && (
          <div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Objective</div>
            <div className="text-[11px] font-mono text-primary/80 leading-relaxed line-clamp-2">{data.objective}</div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Version" value={`v${data.version || 1}.0`} />
          <Metric label="Content Hash" value={data.contentHash?.substring(0, 8) || "N/A"} />
        </div>
        
        <Link 
          href={`/campaigns/${campaignId}/strategy`}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2 border border-primary/30 bg-primary/5 hover:bg-primary/20 hover:border-primary/60 transition-all font-mono text-[10px] text-primary uppercase tracking-widest cursor-pointer"
        >
          View Strategy Document <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

function DeliverablesPanel({ data, campaignId }: { data: ControlRoomResponse["deliverables"], campaignId: string }) {
  if (!data.available) {
    return <UnavailablePanel title="Deliverables Pipeline" icon={Layers} reason={data.reason} />;
  }

  const records = data.records || [];
  const total = data.total || 0;
  const previewReady = data.previewReady || 0;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<(typeof records)[number] | null>(null);
  const drawerRecords = selectedRecord ? [selectedRecord] : records;

  const openDeliverables = (record: (typeof records)[number] | null) => {
    setSelectedRecord(record);
    setDrawerOpen(true);
  };

  return (
    <>
      <section className="border border-primary/30 bg-black/60 backdrop-blur-md overflow-hidden relative group">
        <div className="p-3 border-b border-primary/20 flex justify-between items-center gap-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">Deliverables Pipeline</h2>
          </div>
          <ActionCounter
            label="Preview"
            value={`${previewReady}/${total}`}
            tone={previewReady === total ? "success" : "primary"}
            onClick={() => openDeliverables(null)}
            title="Ver composição dos entregáveis"
          />
        </div>

        <div className="p-0 max-h-[250px] overflow-y-auto hide-scrollbar">
          {records.length > 0 ? (
            <div className="divide-y divide-border/10">
              {records.map((rec, i) => (
                <button
                  type="button"
                  key={`${rec.kind}-${rec.status}-${rec.type}-${rec.platform}-${i}`}
                  onClick={() => openDeliverables(rec)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                  aria-label={`Ver ${rec.total} entregáveis ${rec.type} com status ${rec.status}`}
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-[11px] text-white uppercase tracking-wider">{rec.platform} {rec.type}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{rec.kind} · {rec.status}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-primary font-bold underline decoration-primary/30 underline-offset-4">{rec.total}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${rec.status === 'ready' || rec.status === 'approved' ? 'bg-success shadow-[0_0_8px_hsl(var(--success))]' : 'bg-primary/50 animate-pulse'}`} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Pipeline is empty
            </div>
          )}
        </div>
        <div className="p-3 border-t border-primary/20 bg-black/40">
          <Link
            href={`/campaigns/${campaignId}/content`}
            className="w-full flex items-center justify-center gap-2 py-2 border border-primary/30 bg-primary/5 hover:bg-primary/20 hover:border-primary/60 transition-all font-mono text-[10px] text-primary uppercase tracking-widest cursor-pointer"
          >
            Open Content Factory <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selectedRecord ? `${selectedRecord.type} · ${selectedRecord.status}` : "Composição dos entregáveis"}
        description={`${selectedRecord ? selectedRecord.total : total} registros persistidos na campanha`}
        footer={(
          <Link href={`/campaigns/${campaignId}/content`}>
            <Button className="rounded-none font-mono text-[10px] uppercase tracking-widest">
              Abrir fábrica de conteúdo
            </Button>
          </Link>
        )}
      >
        <div className="space-y-2">
          {drawerRecords.map((rec, i) => (
            <div key={`${rec.kind}-${rec.status}-${rec.type}-${rec.platform}-${i}`} className="border border-border/25 bg-black/40 p-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-white">{rec.platform || "geral"} · {rec.type}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{rec.kind} · {rec.status}</div>
              </div>
              <span className="font-mono text-lg font-bold text-primary">{rec.total}</span>
            </div>
          ))}
        </div>
      </DetailDrawer>
    </>
  );
}

function CredentialsPanel({ data }: { data: ControlRoomResponse["credentials"] }) {
  if (!data.available) {
    return <UnavailablePanel title="Integration Health" icon={ShieldCheck} reason={data.reason} />;
  }

  const records = data.records || [];
  const healthyCount = records.filter((record) => record.health.state === "healthy").length;
  const blockedCount = records.length - healthyCount;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [healthFilter, setHealthFilter] = useState<"all" | "healthy" | "blocked">("all");
  const filteredRecords = records.filter((record) => {
    if (healthFilter === "all") return true;
    if (healthFilter === "healthy") return record.health.state === "healthy";
    return record.health.state !== "healthy";
  });

  return (
    <>
      <section className="border border-success/30 bg-black/60 backdrop-blur-md overflow-hidden relative group">
        <div className="p-3 border-b border-success/20 flex flex-wrap justify-between items-center gap-3 bg-success/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">System Credentials</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <ActionCounter label="Total" value={records.length} onClick={() => { setHealthFilter("all"); setDrawerOpen(true); }} title="Ver todas as integrações" />
            <ActionCounter label="Saudáveis" value={healthyCount} tone="success" onClick={() => { setHealthFilter("healthy"); setDrawerOpen(true); }} title="Ver integrações saudáveis" />
            <ActionCounter label="Bloqueios" value={blockedCount} tone={blockedCount > 0 ? "danger" : "neutral"} onClick={() => { setHealthFilter("blocked"); setDrawerOpen(true); }} title="Ver integrações bloqueadas" />
          </div>
        </div>

        <div className="p-0 max-h-[200px] overflow-y-auto hide-scrollbar">
          {records.length > 0 ? (
            <div className="divide-y divide-border/10">
              {records.map((rec, i) => {
                const ok = rec.health.state === 'healthy';
                return (
                  <button
                    type="button"
                    key={`${rec.provider}-${rec.accountId}-${i}`}
                    onClick={() => { setHealthFilter(ok ? "healthy" : "blocked"); setDrawerOpen(true); }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-success/60"
                    aria-label={`Ver integração ${rec.provider}, estado ${rec.health.state}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px] text-white uppercase tracking-wider">{rec.provider}</span>
                      <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[150px]">{rec.accountName || rec.accountId}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest ${ok ? 'text-success' : 'text-destructive'}`}>
                        {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {rec.health.state}
                      </div>
                      {!ok && rec.health.reason && (
                        <span className="font-mono text-[8px] text-destructive/70 truncate max-w-[120px] mt-0.5">{rec.health.reason}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              No credentials bound
            </div>
          )}
        </div>
        <div className="p-3 border-t border-success/20 bg-black/40">
          <Link
            href={`/integracoes`}
            className="w-full flex items-center justify-center gap-2 py-2 border border-success/30 bg-success/5 hover:bg-success/20 hover:border-success/60 transition-all font-mono text-[10px] text-success uppercase tracking-widest cursor-pointer"
          >
            Manage Integrations <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={healthFilter === "healthy" ? "Integrações saudáveis" : healthFilter === "blocked" ? "Integrações bloqueadas" : "Saúde das integrações"}
        description={`${filteredRecords.length} de ${records.length} integrações persistidas no workspace`}
        footer={(
          <Link href="/integracoes">
            <Button className="rounded-none font-mono text-[10px] uppercase tracking-widest">Gerenciar integrações</Button>
          </Link>
        )}
      >
        <div className="space-y-2">
          {filteredRecords.length > 0 ? filteredRecords.map((rec, i) => {
            const ok = rec.health.state === "healthy";
            return (
              <div key={`${rec.provider}-${rec.accountId}-${i}`} className={`border p-3 ${ok ? "border-success/25 bg-success/5" : "border-destructive/25 bg-destructive/5"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-wider text-white">{rec.provider}</div>
                    <div className="font-mono text-[9px] text-muted-foreground mt-1">{rec.accountName || rec.accountId}</div>
                  </div>
                  <span className={`font-mono text-[9px] uppercase tracking-widest ${ok ? "text-success" : "text-destructive"}`}>{rec.health.state}</span>
                </div>
                {rec.health.reason && <div className="font-mono text-[9px] text-destructive/80 mt-2">{rec.health.reason}</div>}
              </div>
            );
          }) : (
            <div className="border border-border/25 bg-black/30 p-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Nenhum registro nesta categoria
            </div>
          )}
        </div>
      </DetailDrawer>
    </>
  );
}

function CheckpointsPanel({ data, campaignId }: { data: ControlRoomResponse["pendingCheckpoints"], campaignId: string }) {
  if (!data.available) {
    return <UnavailablePanel title="Actionable Checkpoints" icon={Clock} reason={data.reason} />;
  }

  const records = data.records || [];
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
    <section className="border border-[#FFB000]/30 bg-black/60 backdrop-blur-md overflow-hidden relative group flex flex-col h-[350px]">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFB000]/50 to-transparent" />
      <div className="p-3 border-b border-[#FFB000]/20 flex justify-between items-center bg-[#FFB000]/5 shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#FFB000]" />
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-[#FFB000] font-bold">Pending Checkpoints</h2>
        </div>
        {pendingCount > 0 && (
          <ActionCounter label="Requeridos" value={pendingCount} tone="warning" onClick={() => setDrawerOpen(true)} title="Ver checkpoints pendentes" />
        )}
      </div>
      
      <div className="overflow-y-auto flex-1 p-0 hide-scrollbar">
        {records.length > 0 ? (
          <div className="divide-y divide-border/10">
            {records.map((rec, i) => (
              <Link key={i} href={`/campaigns/${campaignId}`} className="block px-4 py-3 hover:bg-[#FFB000]/5 transition-colors group/row">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {rec.status === 'pending' ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FFB000] shadow-[0_0_5px_#FFB000]" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 text-success" />
                      )}
                      <span className={`font-mono text-[11px] uppercase tracking-widest font-bold ${rec.status === 'pending' ? 'text-[#FFB000]' : 'text-muted-foreground'}`}>
                        {rec.checkpointType.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="font-sans text-xs text-foreground/80 mb-1.5 line-clamp-1">
                      Approval required for {rec.assetId || "execution step"}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                      <span>Generated: {new Date(rec.createdAt).toLocaleTimeString()}</span>
                      {rec.dueAt && <span>Due: {new Date(rec.dueAt).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#FFB000]/40 group-hover/row:text-[#FFB000] transition-colors shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center justify-center text-center h-full">
            <CheckCircle2 className="h-8 w-8 text-success/40 mb-3" />
            <div className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">All Clear</div>
            <div className="font-mono text-[9px] text-muted-foreground mt-1 uppercase tracking-widest">No pending actions</div>
          </div>
        )}
      </div>
    </section>
    <DetailDrawer
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      title="Checkpoints pendentes"
      description={`${pendingCount} aprovações exigem decisão`}
      footer={(
        <Link href={`/campaigns/${campaignId}`}>
          <Button className="rounded-none font-mono text-[10px] uppercase tracking-widest">Abrir campanha</Button>
        </Link>
      )}
    >
      <div className="space-y-2">
        {records.map((rec) => (
          <Link key={rec.id} href={`/campaigns/${campaignId}`} className="block border border-[#FFB000]/25 bg-[#FFB000]/5 p-3 hover:bg-[#FFB000]/10 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-[#FFB000]">{rec.checkpointType.replace(/_/g, " ")}</div>
                <div className="font-mono text-[9px] text-muted-foreground mt-1">Asset: {rec.assetId}</div>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#FFB000]">{rec.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </DetailDrawer>
    </>
  );
}

function ExecutionEvidencePanel({ data }: { data: ControlRoomResponse["executionEvidence"] }) {
  if (!data.available) {
    return <UnavailablePanel title="Execution Telemetry" icon={Terminal} reason={data.reason} />;
  }

  const records = data.records || [];
  type EvidenceFilter = "all" | "planned" | "attempted" | "provider_confirmed" | "artifact_qc";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const countFor = (state: Exclude<EvidenceFilter, "all">) => records.filter((record) => record.state === state).length;
  const filteredRecords = filter === "all" ? records : records.filter((record) => record.state === filter);
  const openEvidence = (nextFilter: EvidenceFilter) => {
    setFilter(nextFilter);
    setDrawerOpen(true);
  };

  return (
    <>
    <section className="border border-primary/30 bg-black/60 backdrop-blur-md overflow-hidden relative group flex flex-col h-[500px]">
      <div className="p-3 border-b border-primary/20 flex flex-wrap justify-between items-center gap-3 bg-primary/5 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">Execution Telemetry</h2>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <ActionCounter label="Eventos" value={records.length} tone="primary" onClick={() => openEvidence("all")} title="Ver eventos carregados" />
          <ActionCounter label="Planejados" value={countFor("planned")} onClick={() => openEvidence("planned")} title="Ver ações planejadas" />
          <ActionCounter label="Tentativas" value={countFor("attempted")} tone="warning" onClick={() => openEvidence("attempted")} title="Ver tentativas de execução" />
          <ActionCounter label="Confirmados" value={countFor("provider_confirmed")} tone="success" onClick={() => openEvidence("provider_confirmed")} title="Ver confirmações do provedor" />
          <ActionCounter label="QC" value={countFor("artifact_qc")} tone="primary" onClick={() => openEvidence("artifact_qc")} title="Ver verificações de qualidade" />
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 bg-[#010308] font-mono hide-scrollbar flex flex-col">
        {records.length > 0 ? (
          <div className="p-3 space-y-2">
            {records.map((rec, i) => (
              <div key={i} className="text-xs flex gap-3 p-2 hover:bg-primary/5 rounded border border-transparent hover:border-primary/20 transition-colors">
                <div className="text-muted-foreground/40 shrink-0 select-none text-[10px] pt-0.5">
                  {new Date(rec.createdAt).toLocaleTimeString('en-US', { hour12: false })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-primary font-bold text-[10px] tracking-wider mt-0.5">[{rec.subjectType}]</span>
                    <span className="text-white/90 leading-tight">{rec.state}</span>
                  </div>
                  {typeof rec.details === "object" && rec.details !== null && Object.keys(rec.details).length > 0 && (
                    <div className="mt-2 p-2 bg-black border border-white/5 text-[9px] text-muted-foreground/70 overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-words font-mono leading-relaxed">
                        {JSON.stringify(rec.details, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div className="mt-1.5 text-[9px] text-muted-foreground/40 flex items-center gap-2 uppercase tracking-widest">
                    <span>ID: {rec.subjectId}</span>
                    <span>•</span>
                    <span>CTX: {rec.contextFingerprint?.substring(0, 8) || "N/A"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-widest flex-1 flex items-center justify-center">
            Awaiting execution data...
          </div>
        )}
      </div>
    </section>
    <DetailDrawer
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      title={
        filter === "all"
          ? "Evidências carregadas"
          : filter === "planned"
            ? "Ações planejadas"
            : filter === "attempted"
              ? "Tentativas de execução"
              : filter === "provider_confirmed"
                ? "Confirmações do provedor"
                : "Verificações de qualidade"
      }
      description={`${filteredRecords.length} de ${records.length} registros persistidos retornados pela API`}
    >
      <div className="space-y-2">
        {filteredRecords.length > 0 ? filteredRecords.map((rec) => (
          <div key={rec.id} className="border border-border/25 bg-black/40 p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-primary">{rec.subjectType}</div>
                <div className="font-mono text-[9px] text-muted-foreground mt-1 break-all">ID: {rec.subjectId}</div>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-white">{rec.state}</span>
            </div>
            <div className="font-mono text-[9px] text-muted-foreground mt-2">{new Date(rec.createdAt).toLocaleString("pt-BR")}</div>
            {typeof rec.details === "object" && rec.details !== null && Object.keys(rec.details).length > 0 && (
              <pre className="mt-2 border border-white/5 bg-black p-2 font-mono text-[9px] text-muted-foreground whitespace-pre-wrap break-words overflow-x-auto">
                {JSON.stringify(rec.details, null, 2)}
              </pre>
            )}
          </div>
        )) : (
          <div className="border border-border/25 bg-black/30 p-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Nenhuma evidência nesta categoria
          </div>
        )}
      </div>
    </DetailDrawer>
    </>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 scanline-overlay opacity-30 pointer-events-none" />
      <div className="flex flex-col items-center gap-4 relative z-10">
        <div className="relative">
          <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin" />
          <Activity className="h-8 w-8 text-primary opacity-50 m-4" />
        </div>
        <div className="font-mono text-[11px] text-primary uppercase tracking-widest animate-pulse font-bold">
          Establishing Uplink...
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error, onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center relative overflow-hidden text-center p-6">
      <div className="absolute inset-0 scanline-overlay opacity-30 pointer-events-none" />
      <div className="relative z-10 max-w-md w-full border border-destructive/30 bg-destructive/5 p-8 flex flex-col items-center backdrop-blur-md">
        <XCircle className="h-10 w-10 text-destructive mb-4" />
        <h2 className="font-mono text-sm uppercase tracking-widest text-destructive font-bold mb-2">Telemetry Lost</h2>
        <p className="font-mono text-xs text-muted-foreground mb-6 line-clamp-3">
          {error.message || "Failed to retrieve control room data from server."}
        </p>
        <Button 
          onClick={onRetry}
          variant="outline"
          className="border-destructive/30 text-destructive hover:bg-destructive/10 font-mono text-[10px] uppercase tracking-widest h-8"
        >
          <RefreshCw className="h-3 w-3 mr-2" /> Retry Connection
        </Button>
      </div>
    </div>
  );
}

export default function ControlRoom() {
  const [, params] = useRoute("/campaigns/:id/control-room");
  const id = params?.id || "";

  const { data, isLoading, error, refetch } = useQuery<ControlRoomResponse>({
    queryKey: ["/api/campaigns", id, "control-room"],
    queryFn: () => customFetch<ControlRoomResponse>(`/api/campaigns/${id}/control-room`),
    refetchInterval: (query: any) => {
      const status = query?.state?.data?.campaign?.status;
      const active = ["executing", "live", "analyzing", "generating", "intake"].includes(status || "");
      return active ? 5000 : false;
    }
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  }

  if (!data) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#030712] relative text-foreground selection:bg-primary/30">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-[#030712] to-[#030712] pointer-events-none" />
      <div className="absolute inset-0 scanline-overlay opacity-20 pointer-events-none mix-blend-overlay" />
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#030712]/90 backdrop-blur-xl border-b border-primary/20 px-4 sm:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Link 
              href={`/campaigns/${id}`} 
              className="p-2 border border-border/40 bg-black/40 hover:bg-white/5 hover:border-border/80 transition-colors text-muted-foreground hover:text-white shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-3">
                <h1
                  className="text-sm sm:text-base font-mono font-bold tracking-tight text-white line-clamp-2 break-words"
                  title={data.campaign.title}
                >
                  {data.campaign.title}
                </h1>
                <div className="hidden sm:block px-2 py-0.5 border border-primary/40 bg-primary/10 text-primary font-mono text-[9px] font-bold uppercase tracking-widest">
                  Control Room
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 mt-1 font-mono text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest truncate">
                <span className="flex items-center gap-1.5 shrink-0">
                  <Activity className="h-3 w-3 text-primary" />
                  PHASE: <span className="text-white/80">{data.campaign.currentPhase || "N/A"}</span>
                </span>
                <span className="opacity-40">•</span>
                <span className={`shrink-0 ${["executing", "live", "analyzing", "generating"].includes(data.campaign.status) ? "text-primary font-bold animate-pulse" : "text-white/80"}`}>
                  STATUS: {data.campaign.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
             <Button 
               variant="outline" 
               size="sm" 
               className="border-primary/30 bg-black/40 text-primary hover:bg-primary/10 hover:border-primary/60 hover:text-primary font-mono text-[10px] uppercase tracking-widest h-8"
               onClick={() => refetch()}
             >
               <RefreshCw className="h-3.5 w-3.5 sm:mr-2" /> 
               <span className="hidden sm:inline">Sync</span>
             </Button>
          </div>
        </div>
      </header>

      {/* DASHBOARD GRID */}
      <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4 sm:space-y-6">
            <MasterplanPanel data={data.masterplan} campaignId={id} />
            <DeliverablesPanel data={data.deliverables} campaignId={id} />
            <CredentialsPanel data={data.credentials} />
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4 sm:space-y-6 flex flex-col">
            <CheckpointsPanel data={data.pendingCheckpoints} campaignId={id} />
            <div className="flex-1 min-h-0">
              <ExecutionEvidencePanel data={data.executionEvidence} />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
