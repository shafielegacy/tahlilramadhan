'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../apps-script/Code.gs'), 'utf8');

// The mocks are in-memory service boundaries; production handlers do the validation,
// filtering, decisions and writes. No live Google APIs, credentials or participant rows.
function fixture() {
  let now = Date.parse('2026-11-21T04:00:00Z');
  const data = {
    MUSIM: [['ID_MUSIM','NAMA_MUSIM','STATUS_PENDAFTARAN','BUKA_PADA','TUTUP_PADA','AKTIF','VERSI','DIKEMASKINI_PADA','DIKEMASKINI_OLEH','RESIT_DISEMAK'],
      ['1448H','Ramadan 1448H','DIBUKA','2026-11-21T11:00:00+08:00','2026-11-21T13:00:00+08:00','YA',1,'','','YA'],
      ['1449H','Ramadan 1449H','DITUTUP','2027-11-21T11:00:00+08:00','2027-11-21T13:00:00+08:00','TIDAK',1,'','','TIDAK']],
    PAKEJ: [['ID_MUSIM','ID_PAKEJ','NAMA_PAKEJ','HARGA_RM','HAD_NAMA_TAHLIL','AKTIF'],
      ['1448H','RM50','PAKEJ RM50',50,'','YA'],['1449H','RM50','PAKEJ RM50',50,'','YA']],
    DAFTAR: [['TARIKH','RUJUKAN','ID_MUSIM','ID_PAKEJ','NAMA_PAKEJ','HARGA_RM','NAMA_PESERTA','EMAIL','WHATSAPP','NAMA_ARWAH','BUKTI_BAYARAN','STATUS','SALURAN','RESIT','TARIKH_RESIT','JUMLAH_DISAHKAN_RM','URL_RESIT_PDF','STATUS_RESIT','Merged Doc ID - Resit Tahlil 1448H','Merged Doc URL - Resit Tahlil 1448H','Link to merged Doc - Resit Tahlil 1448H','Document Merge Status - Resit Tahlil 1448H','KUNCI_PENDAFTARAN','EMAIL_PENGHANTAR']]
  };
  const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'.repeat(2);
  const member = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'.repeat(2);
  const props = {TAHLIL_ADMIN_EMAILS:'staff@example.test', TAHLIL_GOOGLE_CLIENT_ID:'test', TAHLIL_GOOGLE_CLIENT_SECRET:'test'};
  const cache = new Map([['tahlil-urusetia:'+admin,'staff@example.test'],['tahlil-peserta:'+member,'member@example.test']]);
  const effects = {files:0, trashed:0, writes:0, oauth:0, formulas:0};
  let afterLock, flushError = false, failSeasonWrite=false, sequence = 1, held = false;
  const plain = x => typeof x === 'string' && x.startsWith("'") ? x.slice(1) : x;
  function sheet(name) {
    return {
      getDataRange: () => ({
        getValues: () => data[name].map(r=>r.slice()),
        getDisplayValues: () => data[name].map(r=>r.map(v=>v===undefined||v===null?'':String(v)))
      }),
      getLastRow: () => data[name].length, getLastColumn: () => Math.max(...data[name].map(r=>r.length)),
      getMaxColumns: () => 26, insertColumnsAfter: () => {},
      getRange: (row,col,nr=1,nc=1) => typeof row === 'string' ? {createTextFinder:text=>({matchEntireCell(){return this;},findNext:()=>data[name].some(r=>r[1]===text)?{}:null})} : ({
        getValues: () => Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>data[name][row-1+i]?.[col-1+j]??'')),
        setValues: values => {
          if(name==='MUSIM'&&failSeasonWrite){failSeasonWrite=false;throw Error('MUSIM write failed');}
          effects.writes++;
          values.forEach((r,i)=>r.forEach((v,j)=>{
            if(!data[name][row-1+i]) data[name][row-1+i]=[];
            if(typeof v==='string'&&v.startsWith('='))effects.formulas++;
            data[name][row-1+i][col-1+j]=plain(v);
          }));
        }
      }),
      appendRow: row => {if(name==='MUSIM'&&failSeasonWrite){failSeasonWrite=false;throw Error('MUSIM write failed');}effects.writes++;data[name].push(row.map(plain));}
    };
  }
  const ss = {getSheetByName:name=>data[name]?sheet(name):null};
  const lock = {waitLock:()=>{held=true;if(afterLock){const fn=afterLock;afterLock=null;fn();}},
    tryLock:()=>{held=true;return true;},hasLock:()=>held,releaseLock:()=>{held=false;}};
  class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
  const services = {
    Date:Clock, console:{error:()=>{},log:()=>{}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k)??null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    LockService:{getScriptLock:()=>lock},
    SpreadsheetApp:{openById:()=>ss,flush:()=>{if(flushError)throw Error('uncertain flush');}},
    DriveApp:{getFolderById:()=>({createFile:()=>{effects.files++;return {getUrl:()=>'https://drive.google.com/file/d/mock/view',setTrashed:()=>{effects.trashed++;}};},getName:()=> 'mock'})},
    Utilities:{
      getUuid:()=>String(sequence++).padStart(8,'0')+'-1234-4123-8123-123456789abc',
      base64Decode:text=>Array.from(Buffer.from(text,'base64')),
      newBlob:()=>({}),
      computeDigest:(_algorithm,text)=>Array.from(Buffer.from(text)),
      DigestAlgorithm:{SHA_256:'SHA_256'},
      base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),
      formatDate:date=>new Date(date).toISOString()
    },
    ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({text,setMimeType(){return this;}})},
    UrlFetchApp:{fetch:()=>{effects.oauth++;throw Error('unexpected OAuth');}},
    ScriptApp:{requireScopes:()=>{},AuthMode:{FULL:'FULL'}}
  };
  const context=vm.createContext(services); vm.runInContext(source,context,{timeout:1000});
  const call = request => JSON.parse(context.doPost({postData:{contents:JSON.stringify(request)}}).text);
  const register = extra => call({action:'tahlilRegister',session:member,seasonId:'1448H',seasonVersion:1,
    packageId:'RM50',name:'Peserta QA',phone:'0191234567',names:'Nama QA',
    key:'12345678-1234-4123-8123-123456789abc',mime:'application/pdf',file:'JVBERi0xLjQ=',...extra});
  const row = (id,season='1448H',email='member@example.test') => [new Date(now),id,season,'RM50','PAKEJ RM50',50,'Peserta QA',email,'0191234567','Nama QA','https://drive.google.com/file/d/mock/view','MENUNGGU SEMAKAN','PESERTA','','','','','','','','','','',''];
  return {context,call,register,data,admin,member,props,cache,effects,row,
    clock:value=>{now=Date.parse(value);}, afterLock:fn=>{afterLock=fn;},flushError:()=>{flushError=true;},failSeasonWrite:()=>{failSeasonWrite=true;}};
}

