const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// ===== เครื่องมือสี =====
const hexRgb=h=>{const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]};
function rgbHsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}return[h,s,l]}
function hslHex(h,s,l){h=((h%360)+360)%360;const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,"0")};return"#"+f(0)+f(8)+f(4)}
function lum(hex){return hexRgb(hex).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)}
const hsl=hex=>rgbHsl(...hexRgb(hex));

// ===== สร้างชุดสีจากสีหลัก/สีรอง =====
function makeBase(h1,h2,dark,s1=.7,s2=.6){
  return dark
   ?{bg:hslHex(h1,.35,.14),key:hslHex(h1,.3,.29),op:hslHex(h1,clamp(s1,.55,.9),.62),eq:hslHex(h2,clamp(s2,.5,.85),.58)}
   :{bg:hslHex(h1,.6,.93),key:hslHex(h1,.5,.94),op:hslHex(h1,clamp(s1,.5,.85),.58),eq:hslHex(h2,clamp(s2,.45,.8),.4)};
}
function applyBase(b){
  const [h,s,l]=hsl(b.bg), dark=lum(b.bg)<.3, [kh,ks,kl]=hsl(b.key);
  const v={"--bg":b.bg,"--bg2":hslHex(h,s,clamp(l+(dark?-.05:-.07),0,1)),"--panel":dark?hslHex(h,.3,.2):hslHex(h,.5,.99),
   "--key":b.key,"--keytext":lum(b.key)>.4?hslHex(kh,.5,.16):hslHex(kh,.4,.95),"--op":b.op,"--eq":b.eq,
   "--optext":lum(b.op)>.4?"#1c1c1c":"#ffffff","--eqtext":lum(b.eq)>.4?"#1c1c1c":"#ffffff",
   "--screen":dark?hslHex(h,.3,.09):hslHex(h,.5,.97),"--screentext":dark?hslHex(h,.5,.92):hslHex(h,.5,.15),"--shadow":hslHex(kh,ks,clamp(kl-.14,0,1))};
  for(const k in v)document.documentElement.style.setProperty(k,v[k]);
  const inp=$("pick").querySelectorAll("input");inp.forEach(i=>i.value=b[i.dataset.k]);
}

// ===== ดึงสีเด่นจากรูป =====
function extract(canvas){
  const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d");x.drawImage(canvas,0,0,64,64);
  const d=x.getImageData(0,0,64,64).data,bins=Array.from({length:24},()=>({w:0,s:0,h:0,hx:0,hy:0}));
  let tot=0;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<128)continue;
    const [h,s,l]=rgbHsl(d[i],d[i+1],d[i+2]);
    if(s<.22||l<.12||l>.92)continue;
    const w=s*(1-Math.abs(2*l-1))+.02,b=bins[Math.floor(h/15)%24];
    b.w+=w;b.s+=s*w;b.hx+=Math.cos(h*Math.PI/180)*w;b.hy+=Math.sin(h*Math.PI/180)*w;tot+=w;
  }
  const hue=b=>(Math.atan2(b.hy,b.hx)*180/Math.PI+360)%360;
  const sorted=bins.filter(b=>b.w>0).sort((a,b)=>b.w-a.w);
  if(!sorted.length||tot<3)return{h1:210,h2:260,s1:.5,s2:.5};
  const p=sorted[0],h1=hue(p);
  const dist=(a,b)=>{const t=Math.abs(a-b)%360;return t>180?360-t:t};
  const q=sorted.find(b=>dist(hue(b),h1)>=40&&b.w>p.w*.12);
  return{h1,s1:p.s/p.w,h2:q?hue(q):h1+35,s2:q?q.s/q.w:.6};
}

