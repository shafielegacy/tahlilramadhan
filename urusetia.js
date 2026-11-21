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


  let selectedSeasonId = '';
  let activeSeasonId = '';
  let followActiveSeason = true;
  let seasonDiscoveryReady = false;
  let seasonRecords = [];
  let creatingSeason = false;
  let seasonSavePending = false;
  const seasonField = id => document.getElementById(id);
  const seasonFeedback = seasonField('season-status');
  const seasonView = seasonField('season-view');
  const seasonEdit = seasonField('season-edit');
  function fillSeasonForm() {
    const item = seasonRecords.find(s => s.id === seasonEdit.value);
    if (!item) return;
    creatingSeason = false;
    seasonField('season-id').value = item.id;
    seasonField('season-id').disabled = true;
    seasonField('season-name').value = item.name;
    seasonField('season-opens').value = item.opensAt || '';
    seasonField('season-closes').value = item.closesAt || '';
    for (const [id, value] of [['season-enabled',item.enabled],['season-active',item.active],['season-receipt',item.receiptReady]]) {
      seasonField(id).checked = value === true;
      seasonField(id).disabled = false;
    }
    seasonFeedback.textContent = item.legacy
      ? 'Tarikh belum ditetapkan. Pendaftaran sesi 1448H masih mengikut status sedia ada sehingga tetapan disimpan.'
      : 'Sesi ' + item.id + ' · versi tetapan ' + item.version + '. Semua masa ialah waktu Malaysia.';
  }
  function updateSeasonLabel() {
    const item = seasonRecords.find(s => s.id === selectedSeasonId);
    seasonField('season-view-label').textContent = item
      ? 'Paparan rekod: ' + item.name + (item.active ? ' · Sesi aktif' : ' · Arkib')
      : 'Paparan rekod: ' + selectedSeasonId;
  }
  async function loadSeasonSettings() {
    if (!seasonView || !seasonEdit) return false;
    seasonDiscoveryReady = false;
    try {
      const result = await request('tahlilSeasonList', {session:sessionStorage.getItem(storageKey)});
      if (result.status !== 'ok' || !Array.isArray(result.items) || !result.items.length) throw Error('Unavailable');
      seasonRecords = result.items;
      activeSeasonId = result.activeId || '';
      if (followActiveSeason || !seasonRecords.some(s => s.id === selectedSeasonId)) selectedSeasonId = activeSeasonId;
      seasonView.replaceChildren(...seasonRecords.map(s => new Option(s.name + (s.active ? ' · Aktif' : ' · Arkib'),s.id)));
      seasonEdit.replaceChildren(...seasonRecords.map(s => new Option(s.name,s.id)));
      seasonView.value = selectedSeasonId;
      seasonEdit.value = activeSeasonId || result.items[0].id;
      seasonField('season-view-wrap').hidden = false;
      seasonField('season-form').hidden = false;
      seasonField('season-new').disabled = false;
      seasonField('season-save').disabled = false;
      seasonDiscoveryReady = true;
      seasonView.disabled = false;
      fillSeasonForm(); updateSeasonLabel();
      return true;
    } catch {
      seasonField('season-view-wrap').hidden = false;
      seasonView.disabled = true;
      seasonField('payment-queue').replaceChildren();
      seasonField('history-results').replaceChildren();
      seasonField('season-view-label').textContent = 'Sesi belum dapat disahkan. Tekan Muat Semula Sesi untuk cuba lagi.';
      seasonField('season-form').hidden = true;
      seasonField('season-new').disabled = true;
      seasonFeedback.textContent = 'Tetapan sesi belum dapat dimuatkan. Cuba muat semula halaman.';
      return false;
    }
  }
  seasonView?.addEventListener('change', async () => {
    if (!seasonRecords.some(s => s.id === seasonView.value)) return;
    selectedSeasonId = seasonView.value;
    followActiveSeason = selectedSeasonId === activeSeasonId;
    updateSeasonLabel();
    await Promise.all([loadPaymentQueue(),loadReceiptHistory(0,'')]);
  });
  seasonField('season-retry')?.addEventListener('click', async () => {
    if (await loadSeasonSettings()) await Promise.all([loadPaymentQueue(),loadReceiptHistory(0,'')]);
  });
  seasonEdit?.addEventListener('change', fillSeasonForm);
  seasonField('season-new')?.addEventListener('click', () => {
    creatingSeason = true;
    seasonField('season-id').disabled = false;
    for (const id of ['season-id','season-name','season-opens','season-closes']) seasonField(id).value = '';
    for (const id of ['season-enabled','season-active','season-receipt']) {
      seasonField(id).checked = false; seasonField(id).disabled = true;
    }
    seasonFeedback.textContent = 'Sesi baharu akan dicipta tertutup. Pakej disalin daripada ' + seasonEdit.value + '.';
    seasonField('season-id').focus();
  });
  function confirmSeasonSave(message) {
    const dialog = seasonField('season-confirm-dialog');
    if (!dialog) return Promise.resolve(window.confirm(message));
    seasonField('season-confirm-message').textContent = message;
    dialog.returnValue = '';
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'save'), {once:true});
      dialog.showModal();
    });
  }
  seasonField('season-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (seasonSavePending) return;
    const current = seasonRecords.find(s => s.id === seasonEdit.value);
    const payload = {
      session:sessionStorage.getItem(storageKey), create:creatingSeason,
      copyFrom:seasonEdit.value, id:seasonField('season-id').value.trim(),
      name:seasonField('season-name').value.trim(),
      opensAt:seasonField('season-opens').value, closesAt:seasonField('season-closes').value,
      enabled:seasonField('season-enabled').checked, activate:seasonField('season-active').checked,
      receiptReady:seasonField('season-receipt').checked, version:creatingSeason ? 0 : current?.version,
      expectedActiveId:activeSeasonId || null, expectedActiveVersion:seasonRecords.find(s => s.id === activeSeasonId)?.version ?? null
    };
    if (!/^\d{4}H$/.test(payload.id) || !payload.name || !payload.opensAt || !payload.closesAt || payload.opensAt >= payload.closesAt) {
      seasonFeedback.textContent = 'Semak ID sesi, nama dan tarikh. Masa tutup mesti selepas masa buka.'; return;
    }
    const message = creatingSeason
      ? 'Cipta ' + payload.name + ' dalam keadaan tertutup, dengan pakej daripada ' + payload.copyFrom + '?'
      : 'Simpan tetapan ' + payload.name + '? ' + (payload.activate ? 'Sesi ini akan menjadi sesi aktif. ' : '') +
        'Buka: ' + payload.opensAt.replace('T',' ') + ', tutup: ' + payload.closesAt.replace('T',' ') + ' (waktu Malaysia).';
    seasonSavePending = true;
    if (!await confirmSeasonSave(message)) { seasonSavePending = false; return; }
    const button = seasonField('season-save'); button.disabled = true;
    seasonFeedback.textContent = 'Menyimpan tetapan…';
    try {
      const result = await request('tahlilSeasonSave', payload);
      if (result.status === 'conflict') {
        seasonFeedback.textContent = 'Tetapan sudah berubah atau ID sesi telah digunakan. Muat semula halaman sebelum menyimpan lagi.'; return;
      }
      if (result.status === 'schema_conflict') {
        seasonFeedback.textContent = 'Kolum rekod bertembung dengan tetapan lain. Hubungi pemilik sistem untuk semakan sebelum menyediakan job resit.'; return;
      }
      if (result.status !== 'ok') throw Error('Save failed');
      if (await loadSeasonSettings()) await Promise.all([loadPaymentQueue(),loadReceiptHistory(0,'')]);
      seasonFeedback.textContent = 'Tetapan sesi disimpan. Semak sesi aktif dan status pendaftaran sebelum berkongsi pautan.';
    } catch { seasonFeedback.textContent = 'Tetapan belum dapat disahkan. Muat semula halaman untuk semak hasil sebelum cuba lagi.'; }
    finally { seasonSavePending = false; button.disabled = false; }
  });

  async function showDashboard(email) {
    document.querySelector('.auth-shell')?.classList.add('is-authenticated');
    document.getElementById('tajuk').textContent = 'Dashboard Urusetia';
    document.getElementById('intro').textContent = 'Log masuk sebagai ' + email;
    document.getElementById('login-actions').style.display = 'none';
    document.getElementById('dashboard').hidden = false;
    status.textContent = 'Akses urusetia disahkan.';
    if (!await loadSeasonSettings()) return;
    loadPaymentQueue();
    loadReceiptHistory();
  }


  let queueRequest = 0;
  async function loadPaymentQueue(message = '') {
    const current = ++queueRequest;
    const seasonId = selectedSeasonId;
    const queue = document.getElementById('payment-queue');
    const feedback = document.getElementById('payment-status');
    if (!queue || !feedback) return;
    queue.replaceChildren();
    if (!seasonDiscoveryReady || !seasonId) { feedback.textContent = 'Pilih sesi yang sah untuk memuatkan rekod.'; return; }
    const session = sessionStorage.getItem(storageKey);
    feedback.textContent = 'Memuatkan bayaran…';
    try {
      const result = await request('tahlilPaymentQueue', { session, seasonId });
      if (result.status !== 'ok' || !Array.isArray(result.items)) throw new Error('Queue unavailable');
      if (current !== queueRequest) return;
      queue.replaceChildren(...result.items.map(item => paymentForm(item, session, feedback, seasonId)));
      feedback.textContent = [message, result.items.length ? '' : 'Tiada bayaran menunggu semakan.']
        .filter(Boolean).join(' ');
    } catch {
      if (current !== queueRequest) return;
      feedback.textContent = [message, 'Senarai bayaran tidak dapat dimuatkan. Muat semula halaman.']
        .filter(Boolean).join(' ');
    }
  }

  const paymentDialog = document.getElementById('payment-dialog');
  const paymentTitle = document.getElementById('payment-dialog-title');
  const paymentMessage = document.getElementById('payment-dialog-message');
  const paymentSpinner = document.getElementById('payment-spinner');
  const paymentCancel = document.getElementById('payment-cancel');
  const paymentConfirm = document.getElementById('payment-confirm');

  paymentDialog?.addEventListener('cancel', event => {
    if (!paymentSpinner.hidden) event.preventDefault();
  });

  function showPaymentDialog(title, message, phase) {
    if (!paymentDialog) return;
    paymentTitle.textContent = title;
    paymentMessage.textContent = message;
    paymentSpinner.hidden = phase !== 'loading';
    paymentCancel.hidden = phase === 'loading';
    paymentCancel.textContent = phase === 'result' ? 'Tutup' : 'Batal';
    paymentConfirm.hidden = phase !== 'confirm';
    paymentDialog.returnValue = '';
    if (!paymentDialog.open) paymentDialog.showModal();
    if (phase !== 'loading') paymentCancel.focus();
  }

  function confirmPayment(message) {
    if (!paymentDialog) return Promise.resolve(window.confirm(message));
    return new Promise(resolve => {
      paymentDialog.addEventListener('close', () => {
        resolve(paymentDialog.returnValue === 'confirm');
      }, { once: true });
      showPaymentDialog('Sahkan Bayaran', message, 'confirm');
    });
  }

  // Treat links returned by the API as untrusted data, even for authenticated staff.
  function safeGoogleDocumentUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !['drive.google.com', 'docs.google.com'].includes(url.hostname)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function validPaymentAmount(value) {
    const cents = Math.round(value * 100);
    return Number.isFinite(value) && value <= 100000 && Number.isSafeInteger(cents) &&
      cents >= 1 && value === cents / 100;
  }

  function paymentForm(item, session, feedback, seasonId) {
    const form = document.createElement('form');
    const heading = document.createElement('h3');
    heading.textContent = item.name;
    const info = document.createElement('p');
    info.textContent = item.package + ' · ' + item.reference;
    form.append(heading, info);
    const proofUrl = safeGoogleDocumentUrl(item.proof);
    if (!proofUrl || new URL(proofUrl).hostname !== 'drive.google.com') {
      const missing = document.createElement('p');
      missing.textContent = 'Pautan bukti bayaran tiada.';
      form.append(missing);
      return form;
    }
    const proof = document.createElement('a');
    proof.href = proofUrl;
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
      if (!seasonDiscoveryReady || seasonId !== selectedSeasonId) { feedback.textContent = 'Sesi paparan telah berubah. Semak senarai bayaran semasa.'; return; }
      const approvedAmount = amount.valueAsNumber;
      if (!validPaymentAmount(approvedAmount)) {
        feedback.textContent = 'Amaun tidak sah. Masukkan nilai RM0.01 hingga RM100,000.00 dengan dua tempat perpuluhan.';
        amount.focus();
        return;
      }
      if (!await confirmPayment('Sahkan bayaran RM' + approvedAmount.toFixed(2) + ' untuk ' + item.name + ' (sesi ' + seasonId + ')?')) return;
      if (!seasonDiscoveryReady || seasonId !== selectedSeasonId) { feedback.textContent = 'Sesi paparan telah berubah. Semak semula bayaran.'; return; }
      button.disabled = true;
      showPaymentDialog('Sedang mengesahkan bayaran…', 'Menyimpan pengesahan dan menyediakan nombor resit…', 'loading');
      try {
        const result = await request('tahlilApprovePayment', {
          session, seasonId, reference: item.reference, amount: approvedAmount
        });
        if (result.status === 'receipt_setup_required') {
          const message = 'Semak templat, job dan penapis musim AutoCrat; kemudian tandakan semakan resit dalam Tetapan Sesi.';
          showPaymentDialog('Tetapan resit belum lengkap', message, 'result');
          feedback.textContent = message; button.disabled = false; return;
        }
        if (result.status !== 'ok' && result.status !== 'already_approved') throw new Error('Approval failed');
        const message = 'Resit ' + result.receipt + ' sedia untuk AutoCrat.';
        showPaymentDialog('Bayaran disahkan', message, 'result');
        await Promise.all([loadPaymentQueue(message), loadReceiptHistory()]);
      } catch {
        feedback.textContent = 'Pengesahan belum dapat dipastikan. Cuba semula.';
        showPaymentDialog('Pengesahan belum selesai', feedback.textContent, 'result');
        button.disabled = false;
      }
    });
    return form;
  }


  const historyForm = document.getElementById('history-search');
  const historyQuery = document.getElementById('history-query');
  const historyStatus = document.getElementById('history-status');
  const historyResults = document.getElementById('history-results');
  const historyPrevious = document.getElementById('history-prev');
  const historyNext = document.getElementById('history-next');
  const receiptPageSize = 25;
  let receiptOffset = 0;
  let receiptQuery = '';
  let historyRequest = 0;

  historyForm?.addEventListener('submit', event => {
    event.preventDefault();
    loadReceiptHistory(0, historyQuery.value.trim());
  });
  historyPrevious?.addEventListener('click', () => loadReceiptHistory(Math.max(0, receiptOffset - receiptPageSize)));
  historyNext?.addEventListener('click', () => loadReceiptHistory(receiptOffset + receiptPageSize));

  async function loadReceiptHistory(offset = receiptOffset, query = receiptQuery) {
    if (!historyForm) return;
    const current = ++historyRequest;
    historyStatus.textContent = 'Memuatkan sejarah…';
    historyResults.replaceChildren();
    historyPrevious.hidden = true;
    historyNext.hidden = true;
    if (!seasonDiscoveryReady || !selectedSeasonId) { historyStatus.textContent = 'Pilih sesi yang sah untuk memuatkan rekod.'; return; }
    try {
      const result = await request('tahlilReceiptHistory', {
        session: sessionStorage.getItem(storageKey), seasonId: selectedSeasonId, offset, query
      });
      if (current !== historyRequest) return;
      if (result.status !== 'ok' || !Array.isArray(result.items)) throw new Error('History unavailable');
      receiptOffset = offset;
      receiptQuery = query;
      historyResults.replaceChildren(...result.items.map(receiptHistoryItem));
      historyStatus.textContent = result.items.length
        ? 'Rekod ' + (offset + 1) + '–' + (offset + result.items.length) + ' daripada ' + result.total
        : 'Tiada rekod dijumpai.';
      historyPrevious.hidden = offset === 0;
      historyNext.hidden = offset + receiptPageSize >= result.total;
    } catch {
      if (current === historyRequest) historyStatus.textContent = 'Sejarah belum dapat dimuatkan. Tekan Cari untuk cuba semula.';
    }
  }

  function receiptHistoryItem(item) {
    const row = document.createElement('article');
    row.className = 'history-item';
    const name = document.createElement('h3');
    name.textContent = item.name;
    const details = document.createElement('p');
    details.textContent = [item.email, item.reference, item.package].filter(Boolean).join(' · ');
    const state = document.createElement('p');
    const label = item.sent ? 'Resit Dihantar'
      : item.pdf ? 'PDF Dijana · E-mel Belum Disahkan'
      : item.payment === 'BAYARAN DISAHKAN' ? 'Bayaran Disahkan · Resit Menunggu AutoCrat'
      : item.payment === 'MENUNGGU SEMAKAN' ? 'Menunggu Pengesahan'
      : item.payment;
    state.textContent = [label, item.receipt, item.amount ? 'RM' + item.amount : ''].filter(Boolean).join(' · ');
    row.append(name, details, state);
    const pdfUrl = safeGoogleDocumentUrl(item.pdf);
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Buka PDF';
      row.append(link);
    }
    return row;
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