test('MYT parser rejects impossible dates and keeps explicit UTC offset',()=>{
  const f=fixture(); assert.equal(typeof f.context.tahlilParseLocal_,'function');
  assert.equal(f.context.tahlilParseLocal_('2026-11-21T12:00'),Date.parse('2026-11-21T04:00Z'));
  for(const date of ['2026-02-30T12:00','2026-13-01T00:00','','2026-11-21','2026-11-21T24:01'])
    assert.equal(f.context.tahlilParseLocal_(date),null,date);
});
test('opens exactly at start and closes exactly at end',()=>{
  const f=fixture(); f.clock('2026-11-21T03:00:00Z'); assert.equal(f.call({action:'tahlilPackages'}).open,true);
  f.clock('2026-11-21T02:59:59Z'); assert.equal(f.call({action:'tahlilPackages'}).open,false);
  f.clock('2026-11-21T05:00:00Z'); assert.equal(f.call({action:'tahlilPackages'}).open,false);
});
test('invalid or ambiguous active configuration fails closed',()=>{
  const f=fixture();f.data.MUSIM[1][3]='nonsense';assert.equal(f.call({action:'tahlilPackages'}).open,false);
  f.data.MUSIM[2][5]='YA';assert.notEqual(f.call({action:'tahlilPackages'}).status,'ok');
});
test('legacy three-column sheet stays on 1448H until admin saves settings',()=>{
  const f=fixture();f.data.MUSIM=f.data.MUSIM.slice(0,2).map(r=>r.slice(0,3));
  const result=f.call({action:'tahlilPackages'});assert.equal(result.open,true);assert.equal(result.season.id,'1448H');
  assert.equal(f.effects.writes,0);
});
test('all season admin routes deny missing, participant and removed allowlist sessions',()=>{
  const f=fixture();
  for(const action of ['tahlilSeasonList','tahlilSeasonSave']){
    for(const session of ['',f.member]) assert.equal(f.call({action,session}).status,'denied');
    f.props.TAHLIL_ADMIN_EMAILS='';assert.equal(f.call({action,session:f.admin}).status,'denied');
  }
  assert.equal(f.effects.writes,0);
});
test('save dates checks expected revision and leaves receipt rows unchanged',()=>{
  const f=fixture();f.data.DAFTAR.push(f.row('THL-111111111111'));const before=JSON.stringify(f.data.DAFTAR);
  const p={action:'tahlilSeasonSave',session:f.admin,id:'1448H',name:'Ramadan 1448H',opensAt:'2026-11-21T11:00',closesAt:'2026-11-21T13:00',enabled:true,activate:true,receiptReady:true,version:1,expectedActiveId:'1448H',expectedActiveVersion:1};
  assert.equal(f.call({...p,version:0}).status,'conflict');assert.equal(f.effects.writes,0);
  assert.equal(f.call(p).status,'ok');assert.equal(f.data.MUSIM[1][6],2);assert.equal(JSON.stringify(f.data.DAFTAR),before);
});
test('new season starts closed, copies package snapshots and rejects duplicate ID',()=>{
  const f=fixture();const p={action:'tahlilSeasonSave',session:f.admin,create:true,copyFrom:'1448H',id:'1450H',name:'Ramadan 1450H',opensAt:'2028-01-01T00:00',closesAt:'2028-02-01T00:00',version:0,enabled:true,activate:true,receiptReady:false};
  assert.equal(f.call(p).status,'ok');const r=f.data.MUSIM.find(r=>r[0]==='1450H');assert.equal(r[2],'DITUTUP');assert.equal(r[5],'TIDAK');
  assert.equal(f.data.PAKEJ.filter(r=>r[0]==='1450H').length,1);assert.equal(f.call(p).status,'conflict');
});
test('closed and stale registration creates no Drive file or record',()=>{
  const f=fixture();assert.equal(f.register({seasonId:'1449H'}).status,'season_changed');
  assert.equal(f.register({seasonVersion:0}).status,'season_changed');
  f.clock('2026-11-21T05:00:00Z');assert.equal(f.register().status,'closed');assert.equal(f.effects.files,0);
});
test('cutoff is checked after acquiring lock',()=>{
  const f=fixture();f.afterLock(()=>f.clock('2026-11-21T05:00:00Z'));
  assert.equal(f.register().status,'closed');assert.equal(f.effects.files,0);assert.equal(f.data.DAFTAR.length,1);
});
test('registration retry is tied to sender and season, not short reference alone',()=>{
  const f=fixture();const a=f.register();assert.equal(a.status,'ok');assert.equal(f.register().reference,a.reference);
  f.cache.set('tahlil-peserta:'+f.member,'other@example.test');
  const b=f.register();assert.notEqual(b.status,'ok');assert.equal(f.effects.files,1);assert.equal(f.data.DAFTAR.length,2);
});
test('retry after close returns own committed result without another write',()=>{
  const f=fixture();const a=f.register();f.clock('2026-11-21T05:00:00Z');assert.equal(f.register().reference,a.reference);assert.equal(f.effects.files,1);
});
test('uncertain append flush keeps the slip and a retry finds committed row',()=>{
  const f=fixture();f.flushError();assert.equal(f.register().status,'error');assert.equal(f.effects.trashed,0);
  assert.equal(f.register().status,'ok');assert.equal(f.effects.files,1);assert.equal(f.data.DAFTAR.length,2);
});
test('upload validates decoded bytes, MIME, base64, and 3 MiB limit',()=>{
  const f=fixture();
  for(const file of ['PHNjcmlwdD4=','%%%%','JVBERi0xLjQ'])assert.equal(f.register({file}).status,'invalid');
  assert.equal(f.register({mime:'text/html'}).status,'invalid');
  const tooLarge=Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(3*1024*1024)]).toString('base64');
  assert.equal(f.register({file:tooLarge}).status,'invalid');assert.equal(f.effects.files,0);
});
test('public sign-in quota limits OAuth calls without logging secret values',()=>{
  const f=fixture();for(let i=0;i<65;i++)f.call({action:'tahlilParticipantSignIn',code:'example-code-'+i});
  assert.ok(f.effects.oauth<=60);assert.equal(f.call({action:'tahlilParticipantSignIn',code:'last-code'}).status,'rate_limited');
});
test('payment actions deny participant and expired sessions',()=>{
  const f=fixture();for(const action of ['tahlilPaymentQueue','tahlilReceiptHistory','tahlilApprovePayment'])
    for(const session of ['',f.member])assert.equal(f.call({action,session,seasonId:'1448H'}).status,'denied');
});
test('queue and history filter the requested archive, including after registration closes',()=>{
  const f=fixture();f.data.DAFTAR.push(f.row('THL-111111111111'),f.row('THL-222222222222','1449H'));
  f.clock('2027-12-01T00:00Z');
  for(const action of ['tahlilPaymentQueue','tahlilReceiptHistory']){
    const r=f.call({action,session:f.admin,seasonId:'1449H'});assert.equal(r.status,'ok');assert.equal(r.items.length,1);assert.equal(r.items[0].reference,'THL-222222222222');
  }
});
test('receipt sequences are per season and repeated approval returns same receipt',()=>{
  const f=fixture();const old=f.row('THL-111111111111');old[13]='THL-1448H-0002';f.data.DAFTAR.push(old,f.row('THL-222222222222','1449H'));
  f.data.MUSIM[2][9]='YA';const p={action:'tahlilApprovePayment',session:f.admin,seasonId:'1449H',reference:'THL-222222222222',amount:0.29};
  const a=f.call(p);assert.equal(a.status,'ok');assert.equal(a.receipt,'THL-1449H-0001');const w=f.effects.writes;
  assert.equal(f.call(p).receipt,a.receipt);assert.equal(f.effects.writes,w);assert.equal(f.data.DAFTAR[1][13],'THL-1448H-0002');
});
test('new season payment requires receipt readiness',()=>{
  const f=fixture();f.data.DAFTAR.push(f.row('THL-222222222222','1449H'));
  assert.equal(f.call({action:'tahlilApprovePayment',session:f.admin,seasonId:'1449H',reference:'THL-222222222222',amount:50}).status,'receipt_setup_required');
  assert.equal(f.effects.writes,0);
});
test('amount and cross-season reference tampering never writes',()=>{
  const f=fixture();f.data.DAFTAR.push(f.row('THL-111111111111'));
  const p={action:'tahlilApprovePayment',session:f.admin,seasonId:'1448H',reference:'THL-111111111111'};
  for(const amount of [0,-1,12.345,100000.01,'50',null])assert.equal(f.call({...p,amount}).status,'invalid');
  assert.equal(f.call({...p,seasonId:'1449H',amount:50}).status,'invalid');assert.equal(f.effects.writes,0);
});
test('malformed, array and unknown actions fail without writes',()=>{
  const f=fixture();for(const value of [null,[],{action:'execute'},{action:'tahlilSeasonSave',session:f.admin,id:'../1448H'}])
    assert.notEqual(f.call(value).status,'ok');
  assert.equal(f.effects.writes,0);
});