// ===== สถานะธีม =====
let T={h1:150,h2:340,dark:false,s1:.7,s2:.6,name:"",img:null,base:null};
const PRESETS=[["มินต์ชมพู",150,340,false],["ราตรี",270,30,true],["ทะเล",205,170,false],["พีช",22,350,false]];
const PK=[["bg","พื้นหลัง"],["key","ปุ่มตัวเลข"],["op","ปุ่มตัวดำเนินการ"],["eq","ปุ่มเท่ากับ"]];
$("pick").innerHTML=PK.map(([k,t])=>`<label><input type="color" data-k="${k}">${t}</label>`).join("");
$("chips").innerHTML=PRESETS.map((p,i)=>{const b=makeBase(p[1],p[2],p[3]);return`<button class="chip" data-i="${i}"><i style="background:linear-gradient(135deg,${b.op} 50%,${b.eq} 50%)"></i>${p[0]}</button>`}).join("");
function rebuild(){T.base=makeBase(T.h1,T.h2,T.dark,T.s1,T.s2);applyBase(T.base);save()}
$("pick").addEventListener("input",e=>{T.base[e.target.dataset.k]=e.target.value;applyBase(T.base);save()});
$("chips").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const p=PRESETS[b.dataset.i];T.h1=p[1];T.h2=p[2];T.dark=p[3];T.s1=.7;T.s2=.6;$("dark").checked=T.dark;rebuild();react("hi")});
$("dark").addEventListener("change",e=>{T.dark=e.target.checked;rebuild()});
$("name").addEventListener("input",e=>{T.name=e.target.value;save()});
$("clearImg").addEventListener("click",()=>{setImg(null);save();react("hi")});

// ===== รูปตัวละคร =====
function setImg(url){
  T.img=url;$("img").hidden=!url;$("mascot").style.display=url?"none":"";
  if(url)$("img").src=url;$("bgimg").style.backgroundImage=url?`url(${url})`:"none";
}
function loadFile(f){
  if(!f||!f.type.startsWith("image/"))return;
  const r=new FileReader();
  r.onload=()=>{const im=new Image();im.onload=()=>{
    const m=Math.min(1,360/Math.max(im.width,im.height)),c=document.createElement("canvas");
    c.width=Math.round(im.width*m);c.height=Math.round(im.height*m);c.getContext("2d").drawImage(im,0,0,c.width,c.height);
    const e=extract(c);Object.assign(T,{h1:e.h1,h2:e.h2,s1:e.s1,s2:e.s2});
    setImg(c.toDataURL(f.type==="image/png"?"image/png":"image/jpeg",.85));rebuild();react("new");
  };im.src=r.result};r.readAsDataURL(f);
}
$("file").addEventListener("change",e=>loadFile(e.target.files[0]));
const dz=$("drop");
["dragover","dragenter"].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add("over")}));
["dragleave","drop"].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove("over")}));
dz.addEventListener("drop",e=>loadFile(e.dataTransfer.files[0]));
function save(){try{localStorage.setItem("char-calc",JSON.stringify(T))}catch(e){}}
function restore(){try{const s=JSON.parse(localStorage.getItem("char-calc")||"null");if(s&&s.base){Object.assign(T,s);$("name").value=T.name||"";$("dark").checked=!!T.dark;setImg(T.img);applyBase(T.base);return true}}catch(e){}return false}

// ===== ตัวละครพูด =====
const LINES={hi:["พร้อมคิดเลขแล้ว!","มาเริ่มกันเลย","วันนี้จะคิดอะไรดี?"],ok:["ได้คำตอบแล้ว!","เสร็จเรียบร้อย","ง่ายมาก!"],err:["หารด้วยศูนย์ไม่ได้นะ","อันนี้คิดไม่ได้จ้า"],clr:["ล้างให้แล้ว","เริ่มใหม่!"],new:["ชอบสีนี้จัง! ปรับธีมให้แล้ว"]};
function react(k){
  const n=T.name?T.name+": ":"",a=LINES[k];$("bubble").textContent=n+a[Math.floor(Math.random()*a.length)];
  const av=$("avatar");av.classList.remove("hop","shake");void av.offsetWidth;av.classList.add(k==="err"?"shake":"hop");
}

// ===== เครื่องคิดเลข =====
let cs="0",acc=null,op=null,fresh=true,exprText="";const hist=[];
const OPS={"+":(a,b)=>a+b,"−":(a,b)=>a-b,"×":(a,b)=>a*b,"÷":(a,b)=>a/b};
const group=s=>{const[i,d]=s.split(".");const neg=i.startsWith("-");return(neg?"-":"")+(neg?i.slice(1):i).replace(/\B(?=(\d{3})+(?!\d))/g,",")+(d!==undefined?"."+d:"")};
const fmt=n=>{if(!isFinite(n))return"ผิดพลาด";const s=String(parseFloat(n.toPrecision(12)));return s.includes("e")?s:group(s)};
function render(){$("val").textContent=cs==="ผิดพลาด"?cs:group(cs);$("expr").textContent=exprText;
  $("hist").innerHTML=hist.length?hist.map((h,i)=>`<li data-i="${i}"><span>${h.e}</span><b>${fmt(h.r)}</b></li>`).join(""):'<li class="empty">ยังไม่มีประวัติ</li>'}
