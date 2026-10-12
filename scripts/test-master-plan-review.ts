import assert from "node:assert/strict";
import { masterPlanReview } from "../artifacts/app/src/lib/master-plan-review.ts";
import { preserveBriefingContext, briefingDecisionContext, defaultScarcity } from "../artifacts/api-server/src/modules/intake/intake-context.ts";

const data = { "campaign.type": "continuous_sales", "campaign.timeline": "30_days", "audience.description": "Produtores digitais", "briefing.reviewNotes": "Preço provisório; margem desconhecida; pesquisa sem oferta." };
const review = masterPlanReview(data);
assert.equal(review.continuous,true);assert.equal(review.duration,30);assert.equal(review.audience,data["audience.description"]);assert.equal(review.track,"not_applicable");
assert.equal(masterPlanReview({}).duration,null,"missing duration must not become seven days");
assert.equal(masterPlanReview({...data,"campaign.type":"launch"},"continuous_sales","not_applicable").model,"continuous_sales","persisted model wins over stale form model");
assert.equal(masterPlanReview({"launch.duration":14},"launch").duration,14);
assert.deepEqual(defaultScarcity("continuous_sales",{}),{});
assert.deepEqual(defaultScarcity("launch",{}),{"launch.scarcityMechanism":"deadline"});
const previous = preserveBriefingContext({}, {...data,_conversationHistory:[{role:"user",content:"Margem ainda desconhecida"},{role:"assistant",content:"Margem garantida"},{role:"user",content:"Confirmo o modelo: continuous_sales"}]});
const next = preserveBriefingContext(previous,{_conversationHistory:[{role:"user",content:"Integrações pendentes"}]});
assert.deepEqual(next._briefingUserDecisions,["Margem ainda desconhecida","Integrações pendentes"]);
assert.equal(next["briefing.reviewNotes"],data["briefing.reviewNotes"]);
assert.ok(briefingDecisionContext(next).includes("Margem ainda desconhecida"));
assert.ok(!briefingDecisionContext(next).includes("Margem garantida"));
console.log("PASS continuous review: declared duration/audience/model; no invented duration or scarcity; user decisions survive rolling history and retain caveats");