test('upload rate limit stops repeated valid uploads by one identity',()=>{
  const f=fixture();
  for(let i=0;i<6;i++)assert.equal(f.register({key:String(i).padStart(8,'0')+'-1234-4123-8123-123456789abc'}).status,'ok');
  assert.equal(f.register({key:'99999999-1234-4123-8123-123456789abc'}).status,'rate_limited');
  assert.equal(f.effects.files,6);
});
test('receipt readiness is rechecked after waiting for the payment lock',()=>{
  const f=fixture();f.data.MUSIM[2][9]='YA';f.data.DAFTAR.push(f.row('THL-222222222222','1449H'));
  f.afterLock(()=>{f.data.MUSIM[2][9]='TIDAK';});
  assert.equal(f.call({action:'tahlilApprovePayment',session:f.admin,seasonId:'1449H',reference:'THL-222222222222',amount:50}).status,'receipt_setup_required');
  assert.equal(f.effects.writes,0);
});

test('creating a future season preserves the legacy 1448H opening status',()=>{
 const f=fixture();f.data.MUSIM=f.data.MUSIM.slice(0,2).map(r=>r.slice(0,3));
 assert.equal(f.call({action:'tahlilSeasonSave',session:f.admin,create:true,copyFrom:'1448H',id:'1450H',name:'Ramadan 1450H',opensAt:'2028-01-01T00:00',closesAt:'2028-02-01T00:00',version:0,enabled:false,activate:false,receiptReady:false}).status,'ok');
 const p=f.call({action:'tahlilPackages'});assert.equal(p.open,true);assert.equal(p.season.id,'1448H');
 assert.equal(f.register({seasonVersion:0}).status,'ok');
});
test('case-only changes in the idempotency UUID cannot duplicate registration',()=>{
 const f=fixture();const a=f.register();assert.equal(f.register({key:'12345678-1234-4123-8123-123456789ABC'}).reference,a.reference);
 assert.equal(f.effects.files,1);
});

