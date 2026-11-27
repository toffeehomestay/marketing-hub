// Experimental: do not deploy until authentication, access policies, and sync are tested.
const status = document.querySelector('#login-status');
const config = window.MARKETING_HUB_CONFIG;
const app = document.querySelector('.app');
const login = document.querySelector('#login');
const bar = document.querySelector('#cloud-bar');
const cloudStatus = document.querySelector('#cloud-status');
const form = document.querySelector('#login-form');
let cloud, auth, client, initialized = false;

async function activate() {
  if (initialized) return;
  initialized = true;
  try {
    cloud = await createCloudWorkspace(client, message => { cloudStatus.textContent = message; });
    const remote = await cloud.load();
    // Existing browser-only data is never automatically uploaded or replaced.
    data = remote || {clients:[],projects:[],tasks:[],resources:[],content:[],notes:[]};
    save = function () {
      try { cloud.queue(data); render(); return true; }
      catch (error) { alert('Chưa thể lưu: '+error.message); return false; }
    };
    render();
    login.style.display = 'none'; app.style.display = 'flex'; bar.style.display = 'flex';
    cloudStatus.textContent = remote ? 'Đã tải dữ liệu' : 'Không gian mới';
  } catch (error) {
    initialized = false;
    status.textContent = 'Không tải được dữ liệu. Kiểm tra cấu hình và quyền truy cập trước khi dùng.';
    console.error(error);
  }
}

async function start() {
  if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
    status.textContent = 'Website chưa được cấu hình. Vui lòng liên hệ người thiết lập.';
    form.querySelector('button').disabled = true;
    return;
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl)) throw new Error('Invalid Supabase URL');
  const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm');
  client = createClient(config.supabaseUrl, config.supabasePublishableKey);
  auth = createAuthController(client, {
    hasUnsaved: () => cloud?.hasUnsaved(),
    onSignedOut: () => { app.style.display='none';bar.style.display='none';login.style.display='grid';initialized=false;data={clients:[],projects:[],tasks:[],resources:[],content:[],notes:[]}; },
    onSignedIn: () => { setTimeout(() => void activate(), 0); }
  });
  auth.onChange();
  form.onsubmit = async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try { await auth.requestLogin(form.elements.namedItem('email').value, new URL('secure.html', location.href).href); status.textContent='Hãy kiểm tra email để mở liên kết đăng nhập.'; }
    catch { status.textContent='Không gửi được liên kết. Kiểm tra email và cấu hình đăng nhập.'; }
    finally { button.disabled = false; }
  };
  document.querySelector('#logout').onclick = async () => { try { await auth.signOut(); } catch (e) { alert(e.message); } };
  const {data: session, error} = await client.auth.getSession();
  if (error) throw error;
  if (session.session) await activate();
}
window.addEventListener('beforeunload', e => { if (cloud?.hasUnsaved()) { e.preventDefault(); e.returnValue=''; } });
start().catch(error => { console.error(error); status.textContent='Không thể khởi động kết nối an toàn.'; });
