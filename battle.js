/* ==========================================================
   โหมดท้าสู้ 1v1 — แข่งตอบโจทย์เลขเร็ว (หลอด HP)
   ใช้ตัวแปร/ฟังก์ชันจาก script.js: T, cs, fresh, exprText, press
   ออนไลน์ใช้ PeerJS (WebRTC) ห้องสร้างด้วยรหัส 5 ตัว
   ========================================================== */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const ROUND_MS=25000,FREEZE_MS=3000,HP0=100,PREFIX="calcduel-";
let S=null,net=null,frozen=false,frozenTO=null;
const now=()=>performance.now();
// STUN ช่วยให้เชื่อมข้ามเครือข่ายได้ ถ้าบางเครือข่ายยังเชื่อมไม่ติด ให้เพิ่ม TURN server ของคุณตรงนี้
const PEER_OPTS={config:{iceServers:[
  {urls:"stun:stun.l.google.com:19302"},{urls:"stun:global.stun.twilio.com:3478"}
  // ,{urls:"turn:YOUR_TURN_HOST:3478",username:"USER",credential:"PASS"}
]}};
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const other=k=>k==="p1"?"p2":"p1";
const myKey=()=>S.mode==="guest"?"p2":"p1";
const elOf=k=>k===myKey()?$("fL"):$("fR");
const dmgFor=ms=>15+(ms<4000?15:ms<8000?10:ms<14000?5:0);

/* ---------- ชุดโจทย์ (แก้/เพิ่มชุดใหม่ได้ที่นี่) ----------
   แต่ละชุดคืนค่า {q: ข้อความโจทย์, a: คำตอบ (ตัวเลข), tag: ชื่อที่โชว์ใน HUD}
   เพิ่มชุดใหม่: เขียนฟังก์ชันใน PACKS แล้วเพิ่ม <option value="ชื่อ"> ใน index.html */
const PACKS={
  classic:n=>{
    let q,a;
    if(n<=2){const x=rnd(12,99),y=rnd(12,99);if(Math.random()<.5){q=`${x} + ${y}`;a=x+y}else{q=`${Math.max(x,y)} − ${Math.min(x,y)}`;a=Math.abs(x-y)}}
    else if(n<=5){const x=rnd(12,49),y=rnd(3,9);q=`${x} × ${y}`;a=x*y}
    else if(n<=8){const y=rnd(3,12),k=rnd(6,30);q=`${y*k} ÷ ${y}`;a=k}
    else{const x=rnd(11,30),y=rnd(3,9),z=rnd(10,99);q=`${x} × ${y} + ${z}`;a=x*y+z}
    return{q:q+" = ?",a,tag:"บวก ลบ คูณ หาร"};
  },
  missing:()=>{
    const t=rnd(0,3),b=rnd(3,12),x=rnd(4,40);let q,a;
    if(t===0){q=`□ + ${b*3} = ${x+b*3}`;a=x}
    else if(t===1){q=`□ − ${b*2} = ${x}`;a=x+b*2}
    else if(t===2){q=`□ × ${b} = ${x*b}`;a=x}
    else{q=`${x*b} ÷ □ = ${b}`;a=x}
    return{q,a,tag:"หาเลขที่หายไป"};
  },
  percent:()=>{
    const pct=[10,20,25,50,75][rnd(0,4)],base=rnd(2,30)*20;
    return{q:`${pct}% ของ ${base} = ?`,a:pct*base/100,tag:"เปอร์เซ็นต์"};
  },
  sequence:()=>{
    let t;
    if(Math.random()<.7){const s=rnd(1,30),d=rnd(3,12);t=[0,1,2,3,4].map(i=>s+d*i)}
    else{const s=rnd(1,5),r=rnd(2,3);t=[0,1,2,3,4].map(i=>s*Math.pow(r,i))}
    return{q:t.slice(0,4).join(" , ")+" , □",a:t[4],tag:"ลำดับตัวเลข"};
  },
  power:()=>{
    if(Math.random()<.5){const n=rnd(11,35);return{q:`${n}² = ?`,a:n*n,tag:"ยกกำลัง / ราก"}}
    const n=rnd(11,45);return{q:`√${n*n} = ?`,a:n,tag:"ยกกำลัง / ราก"};
  },
  decimal:()=>{
    const f=()=>rnd(2,40)+[0,.25,.5,.75][rnd(0,3)],x=f(),y=f(),t=rnd(0,2);let q,a;
    if(t===0){q=`${x} + ${y}`;a=x+y}
    else if(t===1){q=`${Math.max(x,y)} − ${Math.min(x,y)}`;a=Math.abs(x-y)}
    else{const m=rnd(2,9);q=`${x} × ${m}`;a=x*m}
    return{q:q+" = ?",a,tag:"ทศนิยม"};
  }
};
const PACK_KEYS=Object.keys(PACKS);
function gen(n){
  const sel=$("pack")?$("pack").value:"mixed";
  const k=sel==="mixed"?(n===1?"classic":PACK_KEYS[rnd(0,PACK_KEYS.length-1)]):sel;
  return PACKS[k](n);
}
const rndText=(n,tag)=>`รอบที่ ${n}${tag?" · "+tag:""}`;