test('sub-cent and rounded amounts cannot mark a zero or altered payment paid',()=>{
 const f=fixture();f.data.DAFTAR.push(f.row('THL-111111111111'));
 for(const amount of [1e-10,0.009999999999,50.000000000001])
  assert.equal(f.call({action:'tahlilApprovePayment',session:f.admin,seasonId:'1448H',reference:'THL-111111111111',amount}).status,'invalid');
 assert.equal(f.effects.writes,0);
});
test('two administrators cannot overwrite another active-season switch',()=>{
 const f=fixture();f.data.MUSIM.push(['1450H','Ramadan 1450H','DITUTUP','2028-01-01T00:00:00+08:00','2028-02-01T00:00:00+08:00','TIDAK',1,'','','TIDAK']);
 const p={action:'tahlilSeasonSave',session:f.admin,id:'1449H',name:'Ramadan 1449H',opensAt:'2027-11-21T11:00',closesAt:'2027-11-21T13:00',enabled:false,activate:true,receiptReady:false,version:1,expectedActiveId:'1448H',expectedActiveVersion:1};
 assert.equal(f.call(p).status,'ok');const writes=f.effects.writes;
 assert.equal(f.call({...p,id:'1450H',name:'Ramadan 1450H'}).status,'conflict');assert.equal(f.effects.writes,writes);
 assert.equal(f.data.MUSIM.filter(r=>r[5]==='YA')[0][0],'1449H');
});
test('closing registration keeps the active season and cannot unset it',()=>{
 const f=fixture();const p={action:'tahlilSeasonSave',session:f.admin,id:'1448H',name:'Ramadan 1448H',opensAt:'2026-11-21T11:00',closesAt:'2026-11-21T13:00',enabled:false,activate:false,receiptReady:true,version:1,expectedActiveId:'1448H',expectedActiveVersion:1};
 assert.equal(f.call(p).status,'invalid');assert.equal(f.effects.writes,0);
 assert.equal(f.call({...p,activate:true}).status,'ok');assert.equal(f.call({action:'tahlilPackages'}).open,false);
});
test('lost response retry recovers owned result after revision change or active switch',()=>{
 const f=fixture();const a=f.register();f.data.MUSIM[1][2]='DITUTUP';f.data.MUSIM[1][6]=2;
 assert.equal(f.register().reference,a.reference);
 f.data.MUSIM[1][5]='TIDAK';f.data.MUSIM[2][5]='YA';assert.equal(f.register().reference,a.reference);
 f.cache.set('tahlil-peserta:'+f.member,'other@example.test');assert.notEqual(f.register().status,'ok');assert.equal(f.effects.files,1);
});
test('season creation reserves W:X before any future AutoCrat job',()=>{
 const f=fixture();f.data.DAFTAR[0]=f.data.DAFTAR[0].slice(0,22);
 const p={action:'tahlilSeasonSave',session:f.admin,create:true,copyFrom:'1448H',id:'1450H',name:'Ramadan 1450H',opensAt:'2028-01-01T00:00',closesAt:'2028-02-01T00:00',version:0,enabled:false,activate:false,receiptReady:false};
 assert.equal(f.call(p).status,'ok');assert.equal(f.data.DAFTAR[0][22],'KUNCI_PENDAFTARAN');assert.equal(f.data.DAFTAR[0][23],'EMAIL_PENGHANTAR');
 const g=fixture();g.data.DAFTAR[0][22]='Merged Doc ID - Other Job';
 assert.equal(g.call(p).status,'schema_conflict');assert.equal(g.effects.writes,0);
});
test('season creation resumes a matching package copy after MUSIM write fails',()=>{
 const f=fixture();const p={action:'tahlilSeasonSave',session:f.admin,create:true,copyFrom:'1448H',id:'1450H',name:'Ramadan 1450H',opensAt:'2028-01-01T00:00',closesAt:'2028-02-01T00:00',version:0,enabled:false,activate:false,receiptReady:false};
 f.failSeasonWrite();assert.equal(f.call(p).status,'error');assert.equal(f.data.PAKEJ.filter(r=>r[0]==='1450H').length,1);
 assert.equal(f.call(p).status,'ok');assert.equal(f.data.PAKEJ.filter(r=>r[0]==='1450H').length,1);
});
test('saving one season never reinterprets another season literal as a formula',()=>{
 const f=fixture();f.data.MUSIM[2][1]='=2+2';
 const p={action:'tahlilSeasonSave',session:f.admin,id:'1448H',name:'Ramadan 1448H',opensAt:'2026-11-21T11:00',closesAt:'2026-11-21T13:00',enabled:true,activate:true,receiptReady:true,version:1,expectedActiveId:'1448H',expectedActiveVersion:1};
 assert.equal(f.call(p).status,'ok');assert.equal(f.effects.formulas,0);assert.equal(f.data.MUSIM[2][1],'=2+2');
});

test('package IDs, duplicates and non-sen prices fail closed',()=>{
 for(const kind of ['formula','duplicate','subcent']){
  const f=fixture();
  if(kind==='formula')f.data.PAKEJ[1][1]='=IMPORTDATA("bad")';
  if(kind==='duplicate')f.data.PAKEJ.push(['1448H','RM50','Other quote',70,'','YA']);
  if(kind==='subcent')f.data.PAKEJ[1][3]=50.001;
  assert.notEqual(f.call({action:'tahlilPackages'}).status,'ok');
 }
});
