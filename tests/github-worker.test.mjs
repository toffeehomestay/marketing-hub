import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
globalThis.crypto ||= webcrypto;
const source=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const env={DB:{},ASSETS:{fetch:async()=>new Response('asset')},GITHUB_CLIENT_ID:'example',GITHUB_CLIENT_SECRET:'example',SESSION_SECRET:'test-session-secret-more-than-32-characters',GITHUB_OWNER_ID:'123',APP_ORIGIN:'https://example.test'};
test('fails closed without configuration',async()=>{assert.equal((await worker.fetch(new Request('https://example.test/api/session'),{})).status,503)});
test('rejects writes without a session',async()=>{let res=await worker.fetch(new Request('https://example.test/api/workspace',{method:'PUT',headers:{origin:'https://example.test'},body:'{}'}),env);assert.equal(res.status,401)});
test('rejects cross-origin changes',async()=>{let res=await worker.fetch(new Request('https://example.test/api/logout',{method:'POST',headers:{origin:'https://evil.test'}}),env);assert.equal(res.status,403)});
test('rejects callback without a valid signed state',async()=>{let res=await worker.fetch(new Request('https://example.test/auth/callback?state=x&code=y'),env);assert.equal(res.status,302);assert.equal(res.headers.get('location'),'/?login=failed')});
test('login uses configured GitHub OAuth callback and state cookie',async()=>{let res=await worker.fetch(new Request('https://example.test/auth/login'),env);assert.equal(res.status,302);let url=new URL(res.headers.get('location'));assert.equal(url.origin,'https://github.com');assert.equal(url.searchParams.get('redirect_uri'),'https://example.test/auth/callback');assert.match(res.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/)});
test('session allows only the configured GitHub account',async()=>{
  const to64=b=>Buffer.from(b).toString('base64url');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  async function signed(id){let body=to64(JSON.stringify({sub:id,exp:Date.now()+60000}));return body+'.'+to64(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)))}
  for(const [id,allowed] of [['123',true],['456',false]]){let value=await signed(id);let res=await worker.fetch(new Request('https://example.test/api/session',{headers:{cookie:'mh_session='+value}}),env);assert.equal((await res.json()).authenticated,allowed)}
});