/* ---------- ข้อมูลผู้เล่น ---------- */
function thumb(url){return new Promise(r=>{
  if(!url)return r(null);const i=new Image();
  i.onload=()=>{const c=document.createElement("canvas");c.width=c.height=96;const s=Math.min(i.width,i.height);
    c.getContext("2d").drawImage(i,(i.width-s)/2,(i.height-s)/2,s,s,0,0,96,96);r(c.toDataURL("image/jpeg",.8))};
  i.onerror=()=>r(null);i.src=url})}
async function mine(){return{name:(T.name||"").trim()||"ผู้เล่น",img:await thumb(T.img),col:T.base.op}}
const ph=()=>({name:"…",img:null,col:"#888888"});

/* ---------- HUD ---------- */
function buildHud(){
  const f=id=>`<div class="fighter" id="${id}"><div class="pic"></div><div class="fname"></div><div class="hpbar"><i></i></div><div class="hptxt"></div></div>`;
  $("hud").innerHTML=f("fL")+`<div class="center"><div class="rnd" id="rnd"></div><div class="prob" id="prob"></div><div class="tbar"><i id="tbar"></i></div><div class="bmsg" id="bmsg" aria-live="polite"></div><div class="acts"><button class="primary" id="bAct" hidden></button><button class="ghost" id="bQuit">ออกจากการสู้</button></div></div>`+f("fR");
  $("bQuit").onclick=quit;
}
function fill(el,i){
  const p=el.querySelector(".pic");p.style.backgroundImage=i.img?`url(${i.img})`:"none";
  p.textContent=i.img?"":(i.name||"?").slice(0,1);
  el.querySelector(".fname").textContent=i.name;el.style.setProperty("--c",i.col);
}
function renderHud(){fill($("fL"),S.info[myKey()]);fill($("fR"),S.info[other(myKey())]);renderHp()}
function renderHp(){
  for(const k of["p1","p2"]){const el=elOf(k);el.querySelector(".hpbar i").style.width=S.hp[k]+"%";el.querySelector(".hptxt").textContent=S.hp[k]+" HP"}
}
const setMsg=t=>{$("bmsg").textContent=t};
const setProb=t=>{$("prob").textContent=t};
function act(label,fn){const b=$("bAct");b.hidden=!label;b.textContent=label||"";b.onclick=fn||null}
function pulse(el,cls){el.classList.remove("hit","win");void el.offsetWidth;el.classList.add(cls)}
function startTimer(ms,end){
  stopTimer();const t0=now();$("tbar").style.width="100%";const s=S;
  S.tm=setInterval(()=>{const p=Math.min(1,(now()-t0)/ms);$("tbar").style.width=(100-p*100)+"%";if(p>=1){stopTimer();if(S===s&&end)end()}},100);
}
function stopTimer(){if(S&&S.tm){clearInterval(S.tm);S.tm=null}}

