import { and, eq, sql } from "drizzle-orm";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { instagramTokenFingerprint } from "./instagram-login.js";
/** Credential metadata is persistent; no host is inferred from token prefixes. */
export async function resolveDirectInstagramCredential(token: string): Promise<{token:string;accountId:string} | null> {
  const fingerprint = instagramTokenFingerprint(token);
  const [candidate] = await db.select().from(workspaceIntegrationsTable).where(and(
    eq(workspaceIntegrationsTable.provider,"instagram"),eq(workspaceIntegrationsTable.status,"connected"),
    sql`${workspaceIntegrationsTable.metadata}->>'authType' = 'instagram_login'`,
    sql`(${workspaceIntegrationsTable.metadata}->>'tokenFingerprint' = ${fingerprint} OR ${workspaceIntegrationsTable.metadata}->>'previousTokenFingerprint' = ${fingerprint})`,
  )).limit(1);
  if (!candidate?.accountId) return null;
  return db.transaction(async trx => {
    await trx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.id}))`);
    const [current]=await trx.select().from(workspaceIntegrationsTable).where(and(eq(workspaceIntegrationsTable.id,candidate.id),eq(workspaceIntegrationsTable.status,"connected"))).limit(1);
    if(!current?.accessToken)throw new Error("Reconnect Instagram: credential unavailable.");
    const expires=current.tokenExpiresAt?.getTime() ?? 0;
    if(expires<=Date.now())throw new Error("Reconnect Instagram: credential expired.");
    if(expires>Date.now()+7*86400000)return current.accessToken;
    const metadata=current.metadata as Record<string,unknown>;
    const issued=Date.parse(String(metadata.tokenIssuedAt??""));
    if(Number.isFinite(issued)&&Date.now()-issued<86400000)return current.accessToken;
    const url=new URL("https://graph.instagram.com/refresh_access_token");
    url.search=new URLSearchParams({grant_type:"ig_refresh_token",access_token:current.accessToken}).toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    const refreshed=await response.json().catch(()=>({})) as {access_token?:string;expires_in?:number;error?:unknown};
    if(!response.ok||refreshed.error||typeof refreshed.access_token!=="string"||!(Number(refreshed.expires_in)>0))throw new Error("Instagram credential renewal failed; retry or reconnect.");
    await trx.update(workspaceIntegrationsTable).set({accessToken:refreshed.access_token,tokenExpiresAt:new Date(Date.now()+Number(refreshed.expires_in)*1000),metadata:{...metadata,previousTokenFingerprint:metadata.tokenFingerprint,tokenFingerprint:instagramTokenFingerprint(refreshed.access_token),tokenIssuedAt:new Date().toISOString()}}).where(eq(workspaceIntegrationsTable.id,current.id));
    return refreshed.access_token;
  }).then(token => ({ token, accountId: candidate.accountId! }));
}
