'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function dom(){
 const nodes=new Map();
 class Element{
  constructor(id=''){this.id=id;this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.events={};this.style={};this.children=[];this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(name,fn){this.events[name]=fn;}
  querySelector(){return get('submit-button');}
  setAttribute(){} removeAttribute(){} focus(){} reset(){} add(node){this.children.push(node);}
  replaceChildren(...nodes){this.children=nodes;} append(...nodes){this.children.push(...nodes);} appendChild(node){this.children.push(node);}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
 const document={getElementById:id=>id.startsWith('submission-')||id==='payment-dialog'||id==='season-confirm-dialog'?null:get(id),
  querySelector:()=>get('shell'),querySelectorAll:()=>[],createElement:()=>new Element(),head:new Element()};
 return {get,nodes,document,Element};
}
function registration({open=true,result={status:'ok',reference:'THL-111111111111'}}={}){
 const d=dom(),calls=[];
 d.get('daftar').hidden=true;d.get('google-login').hidden=true;
 Object.entries({packageId:'RM50',name:'Peserta QA',phone:'0191234567',names:'Nama QA',email:'member@example.test'}).forEach(([k,v])=>d.get(k).value=v);
 const bytes=[37,80,68,70,45,49,46,52];
 d.get('proof').files=[{name:'slip.pdf',type:'application/pdf',size:8,slice:(a,b)=>({arrayBuffer:async()=>Uint8Array.from(bytes.slice(a,b)).buffer})}];
 const context=vm.createContext({
  document:d.document,window:{urusetiaConfig:{endpoint:'https://script.google.com/macros/s/QA/exec'}},
  location:{search:'?bantuan=1'},URLSearchParams,crypto:{randomUUID:()=> '12345678-1234-4123-8123-123456789abc'},
  sessionStorage:{getItem:()=> 'staff-session'},AbortSignal:{timeout:()=>({})},Uint8Array,
  Option:function(name,id){this.textContent=name;this.value=id;},
  FileReader:class{readAsDataURL(){this.result='data:application/pdf;base64,JVBERi0xLjQ=';this.onload();}},
  fetch:async(_url,options)=>{const p=JSON.parse(options.body);calls.push(p);return {ok:true,json:async()=>p.action==='urusetiaSession'?{status:'ok'}:p.action==='tahlilPackages'?{status:'ok',open,state:open?'open':'closed',season:{id:'1449H',name:'Ramadan 1449H',version:3,opensAt:'2027-11-21T11:00',closesAt:'2027-11-21T13:00'},packages:[{id:'RM50',name:'PAKEJ RM50'}]}:result};}
 });
 vm.runInContext(read('daftar.js'),context);
 return {...d,calls};
}
test('assisted registration sends server-issued season ID and revision',async()=>{
 const f=registration();await settle();await f.get('daftar').events.submit({preventDefault(){}});
 const p=f.calls.find(p=>p.action==='tahlilAssistedRegister');
 assert.equal(p.seasonId,'1449H');assert.equal(p.seasonVersion,3);
 assert.equal(f.get('registration-title').textContent.includes('1449H'),true);
});
test('closed catalogue keeps registration hidden and identifies closure',async()=>{
 const f=registration({open:false});await settle();
 assert.equal(f.get('daftar').hidden,true);assert.equal(f.get('google-login').hidden,true);
 assert.equal(f.get('status').textContent.toLowerCase().includes('ditutup'),true);
});
test('stale session response stops resubmission and asks for refreshed session',async()=>{
 const f=registration({result:{status:'season_changed'}});await settle();await f.get('daftar').events.submit({preventDefault(){}});
 assert.equal(f.get('daftar').hidden,true);assert.equal(f.get('status').textContent.toLowerCase().includes('sesi'),true);
});
function staff(activeId='1448H'){
 const d=dom(),calls=[],store=new Map([['tahlil-urusetia-session','staff-session']]);
 const items=[{id:'1448H',name:'Ramadan 1448H',version:1,active:true,enabled:true,receiptReady:true,opensAt:'2026-11-21T11:00',closesAt:'2026-11-21T13:00'},
 {id:'1449H',name:'Ramadan 1449H',version:2,active:false,enabled:false,receiptReady:false,opensAt:'2027-11-21T11:00',closesAt:'2027-11-21T13:00'}];
 const context=vm.createContext({
  document:d.document,window:{urusetiaConfig:{clientId:'test.apps.googleusercontent.com',endpoint:'https://script.google.com/macros/s/QA/exec'},confirm:()=>true},
  location:{pathname:'/urusetia.html',replace(){}},
  sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  AbortSignal:{timeout:()=>({})},URL,Option:function(name,id){this.textContent=name;this.value=id;},
  fetch:async(_url,options)=>{const p=JSON.parse(options.body);calls.push(p);
   return {ok:true,json:async()=>p.action==='urusetiaSession'?{status:'ok',email:'staff@example.test'}:p.action==='tahlilSeasonList'?{status:'ok',items,activeId}:p.action==='tahlilSeasonSave'?{status:'ok'}:{status:'ok',items:[],total:0}};
  }
 });
 vm.runInContext(read('urusetia.js'),context);return {...d,calls};
}
test('archive selection scopes both payment queue and history',async()=>{
 const f=staff();await settle();f.calls.length=0;f.get('season-view').value='1449H';
 assert.equal(typeof f.get('season-view').events.change,'function');
 await f.get('season-view').events.change();await settle();
 for(const action of ['tahlilPaymentQueue','tahlilReceiptHistory']){
  const p=f.calls.find(p=>p.action===action);assert.equal(p.seasonId,'1449H');
 }
});
test('settings save sends expected version and local date strings',async()=>{
 const f=staff();await settle();f.get('season-edit').value='1449H';f.get('season-edit').events.change();
 f.get('season-opens').value='2027-11-20T10:00';f.get('season-closes').value='2027-11-25T22:00';
 await f.get('season-form').events.submit({preventDefault(){}});await settle();
 const p=f.calls.find(p=>p.action==='tahlilSeasonSave');
 assert.equal(p.id,'1449H');assert.equal(p.version,2);assert.equal(p.opensAt,'2027-11-20T10:00');assert.equal(p.closesAt,'2027-11-25T22:00');
 assert.equal(p.activate,false);assert.equal(p.receiptReady,false);
});

test('first dashboard load selects the active season instead of always 1448H',async()=>{
 const f=staff('1449H');await settle();
 assert.equal(f.calls.find(p=>p.action==='tahlilPaymentQueue').seasonId,'1449H');
});
test('future season updates public labels and hides the old-year poster',async()=>{
 const d=dom(),poster=d.get('season-poster');poster.dataset={seasonPoster:'1448H'};
 d.document.querySelectorAll=()=>[d.get('season-name')];
 const context=vm.createContext({document:d.document,window:{urusetiaConfig:{endpoint:'https://script.google.com/macros/s/QA/exec'}},
  AbortSignal:{timeout:()=>({})},Intl,
  fetch:async()=>({ok:true,json:async()=>({status:'ok',open:true,state:'open',season:{id:'1449H',name:'Ramadan 1449H'},packages:[{id:'RM70',name:'PAKEJ RM70',price:70}]})})});
 vm.runInContext(read('season-public.js'),context);await settle();
 assert.equal(d.get('season-name').textContent,'Ramadan 1449H');assert.equal(poster.hidden,true);
 assert.equal(d.get('season-status').textContent.includes('dibuka'),true);
 assert.equal(d.get('season-packages').children.length,1);
});
