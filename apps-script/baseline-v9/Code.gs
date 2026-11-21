const TAHLIL_URUS_ORIGIN_ = 'https://shafielegacy.github.io';
const TAHLIL_URUS_SESSION_TTL_ = 1800;

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents;
    if (!body || body.length > 4500000) return tahlilAuthResponse_('error');
    const request = JSON.parse(body);
    if (request.action === "tahlilPaymentQueue" || request.action === "tahlilApprovePayment" || request.action === "tahlilReceiptHistory") {
      if (body.length > 4096) return tahlilAuthResponse_("error");
      return tahlilPayment_(request);
    }
    if (request.action === 'tahlilPackages' || request.action === 'tahlilRegister' || request.action === 'tahlilAssistedRegister') {
      try {
        return tahlilRegistration_(request);
      } catch (error) {
        console.error('Tahlil registration setup: ' + (error.name || 'Error'));
        return tahlilRegistrationJson_({ status: 'error', code: 'DAFTAR-PERSEDIAAN' });
      }
    }
    if (body.length > 4096) return tahlilAuthResponse_("error");
    if (request.action === 'urusetiaSession' || request.action === 'urusetiaSignOut') {
      return tahlilSessionRequest_(request);
    }
    const participant = request.action === 'tahlilParticipantSignIn';
    if ((!participant && request.action !== 'urusetiaGooglePopup') ||
        typeof request.code !== 'string' || !/^[!-~]{1,2048}$/.test(request.code)) {
      return tahlilAuthResponse_('error');
    }
    const properties = PropertiesService.getScriptProperties();
    const clientId = properties.getProperty('TAHLIL_GOOGLE_CLIENT_ID');
    const clientSecret = properties.getProperty('TAHLIL_GOOGLE_CLIENT_SECRET');
    const admins = (properties.getProperty('TAHLIL_ADMIN_EMAILS') || '')
      .split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
    if (!clientId || !clientSecret || (!participant && admins.length === 0)) return tahlilAuthResponse_('error');
    const tokenReply = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      payload: {
        grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret,
        code: request.code, redirect_uri: TAHLIL_URUS_ORIGIN_
      },
      muteHttpExceptions: true
    });
    if (tokenReply.getResponseCode() !== 200) return tahlilAuthResponse_('error');
    const token = JSON.parse(tokenReply.getContentText()).access_token;
    if (!token) return tahlilAuthResponse_('error');
    const profileReply = UrlFetchApp.fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
    });
    if (profileReply.getResponseCode() !== 200) return tahlilAuthResponse_('error');
    const profile = JSON.parse(profileReply.getContentText());
    const email = typeof profile.email === 'string' ? profile.email.toLowerCase() : '';
    if (profile.email_verified !== true || !email || (!participant && !admins.includes(email))) return tahlilAuthResponse_('denied');
    const session = Utilities.getUuid() + Utilities.getUuid();
    CacheService.getScriptCache().put((participant ? 'tahlil-peserta:' : 'tahlil-urusetia:') + session, email, TAHLIL_URUS_SESSION_TTL_);
    return tahlilAuthResponse_('ok', email, session);
  } catch (error) {
    console.error('Tahlil request failed: ' + (error.name || 'Error'));
    return tahlilAuthResponse_('error');
  }
}

