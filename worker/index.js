// Draft Cloudflare Worker. Requires an authenticated GitHub OAuth app, a D1
// binding named DB, an ASSETS binding, and server-only runtime secrets.
const encoder = new TextEncoder();
const enc = x => btoa(String.fromCharCode(...x)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(s){try{return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))}catch{return null}}
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function cookie(name,value,age){return `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`}
function getCookie(req,name){return (req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||''}
async function key(env){return crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function seal(payload,env){let body=enc(encoder.encode(JSON.stringify(payload))),sig=await crypto.subtle.sign('HMAC',await key(env),encoder.encode(body));return body+'.'+enc(new Uint8Array(sig))}
async function unseal(value,env){let [body,sig,...extra]=value.split('.');if(!body||!sig||extra.length)return null;let signature=decode(sig),bytes=decode(body);if(!signature||!bytes)return null;try{if(!await crypto.subtle.verify('HMAC',await key(env),signature,encoder.encode(body)))return null;let obj=JSON.parse(new TextDecoder().decode(bytes));return obj.exp>Date.now()?obj:null}catch{return null}}
function nonce(){return enc(crypto.getRandomValues(new Uint8Array(32)))}
function redirect(location, cookies=[]){const h=new Headers({location,'cache-control':'no-store','referrer-policy':'no-referrer'});for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:302,headers:h})}
function validData(data){return !!data&&typeof data==='object'&&!Array.isArray(data)&&['clients','projects','tasks','resources','content','notes'].every(k=>Array.isArray(data[k]))}
function configured(env){return !!(env.DB&&env.ASSETS&&env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&env.SESSION_SECRET?.length>=32&&/^\d+$/.test(env.GITHUB_OWNER_ID||'')&&/^https:\/\/[a-z0-9.-]+$/.test(env.APP_ORIGIN||''))}
async function handle(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(!configured(env))return json({error:'Ứng dụng chưa được cấu hình.'},503);
  if(url.origin!==env.APP_ORIGIN)return json({error:'Invalid origin'},403);
  if(path==='/auth/login'&&request.method==='GET'){
    let state=nonce(),proof=await seal({state,exp:Date.now()+10*60*1000},env);
    let target=new URL('https://github.com/login/oauth/authorize');target.searchParams.set('client_id',env.GITHUB_CLIENT_ID);target.searchParams.set('redirect_uri',url.origin+'/auth/callback');target.searchParams.set('state',state);
    return redirect(target.toString(),[cookie('mh_oauth',proof,600)]);
  }
  if(path==='/auth/callback'&&request.method==='GET'){
    const proof=await unseal(getCookie(request,'mh_oauth'),env),state=url.searchParams.get('state'),code=url.searchParams.get('code');
    const clear=cookie('mh_oauth','',0);
    if(!proof||!state||proof.state!==state||!code)return redirect('/?login=failed',[clear]);
    let tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{'accept':'application/json','content-type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:url.origin+'/auth/callback'})});
    if(!tokenResponse.ok)return redirect('/?login=failed',[clear]);let token=await tokenResponse.json();if(!token.access_token)return redirect('/?login=failed',[clear]);
    let response=await fetch('https://api.github.com/user',{headers:{'user-agent':'Marketing-Hub','authorization':'Bearer '+token.access_token,'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28'}});
    if(!response.ok)return redirect('/?login=failed',[clear]);let user=await response.json();if(String(user.id)!==env.GITHUB_OWNER_ID)return redirect('/?login=denied',[clear]);
    let session=await seal({sub:String(user.id),exp:Date.now()+7*86400000},env);return redirect('/',[clear,cookie('mh_session',session,7*86400)]);
  }
  if(path==='/api/session'&&request.method==='GET'){const session=await unseal(getCookie(request,'mh_session'),env);return json({authenticated:!!session&&session.sub===env.GITHUB_OWNER_ID})}
  if(path.startsWith('/api/')){
    if(request.headers.get('origin')!==url.origin&&request.method!=='GET')return json({error:'Invalid origin'},403);
    let session=await unseal(getCookie(request,'mh_session'),env);if(!session||session.sub!==env.GITHUB_OWNER_ID)return json({error:'Unauthorized'},401);
    if(path==='/api/logout'&&request.method==='POST')return new Response(null,{status:204,headers:{'set-cookie':cookie('mh_session','',0),'cache-control':'no-store'}});
    if(path==='/api/workspace'&&request.method==='GET'){let row=await env.DB.prepare('SELECT payload,revision FROM workspaces WHERE github_id = ?').bind(session.sub).first();if(!row)return json({data:null,revision:0});return json({data:JSON.parse(row.payload),revision:row.revision})}
    if(path==='/api/workspace'&&request.method==='PUT'){
      if((request.headers.get('content-length')&&Number(request.headers.get('content-length'))>2000000))return json({error:'Too large'},413);
      let body;try{let text=await request.text();if(text.length>2000000)return json({error:'Too large'},413);body=JSON.parse(text)}catch{return json({error:'Invalid request'},400)}
      if(!Number.isSafeInteger(body.revision)||body.revision<0||!validData(body.data))return json({error:'Invalid data'},400);
      let payload=JSON.stringify(body.data),result=body.revision===0?await env.DB.prepare('INSERT INTO workspaces (github_id,payload) VALUES (?,?) ON CONFLICT(github_id) DO NOTHING').bind(session.sub,payload).run():await env.DB.prepare('UPDATE workspaces SET payload=?, revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE github_id=? AND revision=?').bind(payload,session.sub,body.revision).run();
      if(!result.meta.changes)return json({error:'Conflict'},409);return json({revision:body.revision+1});
    }
    return json({error:'Not found'},404);
  }
  return env.ASSETS.fetch(request);
}
export default {async fetch(request,env){try{return await handle(request,env)}catch{return json({error:'Server error'},500)}}};
