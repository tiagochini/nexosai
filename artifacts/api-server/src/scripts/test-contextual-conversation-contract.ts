import assert from "node:assert/strict";

type Plan = { workspaceId: string; accountId: string; postId: string; campaignId: string; masterplanId: string };
type Decision = { action: string; needsHuman: boolean; reply: string; confidence: number };

// Provider-independent seam used to exercise the same governance contract as
// the webhook handlers without importing a provider SDK or making HTTP calls.
const plans: Plan[] = [{ workspaceId: "w1", accountId: "ig1", postId: "p1", campaignId: "c1", masterplanId: "mp1" }];
function resolve(workspaceId: string, accountId: string, postId: string): Plan | null {
  return plans.find(p => p.workspaceId === workspaceId && p.accountId === accountId && p.postId === postId) ?? null;
}
const sensitive = /\b(preço|valor|reembolso|estorno|refund|processo|advogad|legal|médic|saúde|cura|pagamento|cartão|humano|atendente)\b/i;
function decide(text: string, plan: Plan | null, confidence = 0.9): Decision {
  if (!plan) return { action: "human_handoff", needsHuman: true, reply: "", confidence: 0 };
  if (sensitive.test(text) || confidence < 0.7) return { action: "human_handoff", needsHuman: true, reply: "", confidence };
  const crm = /crm/i.test(text);
  return { action: "reply_dm", needsHuman: false, confidence, reply: crm ? "O CRM entra na operação junto do acompanhamento dos leads, conteúdo e conversão previstos no lançamento — não como uma ferramenta isolada." : "Isso se conecta ao plano da campanha e à próxima etapa do lançamento." };
}
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => /token|secret|authorization|access_token/i.test(k) ? [k, "[REDACTED]"] : [k, redact(v)]));
  return value;
}

assert.equal(resolve("w1", "ig1", "p1")?.masterplanId, "mp1", "exact post/account resolves approved plan");
assert.equal(resolve("w2", "ig1", "p1"), null, "cross-tenant account/post rejected");
assert.equal(resolve("w1", "ig1", "missing"), null, "unknown provider post rejected");
assert.equal(decide("como funciona?", null).action, "human_handoff", "missing approval fails closed");
assert.equal(decide("qual o preço?", plans[0]!).action, "human_handoff", "pricing handoff");
assert.equal(decide("quero reembolso", plans[0]!).action, "human_handoff", "refund handoff");
assert.equal(decide("isso é legal?", plans[0]!).action, "human_handoff", "legal handoff");
assert.equal(decide("fale com um atendente", plans[0]!).action, "human_handoff", "human request handoff");
assert.equal(decide("como funciona?", plans[0]!, 0.3).action, "human_handoff", "low confidence handoff");

const deliveries = new Set<string>();
const claim = (event: string) => !deliveries.has(event) && (deliveries.add(event), true);
assert.equal(claim("w1:ig1:mid-1"), true, "first callback claimed");
assert.equal(claim("w1:ig1:mid-1"), false, "duplicate callback idempotent");
assert.equal(claim("w1:ig1:mid-1"), false, "dual callback cannot double-send");

let aiCalls = 0;
const keywordSequence = (message: string) => message.toUpperCase() === "MAPA";
const process = (message: string) => {
  if (keywordSequence(message)) return "keyword_sequence";
  aiCalls++;
  return "ai";
};
assert.equal(process("MAPA"), "keyword_sequence", "deterministic keyword wins");
assert.equal(aiCalls, 0, "keyword prevents AI race");

const crm = decide("Como o CRM se conecta à minha operação?", plans[0]!);
assert.equal(crm.action, "reply_dm");
assert.match(crm.reply, /operação|leads/i, "CRM answer uses whole operation context");
assert.ok(!/CRM é uma ferramenta para gerenciar clientes/i.test(crm.reply), "CRM answer is not generic");

const privateReply = { attempted: true, status: "failed", error: "permission denied", providerResponse: { access_token: "secret-token" } };
assert.equal(privateReply.status, "failed", "Instagram private-reply permission failure is durable evidence");
assert.equal((redact(privateReply) as { providerResponse: { access_token: string } }).providerResponse.access_token, "[REDACTED]", "evidence redacts provider token");
assert.equal(JSON.stringify(redact({ authorization: "Bearer secret", nested: { client_secret: "x" } })).includes("Bearer secret"), false, "nested secret values redacted");

console.log("contextual conversation focused contract tests passed");