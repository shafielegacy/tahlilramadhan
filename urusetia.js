(() => {
  const config = window.urusetiaConfig || {};
  const login = document.getElementById('login');
  const logout = document.getElementById('logout');
  const status = document.getElementById('status');
  const storageKey = 'tahlil-urusetia-session';
  const configured = /^[\w.-]+\.apps\.googleusercontent\.com$/.test(config.clientId || '') &&
    /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint || '');

  if (!configured) {
    status.textContent = 'Log masuk Google belum diaktifkan.';
    return;
  }

  async function request(action, payload) {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      credentials: 'omit',
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error('Endpoint unavailable');
    return response.json();
  }

  function showDashboard(email) {
    document.getElementById('tajuk').textContent = 'Dashboard Urusetia';
    document.getElementById('intro').textContent = 'Log masuk sebagai ' + email;
    document.getElementById('login-actions').style.display = 'none';
    document.getElementById('dashboard').hidden = false;
    status.textContent = 'Akses urusetia disahkan.';
    loadPaymentQueue();
  }


  async function loadPaymentQueue(message = '') {
    const queue = document.getElementById('payment-queue');
    const feedback = document.getElementById('payment-status');
    if (!queue || !feedback) return;
    const session = sessionStorage.getItem(storageKey);
    feedback.textContent = 'Memuatkan bayaran…';
    try {
      const result = await request('tahlilPaymentQueue', { session });
      if (result.status !== 'ok' || !Array.isArray(result.items)) throw new Error('Queue unavailable');
      queue.replaceChildren(...result.items.map(item => paymentForm(item, session, feedback)));
      feedback.textContent = [message, result.items.length ? '' : 'Tiada bayaran menunggu semakan.']
        .filter(Boolean).join(' ');
    } catch {
      feedback.textContent = [message, 'Senarai bayaran tidak dapat dimuatkan. Muat semula halaman.']
        .filter(Boolean).join(' ');
    }
  }

  function paymentForm(item, session, feedback) {
    const form = document.createElement('form');
    const heading = document.createElement('h3');
    heading.textContent = item.name;
    const info = document.createElement('p');
    info.textContent = item.package + ' · ' + item.reference;
    form.append(heading, info);
    if (!/^https:\/\/drive\.google\.com\//.test(item.proof)) {
      const missing = document.createElement('p');
      missing.textContent = 'Pautan bukti bayaran tiada.';
      form.append(missing);
      return form;
    }
    const proof = document.createElement('a');
    proof.href = item.proof;
    proof.target = '_blank';
    proof.rel = 'noopener noreferrer';
    proof.textContent = 'Buka bukti bayaran';
    const label = document.createElement('label');
    label.textContent = ' Amaun disahkan (RM) ';
    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '0.01';
    amount.step = '0.01';
    amount.required = true;
    label.append(amount);
    const button = document.createElement('button');
    button.className = 'button';
    button.type = 'submit';
    button.textContent = 'Sahkan Bayaran';
    form.append(proof, label, button);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!confirm('Sahkan bayaran RM' + amount.valueAsNumber.toFixed(2) + ' untuk ' + item.name + '?')) return;
      button.disabled = true;
      try {
        const result = await request('tahlilApprovePayment', {
          session, reference: item.reference, amount: amount.valueAsNumber
        });
        if (result.status !== 'ok' && result.status !== 'already_approved') throw new Error('Approval failed');
        await loadPaymentQueue('Resit ' + result.receipt + ' sedia untuk AutoCrat.');
      } catch {
        feedback.textContent = 'Pengesahan belum dapat dipastikan. Cuba semula.';
        button.disabled = false;
      }
    });
    return form;
  }

  async function completeLogin(response) {
    try {
      if (!response.code) throw new Error('Missing authorization code');
      status.textContent = 'Mengesahkan akses urusetia…';
      const result = await request('urusetiaGooglePopup', { code: response.code });
      if (result.status === 'denied') {
        status.textContent = 'Akaun Google ini tiada akses urusetia.';
        return;
      }
      if (result.status !== 'ok' || typeof result.email !== 'string' || !result.session) {
        throw new Error('Authorization failed');
      }
      sessionStorage.setItem(storageKey, result.session);
      showDashboard(result.email);
    } catch {
      status.textContent = 'Akses urusetia tidak dapat disahkan. Sila cuba lagi.';
    } finally {
      login.disabled = false;
    }
  }

  logout.addEventListener('click', async () => {
    const session = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
    logout.disabled = true;
    try {
      if (session) await request('urusetiaSignOut', { session });
    } finally {
      location.replace(location.pathname);
    }
  });

  async function start() {
    const session = sessionStorage.getItem(storageKey);
    if (session) {
      try {
        const result = await request('urusetiaSession', { session });
        if (result.status === 'ok' && typeof result.email === 'string') showDashboard(result.email);
        else sessionStorage.removeItem(storageKey);
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onerror = () => { status.textContent = 'Log masuk Google gagal dimuatkan.'; };
    script.onload = () => {
      const client = google.accounts.oauth2.initCodeClient({
        client_id: config.clientId,
        scope: 'openid email',
        ux_mode: 'popup',
        select_account: true,
        callback: completeLogin,
        error_callback: () => {
          login.disabled = false;
          status.textContent = 'Tetingkap Google tidak selesai. Sila cuba lagi.';
        }
      });
      login.disabled = false;
      login.addEventListener('click', () => {
        login.disabled = true;
        client.requestCode();
      });
    };
    document.head.appendChild(script);
  }

  start();
})();