/* ---------- เริ่ม/จบเซสชัน ---------- */
function begin(mode){
  S={mode,n:0,over:false,hp:{p1:HP0,p2:HP0},cur:null,tm:null,started:false,info:{p1:ph(),p2:ph()}};
  document.body.classList.add("battle-on");$("hud").hidden=false;
  if($("lobby").open)$("lobby").close();renderHud();act(null);setProb("");$("rnd").textContent="";
}
function quit(){
  stopTimer();unfreeze();
  if(S&&S.conn){try{S.conn.close()}catch(e){}}
  if(net){try{net.destroy()}catch(e){}net=null}
  S=null;$("hud").hidden=true;document.body.classList.remove("battle-on");
}
function lost(){if(S&&!S.over){S.over=true;stopTimer();setMsg("การเชื่อมต่อหลุด — กดออกแล้วสร้างห้องใหม่");act(null)}}

/* ---------- ตอบผิด = โดนล็อกเครื่อง 3 วินาที ---------- */
function freeze(){
  frozen=true;document.querySelector(".calc").classList.add("frozen");setMsg("ตอบผิด! ล็อกเครื่อง 3 วินาที");
  clearTimeout(frozenTO);frozenTO=setTimeout(unfreeze,FREEZE_MS);
}
function unfreeze(){frozen=false;clearTimeout(frozenTO);const c=document.querySelector(".calc");if(c)c.classList.remove("frozen");if(S&&S.cur&&!S.over&&!S.cur.done&&S.cur.q)setMsg("")}
document.addEventListener("click",e=>{if(frozen&&e.target.closest(".keys")){e.stopPropagation();e.preventDefault()}},true);
window.addEventListener("keydown",e=>{if(frozen&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.stopImmediatePropagation();e.preventDefault()}},true);

/* ---------- ผลของรอบ (ใช้ร่วมกันทุกโหมด) ---------- */
function settle(w,ms){
  const s=S,dmg=w?dmgFor(ms):0;
  if(w)S.hp[other(w)]=Math.max(0,S.hp[other(w)]-dmg);
  const r={t:"result",n:S.n,w,dmg,hp:{...S.hp},ans:S.cur.ans,over:S.hp.p1<=0||S.hp.p2<=0};
  if(S.mode==="host")send(r);
  applyRes(r);
  if(!r.over)setTimeout(()=>{if(S!==s||S.over)return;S.mode==="host"?hostRound():nextRoundLocal()},S.mode==="host"?3200:2600);
}
function applyRes(r){
  stopTimer();unfreeze();S.hp=r.hp;S.over=r.over;if(S.cur)S.cur.done=true;renderHp();
  if(r.w){pulse(elOf(other(r.w)),"hit");pulse(elOf(r.w),"win")}
  setProb("= "+r.ans);
  if(r.over){setMsg(`🏆 ${S.info[r.w].name} ชนะ!`);act("สู้อีกครั้ง",rematch)}
  else setMsg(r.w?`${S.info[r.w].name} ตอบถูก! ${S.info[other(r.w)].name} −${r.dmg} HP`:"หมดเวลา! ไม่มีใครโดนดาเมจ");
}
function resetGame(){S.n=0;S.hp={p1:HP0,p2:HP0};S.over=false;renderHp()}
function rematch(){
  if(S.mode==="local"){resetGame();nextRoundLocal()}
  else if(S.mode==="host"){resetGame();hostRound()}
  else{send({t:"rematchReq"});setMsg("รอเพื่อนเริ่มใหม่…");act(null)}
}

