const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context=vm.createContext({structuredClone});
vm.runInContext(fs.readFileSync('cloud-draft.js','utf8'),context);
const empty=()=>({clients:[],projects:[],tasks:[],resources:[],content:[],notes:[]});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('loads remote data and saves with its revision',async()=>{
  const calls=[];const client={auth:{getSession:async()=>({data:{session:{}}})},rpc:async(name,args)=>{calls.push([name,args]);return name==='load_workspace'?{data:[{data:empty(),revision:4}]}:{data:[{revision:5}]}}};
  const cloud=await context.createCloudWorkspace(client,()=>{});await cloud.load();cloud.queue(empty());await tick();
  assert.equal(calls[1][1].expected_revision,4);assert.equal(cloud.hasUnsaved(),false);
});
test('conflict stops writes and retains pending changes',async()=>{
  let writes=0;const client={auth:{getSession:async()=>({data:{session:{}}})},rpc:async name=>name==='load_workspace'?{data:[]}:(writes++,{error:{code:'40001'}})};
  const cloud=await context.createCloudWorkspace(client,()=>{});await cloud.load();cloud.queue(empty());await tick();cloud.queue(empty());await tick();
  assert.equal(writes,1);assert.equal(cloud.hasUnsaved(),true);
});
test('network exception retains pending changes',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{}}})},rpc:async name=>{if(name==='load_workspace')return {data:[]};throw Error('offline')}};
  const cloud=await context.createCloudWorkspace(client,()=>{});await cloud.load();cloud.queue(empty());await tick();assert.equal(cloud.hasUnsaved(),true);
});
test('rejects loading without a session',async()=>{
  const client={auth:{getSession:async()=>({data:{session:null}})}};
  const cloud=await context.createCloudWorkspace(client,()=>{});await assert.rejects(cloud.load(),/đăng nhập/);
});
