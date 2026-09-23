import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, councilActionsTable, councilCyclesTable, councilDecisionsTable, councilMinutesTable, councilOutcomesTable, masterplanVersionsTable, realizationContractsTable, realizationAttemptsTable, realizationEventsTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";
const clean = (v: unknown): unknown => { if (Array.isArray(v)) return v.slice(0,50).map(clean); if (!v || typeof v !== "object") return typeof v === "string" ? v.slice(0,2048) : v; return Object.fromEntries(Object.entries(v as any).slice(0,50).map(([k,x]) => [/token|secret|password|cookie|authorization/i.test(k) ? k : k, /token|secret|password|cookie|authorization/i.test(k) ? "[REDACTED]" : clean(x)])); };
const fail = (status:number,message:string,code:string):never=>{throw new AppError(status,message,code)};
const nonEmptyRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function cycle(workspaceId:string,id:string){const [r]=await db.select().from(councilCyclesTable).where(and(eq(councilCyclesTable.workspaceId,workspaceId),eq(councilCyclesTable.id,id)));if(!r) fail(404,"Council cycle not found","NOT_FOUND");return r;}
async function evidence(w:string,c:typeof councilCyclesTable.$inferSelect,refs:unknown){
  if(!Array.isArray(refs)||refs.length>50)fail(422,"Evidence references must be a bounded array","INVALID_EVIDENCE");
  const boundedRefs=refs as Array<{type:string;id:string}>;
  for(const ref of boundedRefs){
    if(!ref||typeof ref!=="object"||typeof ref.id!=="string"||typeof ref.type!=="string")fail(422,"Evidence reference requires type and id","INVALID_EVIDENCE");
    if(ref.type==="masterplan"){
      if(ref.id!==c.masterplanVersionId)fail(409,"Masterplan evidence is outside exact cycle binding","STALE_EVIDENCE");
    } else if(ref.type==="realization_contract"){
      const [found]=await db.select({id:realizationContractsTable.id}).from(realizationContractsTable).where(and(eq(realizationContractsTable.workspaceId,w),eq(realizationContractsTable.campaignId,c.campaignId),eq(realizationContractsTable.masterplanVersionId,c.masterplanVersionId),eq(realizationContractsTable.contextFingerprint,c.contextFingerprint),eq(realizationContractsTable.snapshotHash,c.snapshotHash),eq(realizationContractsTable.id,ref.id))).limit(1);
      if(!found)fail(409,"Realization evidence is outside exact cycle binding","STALE_EVIDENCE");
    } else fail(422,"Unsupported evidence reference type","INVALID_EVIDENCE");
  }
  return boundedRefs;
}
export async function createCycle(workspaceId:string,userId:string,input:any){
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`council-cycle:${workspaceId}:${input.campaignId}:${input.idempotencyKey}`},0))`);
    const [p]=await tx.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId,workspaceId),eq(masterplanVersionsTable.campaignId,input.campaignId),eq(masterplanVersionsTable.id,input.masterplanVersionId),eq(masterplanVersionsTable.status,"approved"))).limit(1);
    if(!p||p.contextFingerprint!==input.contextFingerprint||p.contentHash!==input.snapshotHash)fail(409,"Approved masterplan binding is stale or invalid","STALE_BINDING");
    const [old]=await tx.select().from(councilCyclesTable).where(and(eq(councilCyclesTable.workspaceId,workspaceId),eq(councilCyclesTable.campaignId,input.campaignId),eq(councilCyclesTable.idempotencyKey,input.idempotencyKey))).limit(1);
    if(old){if(old.masterplanVersionId!==p.id||old.contextFingerprint!==p.contextFingerprint||old.snapshotHash!==p.contentHash)fail(409,"Idempotency key conflict","IDEMPOTENCY_CONFLICT");return old;}
    const [r]=await tx.insert(councilCyclesTable).values({workspaceId,campaignId:input.campaignId,masterplanVersionId:p.id,contextFingerprint:p.contextFingerprint,snapshotHash:p.contentHash,ownerUserId:userId,idempotencyKey:input.idempotencyKey}).returning();return r!;
  });
}
export async function listCycles(w:string,campaignId:string){return db.select().from(councilCyclesTable).where(and(eq(councilCyclesTable.workspaceId,w),eq(councilCyclesTable.campaignId,campaignId))).orderBy(desc(councilCyclesTable.createdAt));}
export async function detail(w:string,id:string){const c=await cycle(w,id);const [minutes,decisions]=await Promise.all([db.select().from(councilMinutesTable).where(and(eq(councilMinutesTable.workspaceId,w),eq(councilMinutesTable.cycleId,id))).orderBy(asc(councilMinutesTable.createdAt)),db.select().from(councilDecisionsTable).where(and(eq(councilDecisionsTable.workspaceId,w),eq(councilDecisionsTable.cycleId,id))).orderBy(asc(councilDecisionsTable.createdAt))]);const ids=decisions.map(d=>d.id);const [actions,outcomes]=ids.length?[await db.select().from(councilActionsTable).where(and(eq(councilActionsTable.workspaceId,w),inArray(councilActionsTable.decisionId,ids))),await db.select().from(councilOutcomesTable).where(and(eq(councilOutcomesTable.workspaceId,w),inArray(councilOutcomesTable.decisionId,ids)))]:[[],[]];return {cycle:c,minutes,decisions,actions,outcomes};}
export async function appendMinute(w:string,userId:string,id:string,input:any){const c=await cycle(w,id);if(typeof input.summary!=="string"||!input.summary.trim()||input.summary.length>4000)fail(422,"Minutes summary is required and bounded","INVALID_MINUTES");const refs=await evidence(w,c,input.evidenceRefs??[]);const [r]=await db.insert(councilMinutesTable).values({workspaceId:w,cycleId:id,authorUserId:userId,summary:input.summary.trim(),evidenceRefs:clean(refs)}).returning();return r;}
export async function createDecision(w:string,userId:string,id:string,input:any){const c=await cycle(w,id);if(typeof input.rationaleSummary!=="string"||!input.rationaleSummary.trim()||input.rationaleSummary.length>4000)fail(422,"Rationale summary is required and bounded","INVALID_DECISION");if(!nonEmptyRecord(input.target)||!nonEmptyRecord(input.baseline)||!nonEmptyRecord(input.threshold)||!nonEmptyRecord(input.window))fail(422,"Decision metric fields must be non-empty objects","INVALID_DECISION");if(typeof input.dueAt!=="string"||Number.isNaN(new Date(input.dueAt).getTime()))fail(422,"A valid dueAt is required","INVALID_DECISION");const refs=await evidence(w,c,input.evidenceRefs??[]);const [r]=await db.insert(councilDecisionsTable).values({workspaceId:w,cycleId:id,ownerUserId:userId,rationaleSummary:input.rationaleSummary.trim(),evidenceRefs:clean(refs),target:clean(input.target),baseline:clean(input.baseline),threshold:clean(input.threshold),window:clean(input.window),dueAt:new Date(input.dueAt),actionRequired:!!input.actionRequired}).returning();return r;}
export async function linkAction(w:string,id:string,input:any){
  if(!["paid_media_pause","paid_media_launch"].includes(input.family))fail(422,"Unsupported action family; no execution permitted","UNSUPPORTED_ACTION");
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`council-action:${w}:${input.idempotencyKey}`},0))`);
    const [d]=await tx.select().from(councilDecisionsTable).where(and(eq(councilDecisionsTable.workspaceId,w),eq(councilDecisionsTable.id,id))).limit(1);
    if(!d)fail(404,"Decision not found","NOT_FOUND");
    if(!d.actionRequired)fail(409,"Decision does not require an action","ACTION_NOT_REQUIRED");
    const c=await cycle(w,d.cycleId);
    const [contract]=await tx.select().from(realizationContractsTable).where(and(eq(realizationContractsTable.workspaceId,w),eq(realizationContractsTable.id,input.realizationContractId),eq(realizationContractsTable.action,input.family),eq(realizationContractsTable.campaignId,c.campaignId),eq(realizationContractsTable.masterplanVersionId,c.masterplanVersionId),eq(realizationContractsTable.contextFingerprint,c.contextFingerprint),eq(realizationContractsTable.snapshotHash,c.snapshotHash))).limit(1);
    if(!contract)fail(409,"Realization contract is outside exact council binding","INVALID_CONTRACT");
    const [existing]=await tx.select().from(councilActionsTable).where(and(eq(councilActionsTable.workspaceId,w),eq(councilActionsTable.idempotencyKey,input.idempotencyKey))).limit(1);
    if(existing){if(existing.family!==input.family||existing.realizationContractId!==contract.id||existing.decisionId!==id)fail(409,"Idempotency key conflict","IDEMPOTENCY_CONFLICT");return existing;}
    const [a]=await tx.insert(councilActionsTable).values({workspaceId:w,decisionId:id,family:input.family,realizationContractId:contract.id,idempotencyKey:input.idempotencyKey}).returning();return a!;
  });
}
export async function verify(w:string,id:string,input:{nextCycleId:string}){
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`council:${w}:${id}`},0))`);
    const [a]=await tx.select().from(councilActionsTable).where(and(eq(councilActionsTable.workspaceId,w),eq(councilActionsTable.id,id))).limit(1);
    if(!a||!a.realizationContractId)fail(404,"Governed action not found","NOT_FOUND");
    const [d]=await tx.select().from(councilDecisionsTable).where(and(eq(councilDecisionsTable.workspaceId,w),eq(councilDecisionsTable.id,a.decisionId))).limit(1);
    const source=await cycle(w,d!.cycleId);
    const [next]=await tx.select().from(councilCyclesTable).where(and(eq(councilCyclesTable.workspaceId,w),eq(councilCyclesTable.id,input?.nextCycleId))).limit(1);
    if(!next||next.id===source.id||next.createdAt<=d!.createdAt||
      next.campaignId!==source.campaignId||next.masterplanVersionId!==source.masterplanVersionId||
      next.contextFingerprint!==source.contextFingerprint||next.snapshotHash!==source.snapshotHash)
      fail(409,"Verification requires a later council cycle with the exact approved binding","INVALID_NEXT_CYCLE");
    const contractId=a.realizationContractId as string;
    const nextMinutes=await tx.select({evidenceRefs:councilMinutesTable.evidenceRefs}).from(councilMinutesTable).where(and(eq(councilMinutesTable.workspaceId,w),eq(councilMinutesTable.cycleId,next.id)));
    if(!nextMinutes.some(m=>Array.isArray(m.evidenceRefs)&&m.evidenceRefs.some((ref:unknown)=>
      !!ref&&typeof ref==="object"&&(ref as {type?:string}).type==="realization_contract"&&(ref as {id?:string}).id===contractId)))
      fail(409,"Next cycle minutes must cite the governed realization contract","NEXT_CYCLE_MINUTES_REQUIRED");
    const [contract]=await tx.select().from(realizationContractsTable).where(and(eq(realizationContractsTable.workspaceId,w),eq(realizationContractsTable.id,contractId))).limit(1);
    const [latest]=await tx.select().from(realizationAttemptsTable).where(and(eq(realizationAttemptsTable.workspaceId,w),eq(realizationAttemptsTable.contractId,contractId))).orderBy(desc(realizationAttemptsTable.number)).limit(1);
    const events=await tx.select().from(realizationEventsTable).where(and(eq(realizationEventsTable.workspaceId,w),eq(realizationEventsTable.contractId,contractId)));
    const qcEvents=events.filter(e=>e.type==="qc"&&e.attemptId===latest?.id);
    const monitorEvents=events.filter(e=>e.type==="monitor"&&e.attemptId===latest?.id);
    const qc=!!latest&&qcEvents.some(e=>(e.details as {passed?:boolean}|null)?.passed===true);
    const monitored=!!latest&&monitorEvents.length>0;
    const verification={contractState:contract?.state??null,attemptId:latest?.id??null,attemptState:latest?.state??null,receipt:!!latest?.receipt,readback:!!latest?.readback,qc,monitored,eventIds:[...qcEvents,...monitorEvents].map(e=>e.id).sort()};
    const verificationFingerprint=fingerprint(verification);
    const [prior]=await tx.select().from(councilOutcomesTable).where(and(eq(councilOutcomesTable.workspaceId,w),eq(councilOutcomesTable.actionId,a.id),eq(councilOutcomesTable.nextCycleId,next.id),eq(councilOutcomesTable.verificationFingerprint,verificationFingerprint))).limit(1);
    if(prior)return prior;
    const verified=contract?.state==="monitored"&&latest?.state==="confirmed"&&!!latest.receipt&&!!latest.readback&&qc&&monitored;
    const [outcome]=await tx.insert(councilOutcomesTable).values({workspaceId:w,decisionId:a.decisionId,actionId:a.id,nextCycleId:next.id,status:verified?"verified":"inconclusive",verificationFingerprint,verification:clean(verification)}).returning();
    return outcome!;
  });
}