/* ---------- โหมดเล่นเครื่องเดียว (สลับกันตอบ) ---------- */
function startLocal(){
  begin("local");
  S.info.p1={name:(T.name||"").trim()||"ผู้เล่น 1",img:T.img,col:T.base.op};
  S.info.p2={name:$("p2name").value.trim()||"ผู้เล่น 2",img:null,col:T.base.eq};
  renderHud();nextRoundLocal();
}
function nextRoundLocal(){
  S.n++;const g=gen(S.n);S.cur={q:g.q,ans:g.a,tag:g.tag,res:{},turn:null,done:false};
  $("rnd").textContent=rndText(S.n,S.cur.tag);setProb("? ? ?");$("tbar").style.width="100%";
  setMsg("ทั้งคู่ได้โจทย์เดียวกัน ใครตอบถูกและเร็วกว่าเป็นผู้โจมตี");act(`เริ่มตา ${S.info.p1.name}`,()=>beginTurn("p1"));
}
function beginTurn(k){
  act(null);S.cur.turn=k;S.cur.start=now();setProb(S.cur.q);setMsg(`ตาของ ${S.info[k].name} — กด = เพื่อส่งคำตอบ`);
  press("C");startTimer(ROUND_MS,()=>endTurn(k,false,ROUND_MS));
}
function endTurn(k,ok,ms){
  stopTimer();unfreeze();S.cur.res[k]={ok,ms};S.cur.turn=null;setProb("✓ ส่งคำตอบแล้ว");
  if(k==="p1"){setMsg(ok?"ตอบถูก! ซ่อนหน้าจอไว้แล้วส่งต่อ":"หมดเวลา — ส่งต่อให้เพื่อน");act(`ส่งเครื่องให้ ${S.info.p2.name} แล้วกดเริ่ม`,()=>beginTurn("p2"))}
  else{
    const a=S.cur.res.p1,b=S.cur.res.p2;
    const w=a.ok&&b.ok?(a.ms<=b.ms?"p1":"p2"):a.ok?"p1":b.ok?"p2":null;
    settle(w,w?S.cur.res[w].ms:0);
  }
}

/* ---------- โหมดออนไลน์ ---------- */
function send(m){try{S.conn.send(m)}catch(e){}}
let curCode="";
function inviteUrl(){const u=new URL(location.href);u.search="";u.hash="";u.searchParams.set("room",curCode);return u.toString()}
function lobbyMsg(t,code){$("lobbyMsg").textContent=t;$("roomCode").textContent=code||"";curCode=code||"";$("bCopy").hidden=!code}
function mkCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<5;i++)s+=c[rnd(0,c.length-1)];return s}
function needPeer(){if(typeof Peer==="undefined"){lobbyMsg("โหลด PeerJS ไม่สำเร็จ — ต้องต่ออินเทอร์เน็ต");return false}return true}
function hostRoom(){
  if(!needPeer())return;if(net){try{net.destroy()}catch(e){}}
  const code=mkCode();lobbyMsg("กำลังสร้างห้อง…");
  const p=net=new Peer(PREFIX+code,PEER_OPTS);
  p.on("open",()=>lobbyMsg("ส่งรหัสนี้ให้เพื่อน แล้วรอเพื่อนเข้าห้อง",code));
  p.on("connection",c=>{if(S){c.close();return}setupConn(c,true)});
  p.on("error",e=>{if(e.type==="unavailable-id")hostRoom();else lobbyMsg("เกิดข้อผิดพลาด: "+e.type)});
}
function joinRoom(){
  if(!needPeer())return;const code=$("joinCode").value.trim().toUpperCase();
  if(code.length!==5){lobbyMsg("ใส่รหัสห้อง 5 ตัวอักษร");return}
  if(net){try{net.destroy()}catch(e){}}
  lobbyMsg("กำลังเชื่อมต่อ…");const p=net=new Peer(undefined,PEER_OPTS);
  p.on("open",()=>{const c=p.connect(PREFIX+code,{reliable:true});setupConn(c,false);
    setTimeout(()=>{if(!S)lobbyMsg("เชื่อมต่อไม่ได้ — เช็กรหัสห้องหรือให้เพื่อนสร้างห้องใหม่")},9000)});
  p.on("error",e=>lobbyMsg(e.type==="peer-unavailable"?"ไม่พบห้องนี้ — เช็กรหัสอีกครั้ง":"เกิดข้อผิดพลาด: "+e.type));
}
function setupConn(c,host){
  begin(host?"host":"guest");S.conn=c;
  c.on("data",onMsg);c.on("close",lost);c.on("error",lost);
  const hi=async()=>{const w=await mine();S.info[myKey()]=w;renderHud();send({t:"hello",who:w});setMsg("รอเพื่อนพร้อม…")};
  c.open?hi():c.on("open",hi);
}
function onMsg(m){
  if(!S)return;
  if(m.t==="hello"){
    S.info[other(myKey())]=m.who;renderHud();
    if(S.mode==="host"&&!S.started){S.started=true;const s=S;setTimeout(()=>{if(S===s)hostRound()},1200)}
  }
  else if(m.t==="round"){
    S.n=m.n;S.hp=m.hp;S.over=false;S.cur={q:m.q,tag:m.tag,start:now(),done:false};renderHp();act(null);
    $("rnd").textContent=rndText(m.n,m.tag);setProb(m.q);setMsg("คิดให้ไว แล้วกด = เพื่อส่งคำตอบ");press("C");startTimer(ROUND_MS);
  }
  else if(m.t==="ans"&&S.mode==="host")hostAnswer("p2",m.v,m.ms);
  else if(m.t==="wrong")freeze();
  else if(m.t==="result")applyRes(m);
  else if(m.t==="rematchReq"&&S.mode==="host"&&S.over){resetGame();hostRound()}
}
function hostRound(){
  S.n++;const g=gen(S.n);S.cur={q:g.q,ans:g.a,tag:g.tag,start:now(),done:false};act(null);
  send({t:"round",n:S.n,q:g.q,tag:g.tag,hp:S.hp});
  $("rnd").textContent=rndText(S.n,S.cur.tag);setProb(g.q);setMsg("คิดให้ไว แล้วกด = เพื่อส่งคำตอบ");press("C");
  startTimer(ROUND_MS,()=>{if(S.cur&&!S.cur.done)settle(null,ROUND_MS)});
}
function hostAnswer(k,v,ms){
  if(!S.cur||S.cur.done)return;
  if(Math.abs(v-S.cur.ans)<1e-9)settle(k,ms);
  else if(k==="p1")freeze();else send({t:"wrong"});
}

