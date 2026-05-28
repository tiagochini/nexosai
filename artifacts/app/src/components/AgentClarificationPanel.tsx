import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { toast } from "sonner";
import { Bot, X, MessageSquare, AlertTriangle, ChevronRight, CheckCircle2 } from "lucide-react";
import type { CampaignEvent } from "@/lib/socket";

interface ClarificationRequest {
  id: string;
  agentRole: string;
  question: string;
  options?: string[] | null;
  context?: string | null;
  isBriefingGap?: boolean;
  severity?: string;
  answer?: string;
  status: string;
}

interface Props {
  campaignId: string;
  events: CampaignEvent[];
}

const AGENT_LABELS: Record<string, string> = {
  copywriter: "Copywriter",
  strategy: "Estrategista",
  ad_copy: "Ad Copy",
  profile_builder: "Perfil de Avatar",
  intake: "Briefing",
  sequence_builder: "Sequência",
  landing_page: "Landing Page",
  vsl_script: "VSL Script",
  offer_architect: "Arquiteto de Oferta",
  targeting: "Targeting Expert",
  analytics: "Analytics",
  optimization: "Otimização",
};

export function AgentClarificationPanel({ campaignId, events }: Props) {
  const [pending, setPending] = useState<ClarificationRequest[]>([]);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Pick up clarification_needed events from socket
  useEffect(() => {
    const needed = events.filter((e) => e.type === "clarification_needed");
    if (needed.length === 0) return;
    const newItems: ClarificationRequest[] = needed
      .filter((e) => e.data?.requestId && !dismissed.has(e.data.requestId as string))
      .map((e) => ({
        id: e.data!.requestId as string,
        agentRole: e.agentType ?? "agent",
        question: e.message ?? "",
        options: e.data?.options as string[] | null,
        context: e.data?.context as string | null,
        isBriefingGap: e.data?.isBriefingGap as boolean,
        severity: e.data?.severity as string,
        status: "pending",
      }));
    setPending((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const fresh = newItems.filter((n) => !existingIds.has(n.id) && !answered.has(n.id));
      return [...prev, ...fresh];
    });
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up clarification_answered events from socket
  useEffect(() => {
    const answeredEvts = events.filter((e) => e.type === "clarification_answered");
    if (answeredEvts.length === 0) return;
    for (const evt of answeredEvts) {
      const rid = evt.data?.requestId as string | undefined;
      if (rid) {
        setAnswered((prev) => new Set([...prev, rid]));
        setPending((prev) => prev.filter((p) => p.id !== rid));
      }
    }
  }, [events]);

  const handleSelectOption = (reqId: string, option: string) => {
    setDraft((prev) => ({ ...prev, [reqId]: option }));
  };

  const handleSubmit = async (req: ClarificationRequest) => {
    const answer = draft[req.id]?.trim();
    if (!answer) return;
    setSubmitting(req.id);
    try {
      await customFetch<{ ok: boolean }>(
        `/api/campaigns/${campaignId}/clarifications/${req.id}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
        },
      );
      setAnswered((prev) => new Set([...prev, req.id]));
      setPending((prev) => prev.filter((p) => p.id !== req.id));
      toast.success("Resposta enviada — os agentes vão usar essa informação.");
    } catch {
      toast.error("Erro ao enviar resposta.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleDismiss = async (req: ClarificationRequest) => {
    try {
      await customFetch<{ ok: boolean }>(
        `/api/campaigns/${campaignId}/clarifications/${req.id}/dismiss`,
        { method: "POST" },
      );
    } catch {
      // ignore
    }
    setDismissed((prev) => new Set([...prev, req.id]));
    setPending((prev) => prev.filter((p) => p.id !== req.id));
  };

  const activePending = pending.filter((p) => !dismissed.has(p.id) && !answered.has(p.id));

  if (activePending.length === 0) return null;

  return (
    <div className="space-y-3">
      {activePending.map((req) => (
        <div
          key={req.id}
          className={`border rounded-none bg-card/40 ${
            req.severity === "blocking"
              ? "border-amber-500/40 bg-amber-500/5"
              : req.isBriefingGap
              ? "border-blue-400/30 bg-blue-400/5"
              : "border-primary/20 bg-primary/5"
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
                {AGENT_LABELS[req.agentRole] ?? req.agentRole}
              </span>
              {req.isBriefingGap && (
                <Badge className="font-mono text-[8px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border-blue-400/30 rounded-none px-1.5">
                  lacuna no briefing
                </Badge>
              )}
              {req.severity === "blocking" && (
                <Badge className="font-mono text-[8px] uppercase tracking-widest bg-amber-500/20 text-amber-300 border-amber-400/30 rounded-none px-1.5">
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" /> importante
                </Badge>
              )}
            </div>
            <button
              onClick={() => handleDismiss(req)}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Question */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start gap-2 mb-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <p className="font-mono text-sm text-foreground leading-relaxed">{req.question}</p>
            </div>
            {req.context && (
              <p className="font-mono text-[11px] text-muted-foreground/50 leading-relaxed ml-5 mb-2 italic">
                Por quê: {req.context}
              </p>
            )}
          </div>

          {/* Options */}
          {req.options && req.options.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {req.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelectOption(req.id, opt)}
                  className={`font-mono text-xs px-3 py-1.5 border rounded-none transition-all duration-150 ${
                    draft[req.id] === opt
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {draft[req.id] === opt && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Free-text if no option selected or no options */}
          <div className="px-4 pb-4">
            <Textarea
              value={draft[req.id] ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, [req.id]: e.target.value }))}
              placeholder={
                req.options?.length
                  ? "Ou escreva aqui se preferir personalizar..."
                  : "Escreva sua resposta..."
              }
              className="font-mono text-xs min-h-[60px] bg-background/40 border-border/25 rounded-none resize-none mb-2"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(req)}
                className="font-mono text-xs h-7 text-muted-foreground/50 hover:text-muted-foreground"
              >
                Ignorar
              </Button>
              <Button
                size="sm"
                onClick={() => handleSubmit(req)}
                disabled={!draft[req.id]?.trim() || submitting === req.id}
                className="btn-weapon-primary rounded-none font-mono text-xs h-7 gap-1 uppercase tracking-widest"
              >
                {submitting === req.id ? "Enviando..." : "Responder"} <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
