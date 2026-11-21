/* SECURITY NOTICE (2026-11-21): Historical example, NOT the deployed Tahlil V9 backend.
   Its legacy doPost/sign-in route is incompatible with the current public UI.
   Do not deploy or substitute this file for V9. See docs/SECURITY_AUDIT_2026-11-21.md. */
/**
 * Deploy as a dedicated Apps Script web app executing as its owner.
 * Required Script Properties:
 * TAHLIL_GOOGLE_CLIENT_ID, TAHLIL_GOOGLE_CLIENT_SECRET, TAHLIL_ADMIN_EMAILS
 * The allowlist is comma-separated. Keep the client secret in Script Properties.
 */
const TAHLIL_URUS_REDIRECT_ = 'https://shafielegacy.github.io/tahlilramadhan/urusetia.html';

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents;
    if (!body || body.length > 4096) return tahlilAuthResponse_('error');
    const request = JSON.parse(body);
    if (request.action !== 'urusetiaSignIn' ||
        typeof request.code !== 'string' || !/^[!-~]{1,2048}$/.test(request.code) ||
        typeof request.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(request.verifier)) {
      return tahlilAuthResponse_('error');
    }

    const properties = PropertiesService.getScriptProperties();
    const clientId = properties.getProperty('TAHLIL_GOOGLE_CLIENT_ID');
    const clientSecret = properties.getProperty('TAHLIL_GOOGLE_CLIENT_SECRET');
    const admins = (properties.getProperty('TAHLIL_ADMIN_EMAILS') || '')
      .split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
    if (!clientId || !clientSecret || admins.length === 0) return tahlilAuthResponse_('error');

    const tokenReply = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      payload: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: request.code,
        code_verifier: request.verifier,
        redirect_uri: TAHLIL_URUS_REDIRECT_
      },
      muteHttpExceptions: true
    });
    if (tokenReply.getResponseCode() !== 200) return tahlilAuthResponse_('error');
    const token = JSON.parse(tokenReply.getContentText()).access_token;
    if (!token) return tahlilAuthResponse_('error');

    const profileReply = UrlFetchApp.fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (profileReply.getResponseCode() !== 200) return tahlilAuthResponse_('error');
    const profile = JSON.parse(profileReply.getContentText());
    const email = typeof profile.email === 'string' ? profile.email.toLowerCase() : '';
    if (profile.email_verified !== true || !admins.includes(email)) return tahlilAuthResponse_('denied');
    return tahlilAuthResponse_('ok', email);
  } catch (_) {
    return tahlilAuthResponse_('error');
  }
}

function tahlilAuthResponse_(status, email) {
  const result = { status };
  if (email) result.email = email;
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
