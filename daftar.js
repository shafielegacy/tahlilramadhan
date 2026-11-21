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
  const assisted = new URLSearchParams(location.search).get('bantuan') === '1';
  let session = '';
  let seasonId = '1448H';
  let seasonVersion = 0;

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

  // Usability guard only: the Apps Script backend MUST independently validate bytes,
  // size, MIME, and permissions. Browser checks are never a security boundary.
  async function recognisedProof(file) {
    if (!file || file.size < 8 || file.size > 3 * 1024 * 1024) return false;
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const png = bytes.every((byte, i) => byte === [137, 80, 78, 71, 13, 10, 26, 10][i]);
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const pdf = bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 &&
      bytes[3] === 70 && bytes[4] === 45;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (png) return ext === 'png' && (!file.type || file.type === 'image/png');
    if (jpg) return ['jpg', 'jpeg'].includes(ext) && (!file.type || file.type === 'image/jpeg');
    if (pdf) return ext === 'pdf' && (!file.type || file.type === 'application/pdf');
    return false;
  }

  function showAssistedSignIn() {
    // This is navigation, not Google OAuth: use an ordinary secondary button.
    login.classList.remove('google-signin-3d');
    login.classList.add('button', 'secondary');
    login.textContent = 'Ke Dashboard Urusetia';
    login.hidden = false;
    login.onclick = () => { location.href = './urusetia.html'; };
  }

  async function loadPackages() {
    try {
      if (assisted) {
        field('registration-title').textContent = 'Daftar Bagi Pihak Peserta';
        const back = field('registration-back');
        back.href = './urusetia.html';
        back.textContent = '← Dashboard Urusetia';
        session = sessionStorage.getItem('tahlil-urusetia-session') || '';
        if (!session || (await request({ action: 'urusetiaSession', session })).status !== 'ok') {
          status.textContent = 'Log masuk sebagai urusetia untuk sambung.';
          showAssistedSignIn();
          return;
        }
      }
      const result = await request({ action: 'tahlilPackages' });
      if (result.status !== 'ok' || !Array.isArray(result.packages)) throw Error('Status unavailable');
      const season = result.season;
      if (season && /^\d{4}H$/.test(season.id)) {
        seasonId = season.id; seasonVersion = season.version;
        field('registration-title').textContent = (assisted ? 'Daftar Bagi Pihak Peserta · ' : 'Pendaftaran Tahlil · ') + season.name;
        document.querySelectorAll('[data-season-name]').forEach(el => { el.textContent = season.name; });
        document.title = 'Pendaftaran Tahlil · ' + season.name;
        const windowLabel = field('registration-window');
        if (windowLabel) windowLabel.textContent = season.opensAt && season.closesAt
          ? 'Buka: ' + season.opensAt.replace('T',' ') + ' · Tutup: ' + season.closesAt.replace('T',' ') + ' (waktu Malaysia).'
          : 'Tarikh pendaftaran ditentukan oleh urusetia.';
      }
      if (result.open !== true || !result.packages.length) {
        login.hidden = true; form.hidden = true;
        status.textContent = result.state === 'closed' ? 'Pendaftaran telah ditutup.'
          : result.state === 'paused' ? 'Pendaftaran ditutup sementara oleh urusetia.'
          : 'Pendaftaran belum dibuka.';
        return;
      }
      for (const item of result.packages) field('packageId').add(new Option(item.name, item.id));
      if (assisted) {
        field('email').readOnly = false;
        field('registration-email-label').textContent = 'E-mel peserta untuk resit';
        status.textContent = '';
        form.hidden = false;
      } else {
        setupGoogleLogin();
      }
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
    if (!proof || !(await recognisedProof(proof))) {
      status.textContent = 'Bukti bayaran mesti fail JPG, PNG atau PDF sah dan tidak melebihi 3 MB.';
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
      const result = await request({
        action: assisted ? 'tahlilAssistedRegister' : 'tahlilRegister',
        ...details, ...(assisted ? { email: field('email').value } : {}), seasonId, seasonVersion, session, key, mime: proof.type, file
      });
      if (result.status === 'ok') {
        outcome = 'Permohonan diterima';
        form.hidden = true;
        status.textContent = 'Pendaftaran diterima dan sedang menunggu semakan. No. rujukan ' + result.reference;
      } else if (result.status === 'login_required' || result.status === 'denied') {
        form.hidden = true;
        if (assisted) showAssistedSignIn();
        else login.hidden = false;
        status.textContent = 'Sesi tamat. Log masuk semula untuk teruskan.';
      } else if (result.status === 'season_changed') {
        form.hidden = true; login.hidden = true;
        status.textContent = 'Sesi pendaftaran telah berubah. Muat semula halaman dan semak pakej sebelum menghantar semula.';
      } else if (result.status === 'rate_limited') {
        status.textContent = 'Terlalu banyak cubaan. Tunggu satu minit dan cuba semula.';
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
