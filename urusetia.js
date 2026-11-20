(() => {
  const config = window.urusetiaConfig || {};
  const redirectUri = 'https://shafielegacy.github.io/tahlilramadhan/urusetia.html';
  const storageKey = 'tahlil-urusetia-oauth';
  const login = document.getElementById('login');
  const status = document.getElementById('status');
  const params = new URLSearchParams(location.search);
  const configured = /^[\w.-]+\.apps\.googleusercontent\.com$/.test(config.clientId || '') &&
    /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint || '');

  function base64url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  if (params.has('code') || params.has('error') || params.has('state')) {
    history.replaceState(null, '', location.pathname);
  }
  if (!configured) {
    status.textContent = 'Log masuk Google belum diaktifkan.';
    return;
  }

  login.disabled = false;
  status.textContent = '';
  login.addEventListener('click', async () => {
    login.disabled = true;
    try {
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      sessionStorage.setItem(storageKey, JSON.stringify({ state, verifier, createdAt: Date.now() }));
      const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorize.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email',
        prompt: 'select_account',
        state,
        code_challenge: base64url(new Uint8Array(digest)),
        code_challenge_method: 'S256'
      });
      location.assign(authorize.href);
    } catch {
      status.textContent = 'Log masuk tidak dapat dimulakan. Sila cuba lagi.';
      login.disabled = false;
    }
  });

  document.getElementById('logout').addEventListener('click', () => location.replace(location.pathname));

  async function completeLogin() {
    login.disabled = true;
    status.textContent = 'Mengesahkan akses urusetia…';
    try {
      const attempt = JSON.parse(sessionStorage.getItem(storageKey));
      sessionStorage.removeItem(storageKey);
      if (!attempt || params.get('state') !== attempt.state || Date.now() - attempt.createdAt > 600000 || !params.get('code')) {
        status.textContent = 'Log masuk tidak lengkap. Sila cuba lagi.';
        return;
      }
      const response = await fetch(config.endpoint, {
        method: 'POST',
        credentials: 'omit',
        body: JSON.stringify({ action: 'urusetiaSignIn', code: params.get('code'), verifier: attempt.verifier }),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('OAuth endpoint unavailable');
      const result = await response.json();
      if (result.status === 'denied') {
        status.textContent = 'Akaun Google ini tiada akses urusetia.';
        return;
      }
      if (result.status !== 'ok' || typeof result.email !== 'string') throw new Error('OAuth request failed');
      document.getElementById('tajuk').textContent = 'Dashboard Urusetia';
      document.getElementById('intro').textContent = 'Log masuk sebagai ' + result.email;
      document.getElementById('login-actions').hidden = true;
      document.getElementById('dashboard').hidden = false;
      status.textContent = 'Akses urusetia disahkan.';
    } catch {
      status.textContent = 'Akses urusetia tidak dapat disahkan. Sila cuba lagi.';
    } finally {
      login.disabled = false;
    }
  }

  if (params.has('code') || params.has('error')) completeLogin();
})();
