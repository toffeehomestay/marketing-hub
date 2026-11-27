/* Work in progress: this file is not loaded by the prototype and must not be deployed yet. */
async function createCloudWorkspace(client, onStatus) {
  let revision = 0, pending = null, saving = false, halted = false;
  const valid = value => value && ['clients','projects','tasks','resources','content','notes'].every(k => Array.isArray(value[k]));
  async function load() {
    const {data: session} = await client.auth.getSession();
    if (!session.session) throw new Error('Bạn cần đăng nhập.');
    const {data: rows, error} = await client.rpc('load_workspace');
    if (error) throw error;
    if (!rows.length) { revision = 0; return null; }
    if (!valid(rows[0].data)) throw new Error('Dữ liệu trên máy chủ không hợp lệ.');
    revision = rows[0].revision;
    return rows[0].data;
  }
  async function flush() {
    if (saving || halted || !pending) return;
    saving = true;
    const snapshot = pending;
    pending = null;
    onStatus('Đang lưu…');
    let rows, error;
    try { ({data: rows, error} = await client.rpc('save_workspace', {expected_revision: revision, new_data: snapshot})); }
    catch (exception) { error = exception; }
    saving = false;
    if (error || !rows?.length) {
      halted = true;
      pending = pending || snapshot;
      onStatus('Chưa lưu lên máy chủ. Hãy xuất bản sao dữ liệu trước khi tải lại hoặc đăng xuất.');
      return;
    }
    revision = rows[0].revision;
    if (pending) await flush(); else onStatus('Đã lưu');
  }
  function queue(value) {
    if (!valid(value)) throw new Error('Dữ liệu không hợp lệ.');
    pending = structuredClone(value);
    void flush();
  }
  return {load, queue, hasUnsaved: () => !!pending || saving || halted};
}