function tahlilSessionRequest_(request) {
  if (typeof request.session !== 'string' || !/^[0-9a-f-]{72}$/.test(request.session)) {
    return tahlilAuthResponse_('denied');
  }
  const cache = CacheService.getScriptCache();
  const key = 'tahlil-urusetia:' + request.session;
  if (request.action === 'urusetiaSignOut') {
    cache.remove(key);
    return tahlilAuthResponse_('ok');
  }
  const email = cache.get(key);
  const admins = (PropertiesService.getScriptProperties().getProperty('TAHLIL_ADMIN_EMAILS') || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return email && admins.includes(email) ? tahlilAuthResponse_('ok', email) : tahlilAuthResponse_('denied');
}

function tahlilAuthResponse_(status, email, session) {
  const result = { status };
  if (email) result.email = email;
  if (session) result.session = session;
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}


function tahlilRegistration_(request) {
  const ss = SpreadsheetApp.openById('16b0sjKmGw8Yft8NvkKLym6izWyZg4LFXpOYyk9f8PAU');
  const season = '1448H';
  const open = ss.getSheetByName('MUSIM').getDataRange().getDisplayValues().slice(1)
    .some(row => row[0] === season && row[2] === 'DIBUKA');
  const packages = ss.getSheetByName('PAKEJ').getDataRange().getValues().slice(1)
    .filter(row => row[0] === season && row[5] === 'YA' && typeof row[3] === 'number' && row[3] > 0)
    .map(row => ({ id: row[1], name: row[2], price: row[3], limit: Number(row[4]) || 0 }));
  if (request.action === 'tahlilPackages') return tahlilRegistrationJson_({ status: 'ok', open, packages });
  if (!open) return tahlilRegistrationJson_({ status: 'closed' });
  const selected = packages.find(item => item.id === request.packageId);
  const clean = (value, max) => typeof value === 'string' && value.length <= max ? value.trim() : '';
  const name = clean(request.name, 160);
  const assisted = request.action === 'tahlilAssistedRegister';
  const sessionPrefix = assisted ? 'tahlil-urusetia:' : 'tahlil-peserta:';
  const signedInEmail = typeof request.session === 'string' && /^[0-9a-f-]{72}$/.test(request.session)
    ? CacheService.getScriptCache().get(sessionPrefix + request.session) : '';
  if (!signedInEmail) return tahlilRegistrationJson_({ status: 'login_required' });
  if (assisted) {
    const admins = (PropertiesService.getScriptProperties().getProperty('TAHLIL_ADMIN_EMAILS') || '')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(signedInEmail)) return tahlilRegistrationJson_({ status: 'denied' });
  }
  const email = assisted ? clean(request.email, 254) : signedInEmail;
  const phone = clean(request.phone, 35);
  const names = clean(request.names, 10000).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const key = clean(request.key, 40);
  const mime = clean(request.mime, 40);
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
  if (!selected || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?[0-9 ()-]{8,35}$/.test(phone) ||
      !names.length || names.some(value => value.length > 160) || (selected.limit && names.length > selected.limit) ||
      !/^[0-9a-f-]{36}$/.test(key) || !Object.hasOwn(extensions, mime) || typeof request.file !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(request.file) || request.file.length > 4194304) return tahlilRegistrationJson_({ status: 'invalid' });
  const bytes = Utilities.base64Decode(request.file);
  const signatures = { 'image/jpeg': [255,216,255], 'image/png': [137,80,78,71,13,10,26,10], 'application/pdf': [37,80,68,70,45] };
  if (!signatures[mime].every((value, index) => (bytes[index] & 255) === value && index < bytes.length)) {
    return tahlilRegistrationJson_({ status: 'invalid' });
  }
  const previousReference = 'THL-' + season + '-' + key.toUpperCase();
  const reference = 'THL-' + key.replace(/-/g, '').slice(0, 12).toUpperCase();
  const lock = LockService.getScriptLock();
  let stage = 'lock';
  let file;
  try {
    lock.waitLock(15000);
    stage = 'duplicate lookup';
    const sheet = ss.getSheetByName('DAFTAR');
    const references = sheet.getRange('B:B');
    for (const candidate of [previousReference, reference]) {
      if (references.createTextFinder(candidate).matchEntireCell(true).findNext()) {
        return tahlilRegistrationJson_({ status: 'ok', reference: candidate });
      }
    }
    const folderId = '1Ji4yaNHLTjEvefXFYj1Gcy20C-JMjLXQ';
    if (!folderId) return tahlilRegistrationJson_({ status: 'error' });
    stage = 'save slip';
    file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mime, reference + '.' + extensions[mime]));
    const asText = value => "'" + value;
    stage = 'write registration';
    sheet.appendRow([new Date(), reference, season, selected.id, asText(selected.name), selected.price, asText(name), asText(email), asText(phone), asText(names.join('\n')), file.getUrl(), 'MENUNGGU SEMAKAN', assisted ? 'URUSETIA' : 'PESERTA']);
    SpreadsheetApp.flush();
    return tahlilRegistrationJson_({ status: 'ok', reference });
  } catch (error) {
    console.error('Tahlil register failed at ' + stage + ': ' + (error.name || 'Error'));
    if (file) {
      try { file.setTrashed(true); } catch (_) { console.error('Tahlil slip cleanup failed'); }
    }
    const codes = { lock: 'DAFTAR-SIBUK', 'duplicate lookup': 'DAFTAR-CARIAN', 'save slip': 'DAFTAR-SLIP', 'write registration': 'DAFTAR-REKOD' };
    return tahlilRegistrationJson_({ status: 'error', code: codes[stage] || 'DAFTAR-PERSEDIAAN' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function tahlilRegistrationJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}


function tahlilPayment_(request) {
  const session = request.session;
  if (typeof session !== 'string' || !/^[0-9a-f-]{72}$/.test(session)) return tahlilAuthResponse_('denied');
  const email = CacheService.getScriptCache().get('tahlil-urusetia:' + session);
  const admins = (PropertiesService.getScriptProperties().getProperty('TAHLIL_ADMIN_EMAILS') || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!email || !admins.includes(email)) return tahlilAuthResponse_('denied');
  const sheet = SpreadsheetApp.openById('16b0sjKmGw8Yft8NvkKLym6izWyZg4LFXpOYyk9f8PAU').getSheetByName('DAFTAR');
  if (request.action === 'tahlilReceiptHistory') return tahlilReceiptHistory_(sheet, request);
  if (request.action === 'tahlilPaymentQueue') {
    const items = sheet.getDataRange().getDisplayValues().slice(1)
      .filter(row => row[2] === '1448H' && row[11] === 'MENUNGGU SEMAKAN').slice(0, 50)
      .map(row => ({ reference: row[1], package: row[4], price: row[5], name: row[6], proof: row[10] }));
    return tahlilRegistrationJson_({ status: 'ok', items });
  }
  const amount = request.amount;
  const cents = Math.round(amount * 100);
  if (typeof request.reference !== 'string' || !/^THL-(?:1448H-[0-9A-F-]{36}|[0-9A-F]{12})$/.test(request.reference) ||
      typeof amount !== 'number' || !Number.isSafeInteger(cents) || cents < 1 || amount !== cents / 100) {
    return tahlilAuthResponse_('invalid');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const rows = sheet.getDataRange().getValues();
    const index = rows.findIndex((row, i) => i > 0 && row[1] === request.reference && row[2] === '1448H');
    if (index < 1) return tahlilAuthResponse_('invalid');
    const row = rows[index];
    if (row[13]) return tahlilRegistrationJson_({ status: 'already_approved', receipt: row[13] });
    if (row[11] !== 'MENUNGGU SEMAKAN' || !row[7] || !row[10] || row[16] || row[17]) {
      return tahlilAuthResponse_('invalid');
    }
    const maximum = rows.reduce((max, entry) => {
      const match = /^THL-1448H-(\d+)$/.exec(String(entry[13] || ''));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const receipt = 'THL-1448H-' + String(maximum + 1).padStart(4, '0');
    const date = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'dd/MM/yyyy');
    sheet.getRange(index + 1, 12, 1, 7).setValues([['BAYARAN DISAHKAN', row[12], receipt, date, amount, '', 'SEDIA']]);
    SpreadsheetApp.flush();
    return tahlilRegistrationJson_({ status: 'ok', receipt });
  } finally {
    lock.releaseLock();
  }
}

function semakAksesTahlil() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, ['https://www.googleapis.com/auth/drive']);
  const sheet = SpreadsheetApp.openById('16b0sjKmGw8Yft8NvkKLym6izWyZg4LFXpOYyk9f8PAU');
  if (!sheet.getSheetByName('DAFTAR')) throw new Error('Tab DAFTAR tiada');
  DriveApp.getFolderById('1Ji4yaNHLTjEvefXFYj1Gcy20C-JMjLXQ').getName();
  console.log('Akses Sheets dan folder slip disahkan.');
}


function tahlilReceiptHistory_(sheet, request) {
  const query = typeof request.query === 'string' ? request.query.trim().slice(0, 160).toLowerCase() : '';
  const offset = Number.isSafeInteger(request.offset) && request.offset > 0 ? request.offset : 0;
  const [header, ...rows] = sheet.getDataRange().getDisplayValues();
  const mergeStatus = header.indexOf('Document Merge Status - Resit Tahlil 1448H');
  const mergeUrl = header.indexOf('Merged Doc URL - Resit Tahlil 1448H');
  const matches = rows.reverse().filter(row => row[2] === '1448H' && row[1] &&
    (!query || [row[1], row[6], row[7], row[13]].some(value => String(value || '').toLowerCase().includes(query))));
  const items = matches.slice(offset, offset + 25).map(row => {
    const merged = String(row[mergeStatus] || '');
    const pdf = [row[mergeUrl], row[16]].find(url => /^https:\/\/(?:drive|docs)\.google\.com\//.test(url || '')) || '';
    return {
      name: row[6], email: row[7], reference: row[1], receipt: row[13],
      payment: row[11], amount: row[15], package: row[4],
      pdf, sent: /\bEmails Sent\s*:\s*\[\s*To:/i.test(merged), mergeLogged: Boolean(merged)
    };
  });
  return tahlilRegistrationJson_({ status: 'ok', items, total: matches.length });
}
