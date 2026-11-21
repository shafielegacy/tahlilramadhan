const TAHLIL_URUS_ORIGIN_ = 'https://shafielegacy.github.io';
const TAHLIL_URUS_SESSION_TTL_ = 1800;

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents;
    if (!body || body.length > 4500000) return tahlilAuthResponse_('error');
    const request = JSON.parse(body);
    if (!request || Array.isArray(request) || typeof request !== 'object') return tahlilAuthResponse_('invalid');
    if (request.action === 'tahlilSeasonList' || request.action === 'tahlilSeasonSave') {
      if (body.length > 4096) return tahlilAuthResponse_('invalid');
      return tahlilSeasons_(request);
    }
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
    if (!tahlilQuota_('oauth', 60)) return tahlilAuthResponse_('rate_limited');
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


// V10: annual seasons. Sheet/folder identifiers are resource IDs, never credentials.
const TAHLIL_SHEET_ID_ = '16b0sjKmGw8Yft8NvkKLym6izWyZg4LFXpOYyk9f8PAU';
const TAHLIL_SLIP_FOLDER_ = '1Ji4yaNHLTjEvefXFYj1Gcy20C-JMjLXQ';
const TAHLIL_SEASON_HEADERS_ = ['ID_MUSIM','NAMA_MUSIM','STATUS_PENDAFTARAN','BUKA_PADA','TUTUP_PADA','AKTIF','VERSI','DIKEMASKINI_PADA','DIKEMASKINI_OLEH','RESIT_DISEMAK'];

