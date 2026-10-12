import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, campaignsTable, commercialProductsTable, commercialSubscriptionsTable, productIntakesTable } from "@workspace/db";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";

await assertIsolationTestDatabase(pool);
process.env.ANTHROPIC_API_KEY = "offline-briefing-edit-fixture";
const { processConversationalTurn } = await import("../modules/intake/intake.ai.js");
const { getIntakeQuestions, saveIntakeData } = await import("../modules/intake/intake.service.js");
const log = pino({level:"silent"});
const marker=randomUUID();let userId:string|undefined;let productId:string|undefined;
const originalFetch=globalThis.fetch;
let calls=0;
globalThis.fetch = async (input, init) => {
  const url=typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  assert.ok(url.startsWith("https://api.anthropic.com/"),"no external provider calls permitted");
  calls++;
  const content=JSON.stringify({agentId:"jeff",extracted:{"campaign.budget.total":2000,"briefing.reviewNotes":"Novo teto R$2.000; preço provisório; integrações pendentes"},aiMessage:"Orçamento atualizado para R$2.000; demais ressalvas preservadas.",isComplete:true,nextQuestionId:null});
  return new Response(JSON.stringify({id:"msg_offline",type:"message",role:"assistant",model:"claude-opus-4-5",content:[{type:"text",text:content}],stop_reason:"end_turn",stop_sequence:null,usage:{input_tokens:20,output_tokens:30}}),{status:200,headers:{"Content-Type":"application/json"}});
};
try {
  const [plan]=await db.select().from(plansTable).limit(1);assert.ok(plan);
  const [user]=await db.insert(usersTable).values({email:`brief-edit-${marker}@example.invalid`,name:"Brief edit",passwordHash:"inert"}).returning();userId=user!.id;
  const [workspace]=await db.insert(workspacesTable).values({ownerId:userId,planId:plan.id,name:"Brief edit",slug:`brief-edit-${marker}`,creditsBalance:10000}).returning();assert.ok(workspace);
  const [product]=await db.insert(commercialProductsTable).values({key:`brief-edit-${marker}`,name:"Brief edit",masterPlanKey:"launch"}).returning();productId=product!.id;
  const [subscription]=await db.insert(commercialSubscriptionsTable).values({workspaceId:workspace.id,productId,status:"active",startedAt:new Date()}).returning();
  const [campaign]=await db.insert(campaignsTable).values({workspaceId:workspace.id,title:"Complete editable briefing",type:"continuous_sales",track:"not_applicable",commercialProductId:productId,commercialSubscriptionId:subscription!.id,status:"intake"}).returning();assert.ok(campaign);
  const data:Record<string,unknown>=Object.fromEntries(getIntakeQuestions("continuous_sales","not_applicable").filter(q=>q.required).map(q=>[q.id,"Fixture answer"]));
  Object.assign(data,{"product.name":"Fixture","product.price":297,"campaign.budget.total":3000,"campaign.timeline":"30_days","briefing.reviewNotes":"Preço provisório; integrações pendentes",_psychologicalProfile:{fixture:true},_conversationHistory:[{role:"user",content:"Manter pesquisa sem oferta"}]});
  await saveIntakeData(campaign.id,workspace.id,data,log);
  // Control messages may summarize completed intake without LLM calls.
  await processConversationalTurn(campaign.id,workspace.id,"continuar_intake",[],log);assert.equal(calls,0);
  const edited=await processConversationalTurn(campaign.id,workspace.id,"Corrija o orçamento para R$2.000 e preserve as ressalvas",[],log);
  assert.ok(calls>0,"a correction must not be swallowed by completed-intake shortcut");
  assert.equal(edited.intakeData["campaign.budget.total"],2000);assert.ok(String(edited.intakeData["briefing.reviewNotes"]).includes("integrações pendentes"));
  const [saved]=await db.select().from(campaignsTable).where(eq(campaignsTable.id,campaign.id));assert.equal(saved!.status,"intake");
  const [canonical]=await db.select().from(productIntakesTable).where(eq(productIntakesTable.id,saved!.productIntakeVersionId!));assert.equal(canonical!.status,"draft");assert.deepEqual(canonical!.snapshot,saved!.intakeData);
  assert.ok(JSON.stringify(saved!.intakeData).includes("Manter pesquisa sem oferta"));
  console.log("PASS completed briefing accepts corrections through mocked Claude, saves budget/notes/history and canonical draft; no real provider calls or execution");
}finally{
  globalThis.fetch=originalFetch;
  if(userId)await db.delete(usersTable).where(eq(usersTable.id,userId));
  if(productId)await db.delete(commercialProductsTable).where(eq(commercialProductsTable.id,productId));
  await pool.end();
}
