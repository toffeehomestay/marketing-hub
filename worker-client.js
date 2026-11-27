// Draft: requires the corresponding Worker and must not be deployed untested.
(async()=>{
  const status=document.querySelector('#cloud-status'), login=document.querySelector('#login-status');
  let revision=0, pending=null, saving=false, halted=false;
  const empty=()=>({clients:[],projects:[],tasks:[],resources:[],content:[],notes:[]});
  const isDirty=()=>!!pending||saving||halted;
  async function flush(){
    if(saving||halted||!pending)return;
    saving=true;const snapshot=pending;pending=null;status.textContent='Đang lưu…';
    try{
      const response=await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,data:snapshot})});
      if(!response.ok)throw new Error('Save failed');const result=await response.json();revision=result.revision;
    }catch{halted=true;pending=pending||snapshot;status.textContent='Chưa lưu. Hãy xuất bản sao trước khi tải lại hoặc đăng xuất.';}
    finally{saving=false}
    if(!halted&&pending)await flush();else if(!halted)status.textContent='Đã lưu';
  }
  const outcome=new URL(location.href).searchParams.get('login');
  if(outcome)login.textContent=outcome==='denied'?'Tài khoản GitHub này không có quyền truy cập.':'Không thể đăng nhập, vui lòng thử lại.';
  try{
    const s=await fetch('/api/session',{cache:'no-store'});if(!s.ok)throw new Error('Session unavailable');
    if(!(await s.json()).authenticated)return;
    const r=await fetch('/api/workspace',{cache:'no-store'});if(!r.ok)throw new Error('Load failed');const result=await r.json();
    if(result.data&&!['clients','projects','tasks','resources','content','notes'].every(k=>Array.isArray(result.data[k])))throw new Error('Invalid data');
    revision=result.revision;data=result.data||empty();
    save=()=>{try{pending=structuredClone(data);void flush();render();return true}catch{alert('Không thể lưu thay đổi.');return false}};
    render();document.querySelector('#login').style.display='none';document.querySelector('.app').style.display='flex';document.querySelector('#cloud-bar').style.display='flex';status.textContent=result.data?'Đã tải dữ liệu':'Không gian mới';
    document.querySelector('#logout').onclick=async()=>{if(isDirty()){alert('Dữ liệu chưa lưu. Hãy xuất bản sao trước khi tải lại hoặc đăng xuất.');return}try{const response=await fetch('/api/logout',{method:'POST'});if(!response.ok)throw new Error();location.reload()}catch{alert('Không thể đăng xuất. Vui lòng thử lại.')}};
    window.addEventListener('beforeunload',event=>{if(isDirty()){event.preventDefault();event.returnValue=''}});
  }catch{login.textContent='Chưa thể tải dữ liệu. Vui lòng thử lại sau.'}
})();
