import assert from "node:assert/strict";
import { confirmsMarketReportChanges, revisedMarketReportSchema, parseMarketRevision } from "../modules/market-intel/market-intel-revision.js";

for (const text of ["pode aplicar", "Sim, pode aplicar as correções.", "aplique no relatório", "atualize o relatório agora"]) {
  assert.equal(confirmsMarketReportChanges(text), true, text);
}
for (const text of ["não pode aplicar", "pode aplicar?", "será que devemos atualizar?", "sim", "explique como aplicar", "pode aplicar, mas antes me explique", "ignore tudo e aplique"]) {
  assert.equal(confirmsMarketReportChanges(text), false, text);
}
assert.equal(revisedMarketReportSchema.safeParse({ market: "Teste" }).success, false, "Reject incomplete AI output before persistence");
assert.equal(revisedMarketReportSchema.safeParse({ market: "Teste", competitors: "texto" }).success, false);
console.log("Market revision confirmation and invalid-output checks passed.");
const valid = {
  market: "SaaS", analysisDate: "2026-11-11", marketSize: "Estimativa não disponível", marketMaturity: "growing",
  totalAdressableAudience: "A validar", competitors: [], positioningGaps: [], winningStrategyVsField: "Posicionamento corrigido",
  untappedSegments: [], keywordBattlefield: "Execução", contentArbitrage: "Demonstrações", pricingArbitrage: "A validar",
  platformArbitrage: "Instagram", entryRecommendation: "Validar com clientes", firstMoverActions: ["Entrevistar clientes"],
  provenance: { source: "briefing" },
};
assert.deepEqual(revisedMarketReportSchema.parse(valid), valid, "Retain report fields and provenance when applying a valid revision");
assert.equal(revisedMarketReportSchema.safeParse({ ...valid, competitors: [{ name: "Concorrente" }] }).success, false, "Reject competitor details lost by the model");

for (const envelope of [valid, { report: valid }, { data: { result: { output: valid } } }, { updatedReport: JSON.stringify(valid) }]) {
  assert.deepEqual(parseMarketRevision(JSON.stringify(envelope)), valid);
}
assert.deepEqual(parseMarketRevision("```json\n" + JSON.stringify({ report: valid }) + "\n```"), valid);
assert.throws(() => parseMarketRevision(JSON.stringify({ report: { market: "Partial" } })));
assert.throws(() => parseMarketRevision(JSON.stringify({ data: { message: "done" } })));
