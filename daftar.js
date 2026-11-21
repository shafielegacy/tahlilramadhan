(() => {
  const form = document.getElementById('daftar');
  const status = document.getElementById('status');
  const button = form.querySelector('button');
  const dialog = document.getElementById('submission-dialog');
  const dialogTitle = document.getElementById('submission-title');
  const dialogMessage = document.getElementById('submission-message');
  const spinner = document.getElementById('submission-spinner');
  const close = document.getElementById('submission-close');
  const field = id => document.getElementById(id);
  const endpoint = window.urusetiaConfig?.endpoint;
  const key = crypto.randomUUID();
  const login = field('google-login');
  let session = '';

  async function request(data) {
    const response = await fetch(endpoint, {
      method: 'POST', credentials: 'omit', body: JSON.stringify(data),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) throw new Error('HTTP-' + response.status);
    try {
      return await response.json();
    } catch {
      throw new Error('RESPONS');
    }
  }

  async function loadPackages() {
    try {
      const result = await request({ action: 'tahlilPackages' });
      if (result.status !== 'ok' || !result.open || !result.packages.length) {
        status.textContent = 'Pendaftaran belum dibuka.';
        return;
      }
      for (const item of result.packages) field('packageId').add(new Option(item.name, item.id));
      setupGoogleLogin();
    } catch {
      status.textContent = 'Status pendaftaran tidak dapat disemak. Sila cuba semula.';
    }
  }

  function setupGoogleLogin() {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onerror = () => { status.textContent = 'Log masuk Google gagal dimuatkan.'; };
    script.onload = () => {
      const client = google.accounts.oauth2.initCodeClient({
        client_id: window.urusetiaConfig.clientId,
        scope: 'openid email',
        ux_mode: 'popup',
        select_account: true,
        error_callback: () => {
          login.disabled = false;
          status.textContent = 'Log masuk belum selesai. Sila cuba lagi.';
        },
        callback: async ({ code }) => {
          try {
            if (!code) throw new Error('Missing code');
            const result = await request({ action: 'tahlilParticipantSignIn', code });
            if (result.status !== 'ok' || !result.session || !result.email) throw new Error('Sign-in failed');
            session = result.session;
            field('email').value = result.email;
            login.hidden = true;
            status.textContent = '';
            form.hidden = false;
            field('packageId').focus();
          } catch {
            status.textContent = 'Log masuk tidak dapat disahkan. Sila cuba lagi.';
          } finally {
            login.disabled = false;
          }
        }
      });
      status.textContent = 'Log masuk untuk pilih pakej.';
      login.hidden = false;
      login.addEventListener('click', () => {
        login.disabled = true;
        client.requestCode();
      });
    };
    document.head.appendChild(script);
  }

  dialog?.addEventListener('cancel', event => {
    if (button.disabled) event.preventDefault();
  });

  function showSubmissionStatus(title, message, pending = false) {
    if (!dialog) return;
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    spinner.hidden = !pending;
    close.hidden = pending;
    if (!dialog.open) dialog.showModal();
    if (!pending) close.focus();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const proof = field('proof').files[0];
    if (!proof || proof.size > 3 * 1024 * 1024) {
      status.textContent = 'Pilih bukti bayaran yang tidak melebihi 3 MB.';
      return;
    }
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Menghantar pendaftaran…';
    showSubmissionStatus('Sedang menghantar permohonan…', 'Menyediakan bukti bayaran. Sila tunggu.', true);
    let outcome = 'Permohonan belum dapat disahkan';
    try {
      const file = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('FAIL-SLIP'));
        reader.readAsDataURL(proof);
      });
      const details = Object.fromEntries(['packageId', 'name', 'phone', 'names']
        .map(id => [id, field(id).value]));
      if (dialog) dialogMessage.textContent = 'Memuat naik bukti bayaran dan menyimpan permohonan…';
      const result = await request({ action: 'tahlilRegister', ...details, session, key, mime: proof.type, file });
      if (result.status === 'ok') {
        outcome = 'Permohonan diterima';
        form.hidden = true;
        status.textContent = 'Pendaftaran diterima dan sedang menunggu semakan. No. rujukan ' + result.reference;
      } else if (result.status === 'login_required') {
        form.hidden = true;
        login.hidden = false;
        status.textContent = 'Sesi tamat. Log masuk semula untuk teruskan.';
      } else if (result.status === 'closed') {
        form.hidden = true;
        status.textContent = 'Pendaftaran telah ditutup.';
      } else if (result.status === 'invalid') {
        status.textContent = 'Semak maklumat peserta, nama arwah dan format bukti bayaran.';
      } else {
        throw new Error(/^DAFTAR-(PERSEDIAAN|SIBUK|CARIAN|SLIP|REKOD)$/.test(result.code) ? result.code : 'SERVIS');
      }
    } catch (error) {
      const known = /^(HTTP-\d{3}|RESPONS|FAIL-SLIP|SERVIS|DAFTAR-(?:PERSEDIAAN|SIBUK|CARIAN|SLIP|REKOD))$/.test(error.message);
      const code = known ? error.message : error.name === 'TimeoutError' ? 'TAMAT-MASA' : 'SAMBUNGAN';
      status.textContent = 'Pendaftaran belum dapat disahkan (' + code + '). Cuba hantar semula dari halaman ini.';
    } finally {
      form.removeAttribute('aria-busy');
      button.disabled = false;
      showSubmissionStatus(outcome, status.textContent);
    }
  });

  loadPackages();
})();
