/* Draft only: not loaded into the website until Supabase and access policies are tested. */
function createAuthController(client, callbacks) {
  async function signInWithPassword(email, password) {
    if (!email.trim() || !password) throw new Error('Vui lòng nhập email và mật khẩu.');
    const {error} = await client.auth.signInWithPassword({email: email.trim(), password});
    if (error) throw error;
  }
  async function requestLogin(email, redirectUrl) {
    if (!email.trim()) throw new Error('Vui lòng nhập email.');
    const {error} = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {shouldCreateUser: false, emailRedirectTo: redirectUrl}
    });
    if (error) throw error;
  }
  async function currentUser() {
    const {data, error} = await client.auth.getUser();
    if (error) throw error;
    return data.user;
  }
  async function signOut() {
    if (callbacks.hasUnsaved?.()) throw new Error('Dữ liệu chưa được lưu. Hãy xuất bản sao trước khi đăng xuất.');
    const {error} = await client.auth.signOut();
    if (error) throw error;
  }
  function onChange() {
    return client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') callbacks.onSignedOut();
      if (event === 'SIGNED_IN') callbacks.onSignedIn();
    });
  }
  return {requestLogin, signInWithPassword, currentUser, signOut, onChange};
}