function fail(){cs="ผิดพลาด";exprText="";acc=null;op=null;fresh=true;react("err");render()}
function compute(){const b=parseFloat(cs);if(op===null||acc===null)return b;if(op==="÷"&&b===0)return NaN;return OPS[op](acc,b)}
function press(k){
  if(cs==="ผิดพลาด"){if(k!=="C")return}
  if(/^\d$/.test(k)){if(fresh){cs=k;fresh=false}else if(cs.replace(/\D/g,"").length<14)cs=cs==="0"?k:cs+k}
  else if(k==="."){if(fresh){cs="0.";fresh=false}else if(!cs.includes("."))cs+="."}
  else if(k==="C"){cs="0";acc=null;op=null;fresh=true;exprText="";react("clr")}
  else if(k==="⌫"){if(!fresh)cs=cs.length>1&&!(cs.length===2&&cs[0]==="-")?cs.slice(0,-1):"0"}
  else if(k==="±"){if(cs!=="0")cs=cs.startsWith("-")?cs.slice(1):"-"+cs}
  else if(k==="%"){cs=String(parseFloat(cs)/100);fresh=true}
  else if(k==="x²"||k==="√"||k==="1/x"){
    const v=parseFloat(cs);if((k==="√"&&v<0)||(k==="1/x"&&v===0))return fail();
    const r=k==="x²"?v*v:k==="√"?Math.sqrt(v):1/v;exprText=(k==="x²"?`(${fmt(v)})²`:k==="√"?`√(${fmt(v)})`:`1/(${fmt(v)})`);
    cs=String(parseFloat(r.toPrecision(12)));fresh=true;hist.unshift({e:exprText,r});hist.length=Math.min(hist.length,12);react("ok")}
  else if(k==="="){
    if(op===null)return;const r=compute();if(isNaN(r))return fail();
    const e=`${exprText} ${fmt(parseFloat(cs))}`;hist.unshift({e,r});hist.length=Math.min(hist.length,12);
    cs=String(parseFloat(r.toPrecision(12)));acc=null;op=null;fresh=true;exprText=e+" =";react("ok")}
  else{
    if(op!==null&&!fresh){const r=compute();if(isNaN(r))return fail();acc=r}else acc=parseFloat(cs);
    op=k;fresh=true;exprText=fmt(acc)+" "+k;cs=String(parseFloat(acc.toPrecision(12)))}
  render();
}
const KEYS=[["C"],["⌫"],["%"],["÷","op"],["x²","sm"],["√","sm"],["1/x","sm"],["×","op"],["7"],["8"],["9"],["−","op"],["4"],["5"],["6"],["+","op"],["1"],["2"],["3"],["=","eq"],["±"],["0"],["."]];
$("keys").innerHTML=KEYS.map(([k,c])=>`<button class="${c||""}" data-k="${k}">${k}</button>`).join("");
$("keys").addEventListener("click",e=>{const b=e.target.closest("button");if(b)press(b.dataset.k)});
$("hist").addEventListener("click",e=>{const li=e.target.closest("li[data-i]");if(li){cs=String(hist[li.dataset.i].r);fresh=true;acc=null;op=null;exprText="";render()}});
document.addEventListener("keydown",e=>{
  if(/INPUT|TEXTAREA/.test(e.target.tagName)&&e.target.type!=="checkbox"&&e.target.type!=="color")return;
  const m={"*":"×","/":"÷","-":"−",Enter:"=",Escape:"C",Backspace:"⌫",",":"."},k=m[e.key]||e.key;
  if(/^[\d.+=%]$/.test(k)||["×","÷","−","C","⌫"].includes(k)){e.preventDefault();press(k)}
});

// ===== เริ่มต้น =====
if(!restore())rebuild();
render();react("hi");

// ===== สุ่มชุดฟอนต์ (เพิ่มใหม่ — ไม่แตะโค้ดเดิม) =====
// style.css มี 6 ชุด: data-font="1".."6"
// สุ่มตอนเปิดหน้า, ตอนใส่รูปตัวละครใหม่ และตอนกดที่รูปอวตาร
function randomFont(){
  const cur=document.documentElement.dataset.font;let n;
  do{n=String(1+Math.floor(Math.random()*6))}while(n===cur);
  document.documentElement.dataset.font=n;
}
randomFont();
$("avatar").title="กดเพื่อสุ่มฟอนต์ใหม่";
$("avatar").addEventListener("click",randomFont);
$("file").addEventListener("change",randomFont);
$("drop").addEventListener("drop",randomFont);