function tahlilRegistrationJson_(data) { return tahlilAuthResponseData_(data); }
function tahlilAuthResponseData_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function tahlilRequireSession_(token, role) {
  if (typeof token !== 'string' || !/^[0-9a-f-]{72}$/.test(token)) return '';
  const email = CacheService.getScriptCache().get('tahlil-' + role + ':' + token);
  if (!email) return '';
  if (role === 'urusetia') {
    const allowed = (PropertiesService.getScriptProperties().getProperty('TAHLIL_ADMIN_EMAILS') || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(email)) return '';
  }
  return email;
}
function tahlilQuota_(actor, limit) {
  const digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, actor)).slice(0,43);
  const key = 'tahlil-rate:' + digest + ':' + Math.floor(Date.now()/60000);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return false;
  try {
    const cache = CacheService.getScriptCache(), count = Number(cache.get(key) || 0);
    if (count >= limit) return false;
    cache.put(key, String(count + 1), 120);
    return true;
  } finally { lock.releaseLock(); }
}
function tahlilParseLocal_(text) {
  if (typeof text !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const [year,month,day,hour,minute] = m.slice(1).map(Number);
  if (year < 2000 || year > 2199 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const utc = Date.UTC(year,month-1,day,hour,minute);
  const d = new Date(utc);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month-1 || d.getUTCDate() !== day) return null;
  return utc - 8*60*60*1000;
}
function tahlilStoredLocal_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value,'Asia/Kuala_Lumpur',"yyyy-MM-dd'T'HH:mm");
  const text = typeof value === 'string' ? value : '';
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/.test(text) ? text.slice(0,16) : text;
}
function tahlilReadSeasons_(ss) {
  const sheet = ss.getSheetByName('MUSIM');
  if (!sheet) throw Error('Season configuration unavailable');
  const [header,...rows] = sheet.getDataRange().getValues();
  const legacy = header.length <= 3;
  if (!legacy && TAHLIL_SEASON_HEADERS_.some((h,i)=>header[i]!==h)) throw Error('Season schema mismatch');
  const ids = new Set();
  const items = rows.filter(r=>r[0]).map(r=>{
    const id=String(r[0]), name=String(r[1]||'');
    if (!/^\d{4}H$/.test(id) || ids.has(id) || !name || name.length>120) throw Error('Invalid season');
    ids.add(id);
    const opensAt = legacy ? '' : tahlilStoredLocal_(r[3]);
    const closesAt = legacy ? '' : tahlilStoredLocal_(r[4]);
    const version = legacy ? 0 : Number(r[6]);
    if (!Number.isSafeInteger(version) || version<0) throw Error('Invalid revision');
    const legacyRow=legacy||(id==='1448H'&&version===0&&!opensAt&&!closesAt);
    return {id,name,enabled:r[2]==='DIBUKA',active:legacy?id==='1448H':r[5]==='YA',
      opensAt,closesAt,version,legacy:legacyRow,receiptReady:legacy?id==='1448H':r[9]==='YA'};
  });
  const active=items.filter(x=>x.active);
  if(active.length>1)throw Error('Multiple active seasons');
  return {items,active:active[0]||null,legacy};
}
function tahlilWindow_(season, now) {
  if (!season) return {open:false,state:'unconfigured'};
  if (!season.enabled) return {open:false,state:'paused'};
  if (season.legacy) return {open:true,state:'open'};
  const start=tahlilParseLocal_(season.opensAt), end=tahlilParseLocal_(season.closesAt);
  if(start===null||end===null||start>=end)return {open:false,state:'unconfigured'};
  return now<start?{open:false,state:'upcoming'}:now>=end?{open:false,state:'closed'}:{open:true,state:'open'};
}
function tahlilPackages_(ss,id) {
  const sheet=ss.getSheetByName('PAKEJ');
  if(!sheet)throw Error('Package configuration unavailable');
  const ids=new Set();
  return sheet.getDataRange().getValues().slice(1)
    .filter(r=>r[0]===id&&r[5]==='YA')
    .map(r=>{
      const price=r[3], limit=r[4]===''||r[4]===undefined?0:Number(r[4]);
      if(typeof r[1]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(r[1])||ids.has(r[1])||typeof r[2]!=='string'||r[2].length>160||
        typeof price!=='number'||!Number.isFinite(price)||price<0.01||price>100000||price!==Math.round(price*100)/100||
        !Number.isSafeInteger(limit)||limit<0||limit>1000)throw Error('Invalid package');
      ids.add(r[1]);
      return {id:r[1],name:r[2],price,limit};
    });
}
function tahlilEnsureRegistrationKeys_(sheet){
  if(!sheet)return false;
  const rows=sheet.getDataRange().getValues(), header=rows[0]||[];
  const names=['KUNCI_PENDAFTARAN','EMAIL_PENGHANTAR'];
  for(let i=0;i<2;i++){
    if(header[22+i]&&header[22+i]!==names[i])return false;
    if(!header[22+i]&&rows.slice(1).some(r=>r[22+i]))return false;
  }
  if(!header[22]||!header[23]){
    const maximum=sheet.getMaxColumns();
    if(maximum<24)sheet.insertColumnsAfter(maximum,24-maximum);
    sheet.getRange(1,23,1,2).setValues([names]);
  }
  return true;
}
function tahlilSeasons_(request) {
  const actor=tahlilRequireSession_(request.session,'urusetia');
  if(!actor)return tahlilAuthResponse_('denied');
  const ss=SpreadsheetApp.openById(TAHLIL_SHEET_ID_);
  if(request.action==='tahlilSeasonList'){
    const policy=tahlilReadSeasons_(ss);
    return tahlilRegistrationJson_({status:'ok',items:policy.items,activeId:policy.active&&policy.active.id,timezone:'Asia/Kuala_Lumpur'});
  }
  const create=request.create===true, id=request.id, name=request.name;
  const start=tahlilParseLocal_(request.opensAt), end=tahlilParseLocal_(request.closesAt);
  if(typeof id!=='string'||!/^\d{4}H$/.test(id)||typeof name!=='string'||!name.trim()||name.length>120||
    /[\u0000-\u001f\u007f]/.test(name)||start===null||end===null||start>=end||
    !Number.isSafeInteger(request.version)||request.version<0||
    typeof request.enabled!=='boolean'||typeof request.activate!=='boolean'||typeof request.receiptReady!=='boolean')
    return tahlilAuthResponse_('invalid');
  if(!tahlilQuota_('settings:'+actor,30))return tahlilAuthResponse_('rate_limited');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    if(!tahlilRequireSession_(request.session,'urusetia'))return tahlilAuthResponse_('denied');
    const policy=tahlilReadSeasons_(ss), current=policy.items.find(s=>s.id===id);
    if(create?!!current||request.version!==0:!current||current.version!==request.version)return tahlilAuthResponse_('conflict');
    const active=!create&&request.activate;
    if(current&&current.active&&!active)return tahlilAuthResponse_('invalid');
    if(active&&((policy.active?policy.active.id:null)!==request.expectedActiveId||
      (policy.active?policy.active.version:null)!==request.expectedActiveVersion))return tahlilAuthResponse_('conflict');
    const packages=create?tahlilPackages_(ss,request.copyFrom):[];
    if(create&&(!policy.items.some(s=>s.id===request.copyFrom)||!packages.length))return tahlilAuthResponse_('invalid');
    if(!create&&request.enabled&&!tahlilPackages_(ss,id).length)return tahlilAuthResponse_('invalid');
    const sheet=ss.getSheetByName('MUSIM'), rows=sheet.getDataRange().getValues();
    if(create){
      if(!tahlilEnsureRegistrationKeys_(ss.getSheetByName('DAFTAR')))return tahlilAuthResponse_('schema_conflict');
      const target=ss.getSheetByName('PAKEJ');
      const existing=target.getDataRange().getValues().slice(1).filter(r=>r[0]===id);
      const snapshot=r=>JSON.stringify([r[1],r[2],r[3],Number(r[4])||0,r[5]]);
      const expected=packages.map(p=>JSON.stringify([p.id,p.name,p.price,p.limit,'YA'])).sort();
      if(existing.length){
        const actual=existing.map(snapshot).sort();
        if(JSON.stringify(actual)!==JSON.stringify(expected))return tahlilAuthResponse_('conflict');
      }else target.getRange(target.getLastRow()+1,1,packages.length,6)
        .setValues(packages.map(p=>[id,p.id,"'"+p.name,p.price,p.limit||'','YA']));
    }
    if(policy.legacy){
      // Only the newly introduced metadata columns are migrated in one range.
      const values=[TAHLIL_SEASON_HEADERS_.slice(3),...rows.slice(1).map(r=>[
        '','',r[0]==='1448H'?'YA':'TIDAK',0,'','',r[0]==='1448H'?'YA':'TIDAK'
      ])];
      sheet.getRange(1,4,values.length,7).setValues(values);
    }
    const stamp=new Date().toISOString();
    if(active&&policy.active&&policy.active.id!==id){
      const previous=rows.findIndex((r,i)=>i>0&&r[0]===policy.active.id);
      sheet.getRange(previous+1,6,1,4).setValues([['TIDAK',policy.active.version+1,stamp,actor]]);
    }
    const row=[id,"'"+name.trim(),!create&&request.enabled?'DIBUKA':'DITUTUP',
      request.opensAt+':00+08:00',request.closesAt+':00+08:00',active?'YA':'TIDAK',
      (current?current.version:0)+1,stamp,actor,!create&&request.receiptReady?'YA':'TIDAK'];
    if(create)sheet.appendRow(row);
    else{
      const index=rows.findIndex((r,i)=>i>0&&r[0]===id);
      sheet.getRange(index+1,1,1,10).setValues([row]);
    }
    SpreadsheetApp.flush();return tahlilRegistrationJson_({status:'ok',id,version:row[6]});
  }finally{lock.releaseLock();}
}
function tahlilRegistration_(request) {
  const ss=SpreadsheetApp.openById(TAHLIL_SHEET_ID_);
  if(request.action==='tahlilPackages'){
    const policy=tahlilReadSeasons_(ss), season=policy.active;
    const state=tahlilWindow_(season,Date.now());
    return tahlilRegistrationJson_({status:'ok',...state,season:season?{id:season.id,name:season.name,
      opensAt:season.opensAt,closesAt:season.closesAt,version:season.version}:null,
      timezone:'Asia/Kuala_Lumpur',packages:season?tahlilPackages_(ss,season.id):[]});
  }
  const assisted=request.action==='tahlilAssistedRegister';
  const actor=tahlilRequireSession_(request.session,assisted?'urusetia':'peserta');
  if(!actor)return tahlilAuthResponse_(assisted?'denied':'login_required');
  const clean=(v,max)=>typeof v==='string'&&v.length<=max?v.trim():'';
  const email=assisted?clean(request.email,254).toLowerCase():actor;
  const name=clean(request.name,160),phone=clean(request.phone,35),key=clean(request.key,40).toLowerCase();
  const names=clean(request.names,10000).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const mime=request.mime, fileData=request.file;
  const extensions={'image/jpeg':'jpg','image/png':'png','application/pdf':'pdf'};
  if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\+?[0-9 ()-]{8,35}$/.test(phone)||
    !names.length||names.length>1000||names.some(s=>s.length>160)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)||
    !Object.hasOwn(extensions,mime)||typeof fileData!=='string'||fileData.length>4194304||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(fileData))return tahlilAuthResponse_('invalid');
  const bytes=Utilities.base64Decode(fileData);
  const signatures={'image/jpeg':[255,216,255],'image/png':[137,80,78,71,13,10,26,10],'application/pdf':[37,80,68,70,45]};
  if(!bytes.length||bytes.length>3*1024*1024||!signatures[mime].every((v,i)=>i<bytes.length&&(bytes[i]&255)===v))return tahlilAuthResponse_('invalid');
  if(!tahlilQuota_('registration:'+actor,assisted?30:6))return tahlilAuthResponse_('rate_limited');
  const lock=LockService.getScriptLock();let file,writeAttempted=false,stage='lock';
  try{
    lock.waitLock(15000);
    if(!tahlilRequireSession_(request.session,assisted?'urusetia':'peserta'))return tahlilAuthResponse_('login_required');
    const requestedId=request.seasonId===undefined?'1448H':request.seasonId;
    if(typeof requestedId!=='string'||!/^\d{4}H$/.test(requestedId))return tahlilAuthResponse_('season_changed');
    const sheet=ss.getSheetByName('DAFTAR');if(!sheet)throw Error('Missing registration sheet');
    const rows=sheet.getDataRange().getValues();
    const prior=rows.slice(1).find(r=>r[2]===requestedId&&r[22]===key);
    if(prior)return prior[23]===actor?tahlilRegistrationJson_({status:'ok',reference:prior[1]}):tahlilAuthResponse_('conflict');
    const short='THL-'+key.replace(/-/g,'').slice(0,12).toUpperCase();
    const old='THL-'+requestedId+'-'+key.toUpperCase();
    const legacy=rows.slice(1).find(r=>r[2]===requestedId&&!r[22]&&[short,old].includes(r[1]));
    if(legacy)return !assisted&&String(legacy[7]).toLowerCase()===actor&&legacy[12]==='PESERTA'
      ?tahlilRegistrationJson_({status:'ok',reference:legacy[1]}):tahlilAuthResponse_('conflict');
    const policy=tahlilReadSeasons_(ss), season=policy.active;
    if(!season||requestedId!==season.id||(!season.legacy&&request.seasonVersion!==season.version))return tahlilAuthResponse_('season_changed');
    if(!tahlilWindow_(season,Date.now()).open)return tahlilAuthResponse_('closed');
    const selected=tahlilPackages_(ss,season.id).find(p=>p.id===request.packageId);
    if(!selected||(selected.limit&&names.length>selected.limit))return tahlilAuthResponse_('invalid');
    // Keep the existing AutoCrat A:V untouched; only append two named metadata columns.
    const header=rows[0];
    if((header[22]&&header[22]!=='KUNCI_PENDAFTARAN')||(header[23]&&header[23]!=='EMAIL_PENGHANTAR'))throw Error('Registration schema conflict');
    if(!header[22]||!header[23])sheet.getRange(1,23,1,2).setValues([['KUNCI_PENDAFTARAN','EMAIL_PENGHANTAR']]);
    let reference=short;
    for(let attempt=0;rows.some(r=>r[1]===reference);attempt++){
      if(attempt>5)throw Error('Reference collision');
      reference='THL-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    }
    stage='save slip';
    file=DriveApp.getFolderById(TAHLIL_SLIP_FOLDER_).createFile(Utilities.newBlob(bytes,mime,reference+'.'+extensions[mime]));
    if(!tahlilWindow_(season,Date.now()).open){file.setTrashed(true);file=null;return tahlilAuthResponse_('closed');}
    stage='write registration';writeAttempted=true;
    const asText=v=>"'"+v;
    sheet.appendRow([new Date(),reference,season.id,selected.id,asText(selected.name),selected.price,
      asText(name),asText(email),asText(phone),asText(names.join('\n')),file.getUrl(),'MENUNGGU SEMAKAN',
      assisted?'URUSETIA':'PESERTA','','','','','','','','','',key,actor]);
    SpreadsheetApp.flush();
    return tahlilRegistrationJson_({status:'ok',reference});
  }catch(error){
    console.error('Tahlil registration stage: '+stage+'; reconciliation required: '+writeAttempted);
    if(file&&!writeAttempted)try{file.setTrashed(true);}catch(_){}
    const codes={lock:'DAFTAR-SIBUK','save slip':'DAFTAR-SLIP','write registration':'DAFTAR-REKOD'};
    return tahlilRegistrationJson_({status:'error',code:codes[stage]||'DAFTAR-PERSEDIAAN'});
  }finally{if(lock.hasLock())lock.releaseLock();}
}
function tahlilSafeDocument_(url){
  return typeof url==='string'&&url.length<=2048&&/^https:\/\/(?:drive|docs)\.google\.com\/[^\s<>]+$/.test(url)?url:'';
}
function tahlilPayment_(request){
  if(!tahlilRequireSession_(request.session,'urusetia'))return tahlilAuthResponse_('denied');
  const ss=SpreadsheetApp.openById(TAHLIL_SHEET_ID_), policy=tahlilReadSeasons_(ss);
  const id=request.seasonId||'1448H', season=policy.items.find(s=>s.id===id);
  if(!season)return tahlilAuthResponse_('invalid');
  const sheet=ss.getSheetByName('DAFTAR');if(!sheet)throw Error('Missing registration sheet');
  if(request.action==='tahlilReceiptHistory')return tahlilReceiptHistory_(sheet,request,id);
  if(request.action==='tahlilPaymentQueue'){
    const items=sheet.getDataRange().getDisplayValues().slice(1).filter(r=>r[2]===id&&r[11]==='MENUNGGU SEMAKAN')
      .slice(0,50).map(r=>({reference:r[1],package:r[4],price:r[5],name:r[6],proof:tahlilSafeDocument_(r[10])}));
    return tahlilRegistrationJson_({status:'ok',items});
  }
  const amount=request.amount,cents=typeof amount==='number'?Math.round(amount*100):NaN;
  if(typeof request.reference!=='string'||!/^THL-(?:\d{4}H-[0-9A-F-]{36}|[0-9A-F]{12})$/.test(request.reference)||
    !Number.isFinite(amount)||amount>100000||!Number.isSafeInteger(cents)||cents<1||amount!==cents/100)return tahlilAuthResponse_('invalid');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    if(!tahlilRequireSession_(request.session,'urusetia'))return tahlilAuthResponse_('denied');
    const rows=sheet.getDataRange().getValues(),index=rows.findIndex((r,i)=>i>0&&r[1]===request.reference&&r[2]===id);
    if(index<1)return tahlilAuthResponse_('invalid');
    const row=rows[index],pattern=new RegExp('^THL-'+id+'-(\\d+)$');
    if(row[13])return pattern.test(String(row[13]))&&row[11]==='BAYARAN DISAHKAN'
      ?tahlilRegistrationJson_({status:'already_approved',receipt:row[13]}):tahlilAuthResponse_('invalid');
    const currentSeason=tahlilReadSeasons_(ss).items.find(s=>s.id===id);
    if(!currentSeason||!currentSeason.receiptReady)return tahlilAuthResponse_('receipt_setup_required');
    if(row[11]!=='MENUNGGU SEMAKAN'||!row[7]||!row[10]||row[16]||row[17])return tahlilAuthResponse_('invalid');
    const max=rows.reduce((n,r)=>{const m=r[2]===id&&pattern.exec(String(r[13]||''));return m?Math.max(n,Number(m[1])):n;},0);
    if(!Number.isSafeInteger(max)||max>=99999999)return tahlilAuthResponse_('invalid');
    const receipt='THL-'+id+'-'+String(max+1).padStart(4,'0');
    const date=Utilities.formatDate(new Date(),'Asia/Kuala_Lumpur','dd/MM/yyyy');
    sheet.getRange(index+1,12,1,7).setValues([['BAYARAN DISAHKAN',row[12],receipt,date,cents/100,'','SEDIA']]);
    SpreadsheetApp.flush();return tahlilRegistrationJson_({status:'ok',receipt});
  }finally{lock.releaseLock();}
}
function tahlilReceiptHistory_(sheet,request,id){
  const query=typeof request.query==='string'?request.query.trim().slice(0,160).toLowerCase():'';
  const offset=Number.isSafeInteger(request.offset)&&request.offset>=0?request.offset:0;
  const [header,...rows]=sheet.getDataRange().getDisplayValues();
  const job='Resit Tahlil '+id, mergeStatus=header.indexOf('Document Merge Status - '+job),mergeUrl=header.indexOf('Merged Doc URL - '+job);
  const matches=rows.reverse().filter(r=>r[2]===id&&r[1]&&(!query||[r[1],r[6],r[7],r[13]].some(v=>String(v||'').toLowerCase().includes(query))));
  const items=matches.slice(offset,offset+25).map(r=>{
    const merged=String(r[mergeStatus]||''),pdf=tahlilSafeDocument_(r[mergeUrl])||tahlilSafeDocument_(r[16]);
    return {name:r[6],email:r[7],reference:r[1],receipt:r[13],payment:r[11],amount:r[15],package:r[4],pdf,
      sent:/\bEmails Sent\s*:\s*\[\s*To:/i.test(merged),mergeLogged:!!merged};
  });
  return tahlilRegistrationJson_({status:'ok',items,total:matches.length});
}
function semakAksesTahlil(){
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL,['https://www.googleapis.com/auth/drive']);
  const ss=SpreadsheetApp.openById(TAHLIL_SHEET_ID_);
  if(!ss.getSheetByName('DAFTAR'))throw Error('Tab DAFTAR tiada');
  DriveApp.getFolderById(TAHLIL_SLIP_FOLDER_).getName();console.log('Akses Sheets dan folder slip disahkan.');
}