/* ---------- ส่งคำตอบเมื่อกด = ---------- */
function submit(){
  if(!S||S.over||frozen)return;
  if(typeof fresh!=="undefined"&&fresh&&!/=$/.test(exprText))return; // ยังไม่ได้คำนวณอะไร
  const v=parseFloat(cs);if(cs==="ผิดพลาด"||isNaN(v))return;
  const c=S.cur;if(!c||c.done)return;const ms=now()-c.start;
  if(S.mode==="local"){
    if(!c.turn)return;
    if(Math.abs(v-c.ans)<1e-9)endTurn(c.turn,true,ms);else freeze();
  }else if(S.mode==="host")hostAnswer("p1",v,ms);
  else send({t:"ans",v,ms});
}
$("keys").addEventListener("click",e=>{const b=e.target.closest("button");if(b&&b.dataset.k==="=")setTimeout(submit,0)});
document.addEventListener("keydown",e=>{
  if(/INPUT|TEXTAREA/.test(e.target.tagName)&&e.target.type==="text")return;
  if(e.key==="Enter"||e.key==="=")setTimeout(submit,0);
});

/* ---------- ล็อบบี้ ---------- */
buildHud();
$("battleBtn").onclick=()=>{lobbyMsg("");$("lobby").showModal()};
$("lobbyClose").onclick=()=>$("lobby").close();
$("lobby").addEventListener("close",()=>{if(!S&&net){try{net.destroy()}catch(e){}net=null}});
$("bLocal").onclick=startLocal;
$("bHost").onclick=hostRoom;
$("bJoin").onclick=joinRoom;
$("bCopy").onclick=async()=>{
  const url=inviteUrl();
  try{await navigator.clipboard.writeText(url);$("bCopy").textContent="คัดลอกแล้ว ✓"}
  catch(e){window.prompt("คัดลอกลิงก์นี้ส่งให้เพื่อน",url)}
  setTimeout(()=>{$("bCopy").textContent="คัดลอกลิงก์เชิญ"},2000);
};
// เปิดลิงก์เชิญ (?room=XXXXX) แล้วเข้าห้องให้อัตโนมัติ
const inv=new URLSearchParams(location.search).get("room");
if(inv&&/^[A-Za-z0-9]{5}$/.test(inv)){$("joinCode").value=inv.toUpperCase();$("lobby").showModal();joinRoom()}
})();
