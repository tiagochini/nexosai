import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListOperationalCouncilCycles,
  getListOperationalCouncilCyclesQueryKey,
  useGetOperationalCouncilCycle,
  getGetOperationalCouncilCycleQueryKey,
  useCreateOperationalCouncilCycle,
  useAppendOperationalCouncilMinutes,
  useCreateOperationalCouncilDecision,
  useLinkOperationalCouncilAction,
  useVerifyOperationalCouncilOutcome,
  useListRealizationContracts,
  getListRealizationContractsQueryKey,
  type CouncilCycleInput,
  type CouncilMinutesInput,
  type CouncilDecisionInput,
  type CouncilActionInput,
  type CouncilActionInputFamily
} from "@workspace/api-client-react";
import {
  Gavel, CheckCircle2, AlertTriangle, ShieldCheck, Cpu, RefreshCw, XCircle, ChevronRight, FileText, FileSearch, Anchor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

// A small utility for idempotency keys
const generateIdempotencyKey = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

interface MasterplanData {
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
}

export function OperationalCouncilPanel({ campaignId, masterplan }: { campaignId: string, masterplan: MasterplanData }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  
  const { data: cyclesData, isLoading } = useListOperationalCouncilCycles(campaignId, {
    query: {
      queryKey: getListOperationalCouncilCyclesQueryKey(campaignId),
      refetchInterval: 10000,
    }
  });

  // @ts-ignore - API schema wraps cycles in an object if it's an array or directly returns it. We'll handle both.
  const cycles: any[] = Array.isArray(cyclesData) ? cyclesData : (cyclesData?.records || []);
  const activeCycles = cycles.filter((c: any) => c.status === "open");

  const queryClient = useQueryClient();
  const createCycle = useCreateOperationalCouncilCycle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOperationalCouncilCyclesQueryKey(campaignId) });
      }
    }
  });

  const exactBindingAvailable = Boolean(masterplan.available && masterplan.id && masterplan.contentHash && masterplan.contextFingerprint && masterplan.status === "approved");

  const handleCreateCycle = () => {
    if (!exactBindingAvailable) return;
    createCycle.mutate({
      data: {
        campaignId,
        masterplanVersionId: masterplan.id!,
        snapshotHash: masterplan.contentHash!,
        contextFingerprint: masterplan.contextFingerprint!,
        idempotencyKey: generateIdempotencyKey()
      }
    });
  };

  const openCycle = (id: string) => {
    setSelectedCycleId(id);
    setDrawerOpen(true);
  };

  return (
    <>
      <section className="border border-primary/30 bg-black/60 backdrop-blur-md overflow-hidden relative group flex flex-col h-[350px]">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="p-3 border-b border-primary/20 flex justify-between items-center bg-primary/5 shrink-0">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-primary" />
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">M10 Operational Council</h2>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <div className="px-2 py-0.5 border border-primary/40 bg-primary/10 text-primary font-mono text-[9px] uppercase tracking-wider">
              {activeCycles.length > 0 ? `${activeCycles.length} ACTIVE` : 'IDLE'}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-0 hide-scrollbar">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <RefreshCw className="h-4 w-4 text-primary/50 animate-spin" />
            </div>
          ) : cycles.length > 0 ? (
            <div className="divide-y divide-border/10">
              {cycles.map((cycle: any) => (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => openCycle(cycle.id)}
                  className="w-full text-left block px-4 py-3 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:bg-white/5 group/row"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className={`h-3 w-3 ${cycle.status === 'open' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`font-mono text-[11px] uppercase tracking-widest font-bold ${cycle.status === 'open' ? 'text-primary' : 'text-muted-foreground'}`}>
                          Cycle {cycle.id.substring(0, 8)}
                        </span>
                      </div>
                      <div className="font-sans text-xs text-foreground/80 mb-1.5 line-clamp-1">
                        Masterplan: {cycle.masterplanVersionId?.substring(0, 8)} | Fingerprint: {cycle.contextFingerprint?.substring(0, 8)}
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                        <span className="px-1 border border-border/40 text-muted-foreground bg-black/40">{cycle.status}</span>
                        <span>{new Date(cycle.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-primary/20 group-hover/row:text-primary transition-colors shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center text-center h-full">
              <Gavel className="h-8 w-8 text-primary/20 mb-3" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold">No Council Cycles</div>
              <div className="font-mono text-[9px] text-muted-foreground/60 mt-1 uppercase tracking-widest leading-relaxed">
                Nenhum ciclo operacional estabelecido.
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-black/40 border-t border-primary/20 shrink-0">
          <Button
            type="button"
            disabled={!exactBindingAvailable || createCycle.isPending}
            onClick={handleCreateCycle}
            title={!exactBindingAvailable ? "Requer um masterplan aprovado para instanciar governança." : "Instanciar ciclo"}
            className="w-full font-mono text-[10px] uppercase tracking-widest border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/70 hover:text-primary rounded-none h-10 transition-colors"
          >
            {createCycle.isPending ? "Instanciando..." : "Instanciar Novo Ciclo"}
          </Button>
          {!exactBindingAvailable && (
            <div className="mt-2 text-center font-mono text-[8px] text-muted-foreground/80">
              * Requer Masterplan aprovado na Control Room.
            </div>
          )}
        </div>
      </section>

      {selectedCycleId && (
        <CycleDetailDrawer 
          cycleId={selectedCycleId} 
          campaignId={campaignId}
          open={drawerOpen} 
          onOpenChange={(open) => {
            setDrawerOpen(open);
            if (!open) setTimeout(() => setSelectedCycleId(null), 300);
          }} 
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// CYCLE DETAIL DRAWER
// -----------------------------------------------------------------------------

function CycleDetailDrawer({ cycleId, campaignId, open, onOpenChange }: { cycleId: string, campaignId: string, open: boolean, onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetOperationalCouncilCycle(cycleId, {
    query: {
      enabled: open && !!cycleId,
      queryKey: getGetOperationalCouncilCycleQueryKey(cycleId),
      refetchInterval: 5000,
    }
  });

  const { data: contractsData } = useListRealizationContracts({ campaignId }, {
    query: { 
      queryKey: getListRealizationContractsQueryKey({ campaignId }),
      enabled: open,
    }
  });
  const { data: campaignCycles } = useListOperationalCouncilCycles(campaignId, {
    query: { enabled: open, queryKey: getListOperationalCouncilCyclesQueryKey(campaignId) }
  });
  const contracts = contractsData || [];

  const cycle = data?.cycle as any;
  const minutes = (data?.minutes || []) as any[];
  const decisions = (data?.decisions || []) as any[];
  const actions = (data?.actions || []) as any[];
  const outcomes = (data?.outcomes || []) as any[];

  // Filter exact binding for evidence dropdowns
  const compatibleContracts = contracts.filter(c => 
    cycle && 
    c.masterplanVersionId === cycle.masterplanVersionId &&
    c.contextFingerprint === cycle.contextFingerprint &&
    c.snapshotHash === cycle.snapshotHash
  );
  const nextCycles = ((campaignCycles || []) as any[]).filter(candidate =>
    cycle && candidate.id !== cycle.id &&
    new Date(candidate.createdAt).getTime() > new Date(cycle.createdAt).getTime() &&
    candidate.campaignId === cycle.campaignId &&
    candidate.masterplanVersionId === cycle.masterplanVersionId &&
    candidate.contextFingerprint === cycle.contextFingerprint &&
    candidate.snapshotHash === cycle.snapshotHash
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh] h-[95vh] border-primary/25 bg-[#030712] text-foreground flex flex-col focus-visible:outline-none">
        <div className="mx-auto w-full max-w-[1200px] overflow-hidden flex flex-col h-full">
          <DrawerHeader className="border-b border-border/20 shrink-0 p-4 bg-[#030712] flex justify-between items-start">
            <div>
              <DrawerTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                Council Cycle {cycleId.substring(0,8)}
              </DrawerTitle>
              <DrawerDescription className="font-mono text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">
                High-trust operational command surface. Governance & Execution linking.
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="outline" size="sm" className="font-mono text-[9px] uppercase tracking-widest h-8 rounded-none border-border/40 hover:bg-white/5 text-muted-foreground hover:text-white">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto min-h-0 bg-[#010308] p-4 md:p-6 hide-scrollbar space-y-8">
            {isLoading || !cycle ? (
              <div className="flex justify-center items-center h-32">
                <RefreshCw className="h-5 w-5 text-primary/50 animate-spin" />
              </div>
            ) : (
              <>
                <CycleHeader cycle={cycle} />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-8">
                    <MinutesSection cycleId={cycleId} cycle={cycle} minutes={minutes} contracts={compatibleContracts} />
                    <DecisionsSection cycleId={cycleId} cycle={cycle} decisions={decisions} actions={actions} outcomes={outcomes} contracts={compatibleContracts} />
                  </div>
                  
                  <div className="space-y-8">
                    <ActionLinkingSection cycleId={cycleId} cycle={cycle} campaignId={campaignId} decisions={decisions} actions={actions} outcomes={outcomes} contracts={compatibleContracts} nextCycles={nextCycles} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function CycleHeader({ cycle }: { cycle: any }) {
  return (
    <div className="border border-border/20 bg-white/5 p-4 flex flex-wrap gap-6 items-center justify-between">
      <div>
        <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Binding Hash</h3>
        <div className="font-mono text-[11px] text-white">{cycle.snapshotHash}</div>
      </div>
      <div>
        <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Context Fingerprint</h3>
        <div className="font-mono text-[11px] text-white">{cycle.contextFingerprint}</div>
      </div>
      <div>
        <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Status</h3>
        <div className={`px-2 py-0.5 border font-mono text-[10px] uppercase tracking-wider ${cycle.status === 'open' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground'}`}>
          {cycle.status}
        </div>
      </div>
      <div>
        <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Established</h3>
        <div className="font-mono text-[11px] text-white">{new Date(cycle.createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}

function MinutesSection({ cycleId, cycle, minutes, contracts }: { cycleId: string, cycle: any, minutes: any[], contracts: any[] }) {
  const queryClient = useQueryClient();
  const append = useAppendOperationalCouncilMinutes({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOperationalCouncilCycleQueryKey(cycleId) });
        setSummary("");
        setSelectedContracts([]);
      }
    }
  });

  const [summary, setSummary] = useState("");
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);

  const handleAppend = () => {
    if (!summary.trim()) return;
    append.mutate({
      id: cycleId,
      data: { 
        summary: summary.trim(), 
        evidenceRefs: [
          { type: 'masterplan', id: cycle.masterplanVersionId },
          ...selectedContracts.map(id => ({ type: 'realization_contract', id }))
        ]
      }
    });
  };

  const toggleContract = (contractId: string) => {
    setSelectedContracts(prev => 
      prev.includes(contractId) ? prev.filter(id => id !== contractId) : [...prev, contractId]
    );
  };

  return (
    <section>
      <h3 className="font-mono text-[12px] uppercase tracking-widest text-primary border-b border-border/20 pb-2 mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4" /> Council Minutes
      </h3>
      
      <div className="space-y-4 mb-4">
        {minutes.length === 0 ? (
          <div className="text-muted-foreground font-mono text-[10px] italic">No minutes recorded.</div>
        ) : (
          minutes.map(m => (
            <div key={m.id} className="border border-border/20 bg-black/40 p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-[9px] text-muted-foreground/60">ID: {m.id.substring(0,8)}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <p className="font-mono text-[11px] text-white/90 whitespace-pre-wrap leading-relaxed">{m.summary}</p>
              {m.evidenceRefs && m.evidenceRefs.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border/10 flex flex-wrap gap-2">
                  {m.evidenceRefs.map((ref: any, idx: number) => (
                    <span key={idx} className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/70 bg-white/5 border border-white/10 px-1.5 py-0.5">
                      {ref.type}: {ref.id?.substring(0,8) || "unknown"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border border-border/20 bg-white/5 p-3 flex flex-col gap-2">
        <textarea 
          className="w-full bg-black/50 border border-border/20 p-2 font-mono text-[11px] text-white focus-visible:outline-none focus-visible:border-primary/30 resize-none h-20"
          placeholder="Append operational minute..."
          value={summary}
          onChange={e => setSummary(e.target.value)}
        />
        
        {contracts.length > 0 && (
          <div className="mt-2">
            <h4 className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Attach M09 Evidence</h4>
            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto hide-scrollbar">
              {contracts.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer font-mono text-[10px] text-white/80 p-2 border border-border/20 bg-black/30 hover:bg-white/5">
                  <input 
                    type="checkbox" 
                    checked={selectedContracts.includes(c.id)}
                    onChange={() => toggleContract(c.id)}
                    className="bg-black border-border/40"
                  />
                  <span>[{c.state}] {c.action} ({c.id.substring(0,8)})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Button 
          type="button" 
          onClick={handleAppend}
          disabled={!summary.trim() || append.isPending}
          className="mt-2 self-end font-mono text-[9px] uppercase tracking-widest h-7 rounded-none border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary"
        >
          {append.isPending ? "Appending..." : "Append"}
        </Button>
      </div>
    </section>
  );
}

function DecisionsSection({ cycleId, cycle, decisions, actions, outcomes, contracts }: { cycleId: string, cycle: any, decisions: any[], actions: any[], outcomes: any[], contracts: any[] }) {
  const queryClient = useQueryClient();
  const createDecision = useCreateOperationalCouncilDecision({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOperationalCouncilCycleQueryKey(cycleId) });
        setRationale("");
        setSelectedContracts([]);
      }
    }
  });

  const [rationale, setRationale] = useState("");
  const [actionReq, setActionReq] = useState(true);
  const [dueAt, setDueAt] = useState("");
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  
  // Custom inputs for metrics
  const [targetMetric, setTargetMetric] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [baselineValue, setBaselineValue] = useState("");
  const [thresholdOperator, setThresholdOperator] = useState(">");
  const [thresholdValue, setThresholdValue] = useState("");
  const [windowDuration, setWindowDuration] = useState("");
  const [windowUnit, setWindowUnit] = useState("hours");

  const validDecision = Boolean(rationale.trim() && targetMetric.trim() && targetValue.trim() &&
    baselineValue.trim() && thresholdValue.trim() && Number(windowDuration) > 0 &&
    dueAt && !Number.isNaN(new Date(dueAt).getTime()));
  const handleCreate = () => {
    if (!validDecision) return;
    createDecision.mutate({
      id: cycleId,
      data: {
        rationaleSummary: rationale.trim(),
        target: { metric: targetMetric.trim(), value: targetValue.trim() },
        baseline: { metric: targetMetric.trim(), value: baselineValue.trim() },
        threshold: { operator: thresholdOperator, value: thresholdValue.trim() },
        window: { duration: Number(windowDuration), unit: windowUnit },
        dueAt: new Date(dueAt).toISOString(),
        actionRequired: actionReq,
        evidenceRefs: [
          { type: 'masterplan', id: cycle.masterplanVersionId },
          ...selectedContracts.map(id => ({ type: 'realization_contract', id }))
        ]
      }
    });
  };

  const toggleContract = (contractId: string) => {
    setSelectedContracts(prev => 
      prev.includes(contractId) ? prev.filter(id => id !== contractId) : [...prev, contractId]
    );
  };

  return (
    <section>
      <h3 className="font-mono text-[12px] uppercase tracking-widest text-primary border-b border-border/20 pb-2 mb-4 flex items-center gap-2">
        <Anchor className="h-4 w-4" /> Binding Decisions
      </h3>
      
      <div className="space-y-4 mb-4">
        {decisions.length === 0 ? (
          <div className="text-muted-foreground font-mono text-[10px] italic">No decisions established.</div>
        ) : (
          decisions.map(d => {
            const dActions = actions.filter(a => a.decisionId === d.id);
            return (
              <div key={d.id} className="border border-border/20 bg-black/60 p-4 relative overflow-hidden">
                {d.status === "superseded" && (
                  <div className="absolute top-0 right-0 px-2 py-1 bg-destructive/20 text-destructive font-mono text-[8px] uppercase">Superseded</div>
                )}
                <div className="flex justify-between items-center mb-3">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">Decision {d.id.substring(0,8)}</div>
                  <div className="font-mono text-[9px] text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</div>
                </div>
                <p className="font-mono text-[11px] text-white/80 mb-3">{d.rationaleSummary}</p>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="border border-border/20 bg-white/5 p-2 font-mono text-[9px]">
                    <div className="text-muted-foreground mb-1 uppercase">Action Req</div>
                    <div className={d.actionRequired ? 'text-white' : 'text-white/50'}>{d.actionRequired ? 'YES' : 'NO'}</div>
                  </div>
                  <div className="border border-border/20 bg-white/5 p-2 font-mono text-[9px]">
                    <div className="text-muted-foreground mb-1 uppercase">Target</div>
                    <div className="text-white truncate">{d.target?.metric}: {d.target?.value}</div>
                  </div>
                  <div className="border border-border/20 bg-white/5 p-2 font-mono text-[9px]">
                    <div className="text-muted-foreground mb-1 uppercase">Threshold</div>
                    <div className="text-white truncate">{d.threshold?.operator} {d.threshold?.value}</div>
                  </div>
                  <div className="border border-border/20 bg-white/5 p-2 font-mono text-[9px]">
                    <div className="text-muted-foreground mb-1 uppercase">Window</div>
                    <div className="text-white truncate">{d.window?.duration} {d.window?.unit}</div>
                  </div>
                </div>

                {d.evidenceRefs && d.evidenceRefs.length > 0 && (
                  <div className="mb-3 pt-2 border-t border-border/10 flex flex-wrap gap-2">
                    {d.evidenceRefs.map((ref: any, idx: number) => (
                      <span key={idx} className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/70 bg-white/5 border border-white/10 px-1.5 py-0.5">
                        {ref.type}: {ref.id?.substring(0,8) || "unknown"}
                      </span>
                    ))}
                  </div>
                )}

                {dActions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/10 space-y-2">
                    <div className="font-mono text-[9px] uppercase text-muted-foreground">Linked Actions</div>
                    {dActions.map(act => {
                      const outcome = outcomes.find(o => o.actionId === act.id);
                      return (
                        <div key={act.id} className="flex items-center justify-between border border-border/20 bg-black/40 p-2">
                          <div>
                            <div className="font-mono text-[10px] text-white">{act.family}</div>
                            <div className="font-mono text-[8px] text-muted-foreground">M09: {act.realizationContractId?.substring(0,8) || "N/A"}</div>
                          </div>
                          <div className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                            outcome?.status === 'verified' ? 'border-success/30 text-success bg-success/10' :
                            outcome?.status === 'inconclusive' ? 'border-[#FFB000]/30 text-[#FFB000] bg-[#FFB000]/10' :
                            outcome?.status === 'unsupported' ? 'border-destructive/30 text-destructive bg-destructive/10' :
                            'border-border/40 text-muted-foreground'
                          }`}>
                            {outcome?.status || 'PENDING OUTCOME'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border border-border/20 bg-white/5 p-3 flex flex-col gap-3">
        <textarea 
          className="w-full bg-black/50 border border-border/20 p-2 font-mono text-[11px] text-white focus-visible:outline-none focus-visible:border-primary/30 resize-none h-20"
          placeholder="Establish formal decision rationale..."
          value={rationale}
          onChange={e => setRationale(e.target.value)}
        />
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Target Metric</label>
            <input className="w-full bg-black/50 border border-border/20 p-1.5 font-mono text-[10px] text-white focus-visible:border-primary/40 focus-visible:outline-none" value={targetMetric} onChange={e => setTargetMetric(e.target.value)} placeholder="e.g. ROAS" />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Target Value</label>
            <input className="w-full bg-black/50 border border-border/20 p-1.5 font-mono text-[10px] text-white focus-visible:border-primary/40 focus-visible:outline-none" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder="e.g. 2.5" />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Baseline Value</label>
            <input className="w-full bg-black/50 border border-border/20 p-1.5 font-mono text-[10px] text-white focus-visible:border-primary/40 focus-visible:outline-none" value={baselineValue} onChange={e => setBaselineValue(e.target.value)} placeholder="e.g. 1.2" />
          </div>
          <div className="flex gap-1">
            <div className="flex-1">
              <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Threshold</label>
              <div className="flex gap-1">
                <select className="w-12 bg-black/50 border border-border/20 p-1.5 font-mono text-[10px] text-white focus-visible:border-primary/40 focus-visible:outline-none" value={thresholdOperator} onChange={e => setThresholdOperator(e.target.value)}>
                  <option value=">">&gt;</option>
                  <option value=">=">&ge;</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&le;</option>
                  <option value="==">=</option>
                </select>
                <input className="flex-1 min-w-0 bg-black/50 border border-border/20 p-1.5 font-mono text-[10px] text-white focus-visible:border-primary/40 focus-visible:outline-none" value={thresholdValue} onChange={e => setThresholdValue(e.target.value)} placeholder="Value" />
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Evaluation Window</label>
            <div className="flex gap-1">
              <input type="number" className="w-16 bg-black/50 border border-border/20 p-1.5 font-mono text-[10px] text-white focus-visible:border-primary/40 focus-visible:outline-none" value={windowDuration} onChange={e => setWindowDuration(e.target.value)} />
              <select className="flex-1 bg-black/50 border border-border/20 p-1.5 font-mono text-[10px] text-white focus-visible:border-primary/40 focus-visible:outline-none" value={windowUnit} onChange={e => setWindowUnit(e.target.value)}>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Due At</label>
            <input type="datetime-local" className="w-full bg-black/50 border border-border/20 p-1.5 font-mono text-[10px] text-white focus-visible:border-primary/40 focus-visible:outline-none h-[28px]" value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
        </div>

        {contracts.length > 0 && (
          <div className="mt-1">
            <h4 className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Attach M09 Evidence</h4>
            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto hide-scrollbar">
              {contracts.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer font-mono text-[10px] text-white/80 p-2 border border-border/20 bg-black/30 hover:bg-white/5">
                  <input 
                    type="checkbox" 
                    checked={selectedContracts.includes(c.id)}
                    onChange={() => toggleContract(c.id)}
                    className="bg-black border-border/40"
                  />
                  <span>[{c.state}] {c.action} ({c.id.substring(0,8)})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-2 border-t border-border/10 pt-3">
          <label className="flex items-center gap-2 font-mono text-[10px] text-white cursor-pointer">
            <input type="checkbox" checked={actionReq} onChange={e => setActionReq(e.target.checked)} className="bg-black border-border/20" />
            Requires Execution Action
          </label>
          <Button 
            type="button" 
            onClick={handleCreate}
            disabled={!validDecision || createDecision.isPending}
            className="font-mono text-[9px] uppercase tracking-widest h-7 rounded-none border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary"
          >
            {createDecision.isPending ? "Formalizing..." : "Formalize Decision"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ActionLinkingSection({ cycleId, cycle, campaignId, decisions, actions, outcomes, contracts, nextCycles }: { cycleId: string, cycle: any, campaignId: string, decisions: any[], actions: any[], outcomes: any[], contracts: any[], nextCycles: any[] }) {
  const queryClient = useQueryClient();
  const [nextCycleId, setNextCycleId] = useState("");
  
  const linkAction = useLinkOperationalCouncilAction({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOperationalCouncilCycleQueryKey(cycleId) });
      }
    }
  });

  const verifyOutcome = useVerifyOperationalCouncilOutcome({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOperationalCouncilCycleQueryKey(cycleId) });
      }
    }
  });

  // Only open decisions that require action
  const openDecisions = decisions.filter(d => d.status !== "superseded" && d.actionRequired);

  const handleLink = (decisionId: string, contractId: string, actionName: string) => {
    if (actionName !== "paid_media_pause" && actionName !== "paid_media_launch") return;
    const family: CouncilActionInputFamily = actionName;

    linkAction.mutate({
      id: decisionId,
      data: {
        family,
        realizationContractId: contractId,
        idempotencyKey: generateIdempotencyKey()
      }
    });
  };

  const handleVerify = (actionId: string) => {
    if (!nextCycles.some(c => c.id === nextCycleId)) return;
    verifyOutcome.mutate({ id: actionId, data: { nextCycleId } });
  };

  return (
    <section className="border border-border/20 bg-black/40 p-4">
      <h3 className="font-mono text-[12px] uppercase tracking-widest text-primary border-b border-border/20 pb-2 mb-4 flex items-center gap-2">
        <Cpu className="h-4 w-4" /> M09 Action Linking & Verification
      </h3>

      <div className="space-y-6">
        <div>
          <h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">1. Link Actions to Decisions</h4>
          {openDecisions.length === 0 ? (
            <div className="font-mono text-[9px] text-muted-foreground/60 italic border border-dashed border-border/20 p-3 text-center">
              No decisions require execution linking.
            </div>
          ) : contracts.length === 0 ? (
            <div className="font-mono text-[9px] text-[#FFB000] border border-[#FFB000]/20 bg-[#FFB000]/5 p-3">
              No active realization contracts in M09 engine. Cannot link execution.
            </div>
          ) : (
            <div className="space-y-3">
              {openDecisions.map(d => (
                <div key={d.id} className="border border-border/20 p-3 bg-white/5">
                  <div className="font-mono text-[10px] text-white mb-2 line-clamp-1">Decision: {d.rationaleSummary}</div>
                  <select 
                    className="w-full bg-black/80 border border-border/20 p-2 font-mono text-[10px] text-white focus-visible:outline-none focus-visible:border-primary/40"
                    onChange={(e) => {
                      if (e.target.value) {
                        const c = contracts.find(c => c.id === e.target.value);
                        if (c) handleLink(d.id, c.id, c.action);
                        e.target.value = ""; // reset
                      }
                    }}
                    disabled={linkAction.isPending}
                  >
                    <option value="">-- Select M09 Contract to Link --</option>
                    {contracts.filter(c => c.action === "paid_media_pause" || c.action === "paid_media_launch").map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.state}] {c.action} ({c.id.substring(0,8)})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">2. Verify Realization Outcomes</h4>
          <label className="mb-2 block font-mono text-[9px] text-muted-foreground">
            Select a later Council cycle with the same approved Master Plan. Its minutes must cite this action's M09 contract.
          </label>
          <select value={nextCycleId} onChange={e => setNextCycleId(e.target.value)}
            className="mb-3 w-full border border-border/30 bg-black p-2 font-mono text-[10px] text-white">
            <option value="">-- Select next cycle --</option>
            {nextCycles.map(c => <option key={c.id} value={c.id}>{new Date(c.createdAt).toLocaleString()} · {c.id.slice(0, 8)}</option>)}
          </select>
          {actions.length === 0 ? (
            <div className="font-mono text-[9px] text-muted-foreground/60 italic border border-dashed border-border/20 p-3 text-center">
              No actions linked for verification.
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map(act => {
                const actionOutcomes = outcomes.filter(o => o.actionId === act.id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const latestOutcome = actionOutcomes[0];
                return (
                  <div key={act.id} className="border border-border/20 p-3 bg-black/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-[10px] text-white">{act.family}</div>
                        <div className="font-mono text-[8px] text-muted-foreground">M09: {act.realizationContractId?.substring(0,8)}</div>
                      </div>
                      {latestOutcome ? (
                        <div className="flex items-center gap-2">
                          <div className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                            latestOutcome.status === 'verified' ? 'border-success/30 text-success bg-success/10' :
                            latestOutcome.status === 'inconclusive' ? 'border-[#FFB000]/30 text-[#FFB000] bg-[#FFB000]/10' :
                            'border-destructive/30 text-destructive bg-destructive/10'
                          }`}>
                            {latestOutcome.status}
                          </div>
                          {latestOutcome.status === 'inconclusive' && (
                            <Button
                              type="button"
                              onClick={() => handleVerify(act.id)}
                              disabled={verifyOutcome.isPending || !nextCycleId}
                              className="font-mono text-[9px] uppercase tracking-widest h-6 rounded-none border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary px-2"
                            >
                              Reverify
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => handleVerify(act.id)}
                          disabled={verifyOutcome.isPending || !nextCycleId}
                          className="font-mono text-[9px] uppercase tracking-widest h-6 rounded-none border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary px-2"
                        >
                          Verify Outcome
                        </Button>
                      )}
                    </div>
                    {actionOutcomes.length > 1 && (
                      <div className="mt-2 pt-2 border-t border-border/10 flex flex-col gap-1">
                        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground mb-1">Outcome History</span>
                        {actionOutcomes.slice(1).map((o, idx) => (
                           <div key={idx} className="flex justify-between items-center font-mono text-[8px] text-muted-foreground">
                             <span>{new Date(o.createdAt).toLocaleString()}</span>
                             <span className="uppercase">{o.status}</span>
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
