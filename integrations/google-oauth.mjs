// Server-only draft. The caller must authenticate the app user before begin,
// keep state in an HttpOnly Secure SameSite=Lax cookie, and encrypt tokens at rest.
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=bytes=>Buffer.from(bytes).toString('base64url');
const un64=value=>Buffer.from(value,'base64url');
const scope='https://www.googleapis.com/auth/calendar.events.owned';

async function secretKey(secret,crypto){
  if(typeof secret!=='string'||Buffer.from(secret,'base64url').length!==32)throw new Error('OAuth state key must be 32 random bytes');
  return crypto.subtle.importKey('raw',un64(secret),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
function safeOrigin(value){let url=new URL(value);if(url.protocol!=='https:'||url.origin!==value)throw new Error('HTTPS origin required');return url.origin}

export async function beginGoogleAuthorization({origin,clientId,userId,stateKey,crypto=globalThis.crypto,now=Date.now()}){
  safeOrigin(origin);if(!clientId||!userId)throw new Error('Authenticated user and Google client ID required');
  const state=b64(crypto.getRandomValues(new Uint8Array(32)));
  const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=b64(await crypto.subtle.digest('SHA-256',enc.encode(verifier)));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const content=enc.encode(JSON.stringify({state,verifier,userId,origin,expires:now+600000}));
  const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},await secretKey(stateKey,crypto),content);
  const cookie=b64(iv)+'.'+b64(new Uint8Array(sealed));
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [key,value] of Object.entries({client_id:clientId,redirect_uri:origin+'/api/google/callback',response_type:'code',scope,access_type:'offline',prompt:'select_account',state,code_challenge:challenge,code_challenge_method:'S256'}))url.searchParams.set(key,value);
  return {url:url.toString(),stateCookie:cookie};
}

export async function exchangeGoogleCode({origin,clientId,clientSecret,stateKey,stateCookie,returnedState,code,userId,crypto=globalThis.crypto,fetchImpl=fetch,now=Date.now()}){
  safeOrigin(origin);if(!clientId||!clientSecret||!userId||!returnedState||!code||typeof stateCookie!=='string')throw new Error('Missing authorization information');
  let payload;try{const parts=stateCookie.split('.');if(parts.length!==2)throw Error();let plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(parts[0])},await secretKey(stateKey,crypto),un64(parts[1]));payload=JSON.parse(dec.decode(plaintext))}catch{throw new Error('Invalid authorization state')}
  if(payload.expires<now||payload.state!==returnedState||payload.origin!==origin||payload.userId!==userId)throw new Error('Authorization state does not match');
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,code_verifier:payload.verifier,grant_type:'authorization_code',redirect_uri:origin+'/api/google/callback'});
  const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!response.ok)throw new Error('Google authorization exchange failed');
  const result=await response.json();if(!result.access_token)throw new Error('Google returned no access token');
  return result; // Server caller must protect and store this value; never return it to a browser.
}
