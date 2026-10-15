import { createHash } from "node:crypto";
import { META_GRAPH_VERSION } from "../../lib/meta-graph.constants.js";
export const INSTAGRAM_LOGIN_SCOPES = ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_comments", "instagram_business_manage_messages", "instagram_business_manage_insights"];
export const instagramTokenFingerprint = (token: string) => createHash("sha256").update(token).digest("hex");
async function checkedJson(response: Response): Promise<Record<string, any>> {
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || body.error) throw new Error("Instagram rejected the credential exchange. Reconnect the professional account.");
  return body;
}
export async function exchangeInstagramLoginCode(code: string, clientId: string, secret: string, redirectUri: string) {
  const form = new FormData();
  for (const [key, value] of Object.entries({client_id:clientId,client_secret:secret,grant_type:"authorization_code",redirect_uri:redirectUri,code:code.replace(/#_$/, "")})) form.set(key,value);
  const shortBody = await checkedJson(await fetch("https://api.instagram.com/oauth/access_token",{method:"POST",body:form,signal:AbortSignal.timeout(15000)}));
  const short = shortBody.data?.[0] ?? shortBody;
  if (typeof short.access_token !== "string") throw new Error("Instagram did not return a credential.");
  const url = new URL("https://graph.instagram.com/access_token");
  url.search = new URLSearchParams({grant_type:"ig_exchange_token",client_secret:secret,access_token:short.access_token}).toString();
  const long = await checkedJson(await fetch(url,{signal:AbortSignal.timeout(15000)}));
  if (typeof long.access_token !== "string" || !(Number(long.expires_in)>0)) throw new Error("Instagram did not return a long-lived credential.");
  const profileUrl = new URL(`https://graph.instagram.com/${META_GRAPH_VERSION}/me`);
  profileUrl.search = new URLSearchParams({fields:"user_id,username",access_token:long.access_token}).toString();
  const profile = await checkedJson(await fetch(profileUrl,{signal:AbortSignal.timeout(15000)}));
  const accountId = String(profile.user_id ?? profile.id ?? "");
  if (!accountId || typeof profile.username !== "string") throw new Error("Instagram professional account identity is missing.");
  return { accessToken: long.access_token as string, tokenExpiresAt:new Date(Date.now()+Number(long.expires_in)*1000), accountId, accountName:`@${profile.username}`,
    metadata:{authType:"instagram_login",igAccountId:accountId,igUsername:profile.username,tokenFingerprint:instagramTokenFingerprint(long.access_token),tokenIssuedAt:new Date().toISOString(),grantedScopes:short.permissions??[]} };
}
/** Only a stored direct-login credential may change the Graph host. */
export function directInstagramRequest(input: string | URL, init: RequestInit | undefined, token: string, accountId?: string): {url:URL;init:RequestInit} {
  const url = new URL(input.toString());
  if (!["graph.facebook.com","graph.instagram.com"].includes(url.hostname)) throw new Error("Unsupported Instagram Graph host");
  url.hostname="graph.instagram.com";
  if(accountId && /\/me\/messages$/.test(url.pathname))url.pathname=url.pathname.replace(/\/me\/messages$/,`/${encodeURIComponent(accountId)}/messages`);
  if(url.searchParams.has("access_token"))url.searchParams.set("access_token",token);
  const next={...init};
  const headers=new Headers(next.headers);
  if(headers.has("authorization"))headers.set("authorization",`Bearer ${token}`);
  next.headers=headers;
  if(next.body instanceof URLSearchParams){next.body=new URLSearchParams(next.body);if(next.body.has("access_token"))next.body.set("access_token",token);}
  else if(typeof next.body==="string") {try{const body=JSON.parse(next.body);if(body.access_token){body.access_token=token;next.body=JSON.stringify(body);}}catch{/* non-JSON bodies are unchanged */}}
  return {url,init:next};
}

/** Profile ping for credentials created by Instagram Login (not Facebook Login). */
export function directInstagramProfileRequest(token: string): {url:URL;init:RequestInit} {
  const url = new URL(`https://graph.instagram.com/${META_GRAPH_VERSION}/me`);
  url.search = new URLSearchParams({fields:"user_id,username",access_token:token}).toString();
  return directInstagramRequest(url, undefined, token);
}
