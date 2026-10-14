import assert from 'node:assert/strict';
import {exchangeInstagramLoginCode,directInstagramRequest,INSTAGRAM_LOGIN_SCOPES} from '../modules/integrations/instagram-login.js';
const originalFetch=globalThis.fetch;const calls:{url:URL;init?:RequestInit}[]=[];
globalThis.fetch=async(input,init)=>{
 const url=new URL(String(input));calls.push({url,init});
 if(url.hostname==='api.instagram.com')return Response.json({data:[{access_token:'short-fixture',user_id:'123',permissions:INSTAGRAM_LOGIN_SCOPES.join(',')}]});
 if(url.pathname==='/access_token')return Response.json({access_token:'long-fixture',expires_in:5184000});
 return Response.json({id:'123',user_id:'123',username:'fixture'});
};
try{
 const grant=await exchangeInstagramLoginCode('code#_','instagram-app','instagram-secret','https://example.invalid/callback');
 assert.equal(grant.accountId,'123');assert.equal(grant.metadata.authType,'instagram_login');assert.ok(grant.tokenExpiresAt.getTime()>Date.now()+59*86400000);
 assert.equal((calls[0].init?.body as FormData).get('client_id'),'instagram-app');assert.equal((calls[0].init?.body as FormData).get('code'),'code');
 assert.equal(calls[1].url.hostname,'graph.instagram.com');assert.equal(calls[2].url.searchParams.get('fields'),'user_id,username');
 const body=JSON.stringify({recipient:{id:'reader'},message:{text:'test'},access_token:'old'});
 const request=directInstagramRequest('https://graph.facebook.com/v22.0/me/messages?access_token=old',{method:'POST',body},'new','ig-owner');
 assert.equal(request.url.hostname,'graph.instagram.com');assert.equal(request.url.pathname,'/v22.0/ig-owner/messages');assert.equal(request.init.method,'POST');assert.equal(JSON.parse(String(request.init.body)).access_token,'new');
 assert.equal(request.url.searchParams.get('access_token'),'new');assert.equal(JSON.parse(body).access_token,'old');
 assert.throws(()=>directInstagramRequest('https://example.invalid',{body},'new'),/host/);
 globalThis.fetch=async()=>Response.json({error:{message:'private credential'}},{status:400});
 await assert.rejects(()=>exchangeInstagramLoginCode('c','a','s','https://example.invalid'),/rejected/);
 console.log('PASS Instagram Login: scoped exchange, long-lived identity, Graph host isolation, no credential in errors');
}finally{globalThis.fetch=originalFetch;}
