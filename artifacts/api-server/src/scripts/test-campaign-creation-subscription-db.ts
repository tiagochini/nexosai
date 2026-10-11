import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import pino from "pino";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, campaignsTable, commercialProductsTable, commercialSubscriptionsTable, productIntakesTable } from "@workspace/db";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";
import router from "../modules/campaigns/campaigns.routes.js";
import { issueTokens } from "../modules/auth/auth.service.js";
import { AppError } from "../lib/errors.js";
import intakeRouter from "../modules/intake/intake.routes.js";
import productIntakeRouter from "../modules/product-intake/product-intake.routes.js";

await assertIsolationTestDatabase(pool);
const marker=randomUUID();
const users:string[]=[];
const products:string[]=[];
const app=express();
app.use(express.json());
app.use((req,_res,next)=>{req.log=pino({level:"silent"});next();});
app.use("/campaigns",router);
app.use("/intake",intakeRouter);
app.use("/product-intake",productIntakeRouter);
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  res.status(err instanceof AppError ? err.statusCode : 500).json({code:err instanceof AppError ? err.code : "TEST_ERROR"});
});
const server=app.listen(0,"127.0.0.1");
await new Promise<void>(r=>server.once("listening",r));
const address=server.address();assert.ok(address&&typeof address!=="string");
try {
 const [plan]=await db.select().from(plansTable).limit(1);assert.ok(plan);
 const actors=[];
 for(let i=0;i<2;i++){
  const [user]=await db.insert(usersTable).values({email:`creation-${i}-${marker}@example.invalid`,name:"Creation fixture",passwordHash:"inert"}).returning();users.push(user!.id);
  const [ws]=await db.insert(workspacesTable).values({ownerId:user!.id,planId:plan.id,name:"Creation fixture",slug:`creation-${i}-${marker}`}).returning();
  const [product]=await db.insert(commercialProductsTable).values({key:`creation-${i}-${marker}`,name:"Creation fixture",masterPlanKey:"launch"}).returning();products.push(product!.id);
  const [subscription]=await db.insert(commercialSubscriptionsTable).values({workspaceId:ws!.id,productId:product!.id,status:"active",startedAt:new Date()}).returning();
  const session=await issueTokens(user!,ws!.id);
  actors.push({ws:ws!,product:product!,subscription:subscription!,token:session.accessToken});
 }
 const a=actors[0]!,b=actors[1]!;
 const request=(data:object)=>fetch(`http://127.0.0.1:${address.port}/campaigns`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a.token}`},body:JSON.stringify({title:"Valid launch",type:"launch",track:"six_digits",...data})});
 for(const data of [{},{commercialProductId:"bad",commercialSubscriptionId:"bad"},{commercialProductId:b.product.id,commercialSubscriptionId:b.subscription.id},{commercialProductId:b.product.id,commercialSubscriptionId:a.subscription.id}]){
  assert.equal((await request(data)).status,400);
 }
 assert.equal((await db.select().from(campaignsTable).where(eq(campaignsTable.workspaceId,a.ws.id))).length,0);
 const good={commercialProductId:a.product.id,commercialSubscriptionId:a.subscription.id};
 await db.update(commercialSubscriptionsTable).set({status:"paused"}).where(eq(commercialSubscriptionsTable.id,a.subscription.id));
 assert.equal((await request(good)).status,400);
 await db.update(commercialSubscriptionsTable).set({status:"active"}).where(eq(commercialSubscriptionsTable.id,a.subscription.id));
 const response=await request(good);assert.equal(response.status,201);
 const {campaign}=await response.json() as {campaign:{id:string;workspaceId:string;commercialProductId:string;commercialSubscriptionId:string;status:string}};
 assert.equal(campaign.workspaceId,a.ws.id);assert.equal(campaign.commercialProductId,a.product.id);assert.equal(campaign.commercialSubscriptionId,a.subscription.id);assert.equal(campaign.status,"intake");
 assert.equal((await db.select().from(campaignsTable).where(eq(campaignsTable.workspaceId,b.ws.id))).length,0);
 const scopedRequest=(path:string,method="GET")=>fetch(`http://127.0.0.1:${address.port}${path}`,{method,headers:{Authorization:`Bearer ${a.token}`}});
 const intakeResponse=await scopedRequest(`/intake/${campaign.id}`);assert.equal(intakeResponse.status,200);
 const intakeData=await intakeResponse.json() as {questions:unknown[];completeness:{valid:boolean}};
 assert.ok(intakeData.questions.length>0);assert.equal(intakeData.completeness.valid,false);
 assert.equal((await scopedRequest(`/intake/${campaign.id}/finalize`,"POST")).status,400,"defaults cannot complete an empty briefing");
 const [draft]=await db.insert(productIntakesTable).values({workspaceId:a.ws.id,commercialProductId:a.product.id,version:1,entryPoint:"launch",sourceCampaignId:campaign.id,snapshot:{_conversationHistory:[{role:"user",content:"Hello"}]},createdByUserId:users[0]}).returning();
 const denied=await scopedRequest(`/product-intake/${draft!.id}/approve`,"POST");assert.equal(denied.status,400);
 assert.equal((await db.select().from(productIntakesTable).where(eq(productIntakesTable.id,draft!.id)))[0]!.status,"draft");
 await db.update(productIntakesTable).set({snapshot:{"product.name":"Course","audience.pain":"Problem","product.price":10}}).where(eq(productIntakesTable.id,draft!.id));
 assert.equal((await scopedRequest(`/product-intake/${draft!.id}/approve`,"POST")).status,200);
 assert.equal((await db.select().from(campaignsTable).where(eq(campaignsTable.id,campaign.id)))[0]!.status,"intake","approval does not execute campaign");
 console.log("PASS briefing HTTP: bound campaign receives questions; empty finalize/history-only approval blocked; collected answers can be approved without starting campaign");
 console.log("PASS campaign creation HTTP: explicit commercial binding persisted; missing, malformed, foreign, mismatched and inactive bindings rejected (no provider calls)");
}finally{
 await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 for(const id of users)await db.delete(usersTable).where(eq(usersTable.id,id));
 for(const id of products)await db.delete(commercialProductsTable).where(eq(commercialProductsTable.id,id));
 await pool.end();
}
