/* ============================================================
   PORCH GAME SHOW — curtains, marquee, spin wheel
   Self-mounting into #gs-host (same pattern as the runner engine)
   so the React shell can re-render around it safely.
   ============================================================ */
(function(){
if (window.__GS_LOADED__) return; window.__GS_LOADED__ = true;

/* ---- audio (independent of the runner) ---- */
let gsA=null;
function gsInit(){ try{ if(!gsA) gsA=new (window.AudioContext||window.webkitAudioContext)();
  if(gsA.state==='suspended') gsA.resume(); }catch(e){} }
function gsTone(f,t,d,v){ try{ gsInit(); const o=gsA.createOscillator(),g=gsA.createGain();
  o.type=t; o.frequency.setValueAtTime(f,gsA.currentTime);
  g.gain.setValueAtTime(v||0.25,gsA.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,gsA.currentTime+d);
  o.connect(g); g.connect(gsA.destination); o.start(); o.stop(gsA.currentTime+d);}catch(e){} }
const gsTick =()=>gsTone(1750,'triangle',0.04,0.07);
const gsDing =()=>{gsTone(880,'sine',0.45,0.30); setTimeout(()=>gsTone(1180,'sine',0.32,0.18),70);};
const gsFan  =()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>gsTone(f,'square',i===3?0.65:0.16,0.24),i*160));

/* ---- state ---- */
let names=[], rot=0, spinning=false, picked='';
let counts={}, history=[];
const WCOL=["#c2185b","#0277bd","#00897b","#f9a825","#7b1fa2","#ef6c00",
            "#00838f","#d81b60","#00c853","#ff8f00","#1565c0","#e53935"];

function loadNames(){
  try{ const raw=localStorage.getItem('pfw_players');
    if(raw){ names=JSON.parse(raw)||[]; } }catch(e){ names=[]; }
}
function saveNames(){ try{ localStorage.setItem('pfw_players',JSON.stringify(names)); }catch(e){} }

/* ---- wheel ---- */
function drawWheel(){
  const cv=document.getElementById('gs-wheel'); if(!cv) return;
  const cx=cv.getContext('2d'); if(!cx) return;
  const n=names.length; if(!n){ cx.clearRect(0,0,cv.width,cv.height); return; }
  const sa=2*Math.PI/n, r=cv.width/2-3, mx=cv.width/2, my=cv.height/2;
  cx.clearRect(0,0,cv.width,cv.height);
  cx.save(); cx.translate(mx,my); cx.rotate(rot);
  for(let i=0;i<n;i++){
    cx.beginPath(); cx.moveTo(0,0); cx.arc(0,0,r,i*sa,(i+1)*sa);
    cx.fillStyle=WCOL[i%WCOL.length]; cx.fill();
    cx.lineWidth=2; cx.strokeStyle='rgba(0,0,0,.28)'; cx.stroke();
    cx.save(); cx.rotate(i*sa+sa/2);
    cx.textAlign='right'; cx.fillStyle='#fff';
    cx.font='800 '+Math.max(10,Math.min(17,Math.floor(130/n)+8))+"px 'Outfit',sans-serif";
    cx.shadowColor='rgba(0,0,0,.65)'; cx.shadowBlur=3;
    let nm=names[i]; if(nm.length>13) nm=nm.slice(0,12)+'…';
    cx.fillText(nm,r-13,4); cx.restore();
  }
  cx.restore();
}
function nameAtPointer(){
  const n=names.length; if(!n) return '';
  const sa=2*Math.PI/n;
  let a=(-rot-Math.PI/2)%(2*Math.PI); if(a<0)a+=2*Math.PI;
  return names[Math.floor(a/sa)%n];
}
function spin(){
  if(spinning||!names.length) return;
  gsInit();
  // prefer someone who hasn't gone recently
  let pool=[]; const recent=history.slice(-Math.max(1,Math.floor(names.length/2)));
  names.forEach((nm,i)=>{ if(!recent.includes(nm)) pool.push(i); });
  if(!pool.length) pool=names.map((_,i)=>i);
  const win=pool[(Math.random()*pool.length)|0];

  spinning=true;
  const btn=document.getElementById('gs-spin'); if(btn){btn.disabled=true;}
  const out=document.getElementById('gs-picked'); if(out) out.textContent='Spinning…';

  const n=names.length, sa=2*Math.PI/n;
  const jit=(Math.random()-0.5)*sa*0.5;
  const target=-Math.PI/2 - win*sa - sa/2 + jit;
  const extra=(6+Math.random()*3)*2*Math.PI;
  const start=rot, delta=(target-extra)-start;
  const dur=4200+Math.random()*1400;
  let t0=null,lastTick=start;
  const ptr=document.getElementById('gs-ptr');
  const ease=t=>1-Math.pow(1-t,5);

  function step(ts){
    if(!t0)t0=ts;
    const p=Math.min((ts-t0)/dur,1);
    rot=start+delta*ease(p); drawWheel();
    if(Math.abs(rot-lastTick)>=sa*0.8){
      gsTick(); lastTick=rot;
      if(ptr){ ptr.style.transform='translateX(-50%) rotate(11deg)';
        setTimeout(()=>{ if(ptr) ptr.style.transform='translateX(-50%)'; },55); }
    }
    if(p<1) requestAnimationFrame(step);
    else{
      rot=start+delta; drawWheel(); spinning=false;
      picked=nameAtPointer();
      history.push(picked); counts[picked]=(counts[picked]||0)+1;
      if(out) out.textContent=picked+" — you're up!";
      gsDing();
      if(btn){btn.disabled=false;}
    }
  }
  requestAnimationFrame(step);
}

/* ---- curtains ---- */
function curtainReveal(msg,cb){
  let ov=document.getElementById('gs-curtain');
  if(!ov){
    ov=document.createElement('div'); ov.id='gs-curtain';
    ov.innerHTML='<div class="gs-c gs-l"></div><div class="gs-c gs-r"></div><div class="gs-cmsg"></div>';
    document.body.appendChild(ov);
  }
  ov.querySelector('.gs-cmsg').textContent=msg||'';
  ov.classList.remove('open'); ov.style.display='block';
  gsFan();
  setTimeout(()=>ov.classList.add('open'),420);
  setTimeout(()=>{ ov.style.display='none'; if(cb)cb(); },2600);
}

/* ---- styles ---- */
const CSS=`
#gs-host{font-family:'Outfit',system-ui,sans-serif;}
.gs-marquee{display:flex;justify-content:space-around;align-items:center;height:16px;
  background:linear-gradient(180deg,#1a1a1a,#000);border-radius:999px;margin-bottom:10px;
  box-shadow:0 2px 12px rgba(255,215,0,.22);overflow:hidden;}
.gs-bulb{width:7px;height:7px;border-radius:50%;background:#fff;
  box-shadow:0 0 5px 2px rgba(255,215,0,.75);animation:gsGlow 1.2s infinite alternate;}
.gs-bulb:nth-child(3n){animation-delay:.4s}.gs-bulb:nth-child(3n+1){animation-delay:.8s}
@keyframes gsGlow{0%{opacity:.25;filter:brightness(.5)}100%{opacity:1;filter:brightness(1.5)}}
.gs-stage{background:linear-gradient(180deg,#2a0a18,#12040c);border-radius:16px;padding:16px 14px;
  box-shadow:inset 0 0 40px rgba(0,0,0,.65),0 6px 22px rgba(0,0,0,.28);text-align:center;}
.gs-wheelwrap{position:relative;display:inline-block;padding:12px;border-radius:50%;
  background:conic-gradient(from 0deg,#1a1a1a,#2f2f2f,#1a1a1a,#2f2f2f);
  box-shadow:0 0 0 4px #ffd700,0 0 0 8px #1a1a1a,0 0 28px rgba(255,215,0,.28);}
#gs-wheel{display:block;border-radius:50%;}
#gs-ptr{position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:5;
  width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;
  border-top:30px solid #ffd700;filter:drop-shadow(0 3px 5px rgba(0,0,0,.7));transition:transform .06s;}
.gs-hub{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:26px;height:26px;
  border-radius:50%;background:radial-gradient(circle,#fff,#999);border:3px solid #ffd700;z-index:4;}
#gs-picked{font-family:'Fredoka',sans-serif;font-size:19px;color:#ffd700;margin-top:10px;min-height:26px;
  text-shadow:0 2px 0 rgba(0,0,0,.5);}
.gs-btn{display:block;width:100%;margin-top:10px;padding:14px;border:none;border-radius:999px;
  background:linear-gradient(135deg,#ffd700,#c9a100);color:#2a1a00;font-family:'Fredoka',sans-serif;
  font-size:16px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);}
.gs-btn:disabled{opacity:.5;cursor:not-allowed;}
.gs-btn.alt{background:#f3e8ff;color:#7B2D8E;font-size:14px;padding:11px;}
.gs-names{width:100%;padding:11px;border-radius:12px;border:2px solid rgba(255,255,255,.16);
  background:rgba(0,0,0,.35);color:#fff;font-family:'Outfit';font-size:13px;resize:vertical;}
.gs-names:focus{outline:none;border-color:#ffd700;}
/* curtain overlay */
#gs-curtain{position:fixed;inset:0;z-index:3000;display:none;pointer-events:none;}
#gs-curtain .gs-c{position:absolute;top:0;height:100%;width:52%;
  background:repeating-linear-gradient(92deg,#3a0018 0,#5c0028 15px,#48001f 30px,#380016 45px);
  box-shadow:inset 0 0 90px rgba(0,0,0,.75);transition:transform 1.7s cubic-bezier(.22,.61,.36,1);}
#gs-curtain .gs-l{left:0;border-right:5px solid #ffd700;}
#gs-curtain .gs-r{right:0;border-left:5px solid #ffd700;}
#gs-curtain.open .gs-l{transform:translateX(-102%);}
#gs-curtain.open .gs-r{transform:translateX(102%);}
#gs-curtain .gs-cmsg{position:absolute;top:44%;left:0;width:100%;text-align:center;
  font-family:'Fredoka',sans-serif;font-size:clamp(1.5rem,6vw,2.8rem);color:#ffd700;
  text-shadow:0 3px 0 rgba(0,0,0,.6),0 0 30px rgba(255,215,0,.6);transition:opacity .5s;}
#gs-curtain.open .gs-cmsg{opacity:0;}
@media(min-width:820px){ #gs-wheel{width:300px;height:300px;} }
@media(max-width:480px){ #gs-picked{font-size:16px;} }
`;
function injectCSS(){
  if(document.getElementById('gs-style')) return;
  const s=document.createElement('style'); s.id='gs-style'; s.textContent=CSS;
  document.head.appendChild(s);
}

/* ---- markup ---- */
function html(){
  let bulbs=''; for(let i=0;i<26;i++) bulbs+='<div class="gs-bulb"></div>';
  return `
  <div class="gs-marquee">${bulbs}</div>
  <div class="gs-stage">
    <div id="gs-setup" style="display:none">
      <div style="color:#ffd700;font-family:'Fredoka',sans-serif;font-size:16px;margin-bottom:8px">Who's playing tonight?</div>
      <textarea id="gs-input" class="gs-names" rows="3" placeholder="Aunt Jean, Uncle James, Mildred, Skeeter…"></textarea>
      <button class="gs-btn" id="gs-save">Load the wheel</button>
    </div>
    <div id="gs-wheelui" style="display:none">
      <div class="gs-wheelwrap">
        <div id="gs-ptr"></div>
        <canvas id="gs-wheel" width="230" height="230"></canvas>
        <div class="gs-hub"></div>
      </div>
      <div id="gs-picked"></div>
      <button class="gs-btn" id="gs-spin">SPIN THE WHEEL</button>
      <button class="gs-btn alt" id="gs-edit">Edit players</button>
    </div>
  </div>`;
}

function wire(){
  const setup=document.getElementById('gs-setup');
  const wheel=document.getElementById('gs-wheelui');
  const show=which=>{ setup.style.display=which==='setup'?'block':'none';
                      wheel.style.display=which==='wheel'?'block':'none';
                      if(which==='wheel') drawWheel(); };
  loadNames();
  const ta=document.getElementById('gs-input');
  if(ta) ta.value=names.join(', ');
  show(names.length?'wheel':'setup');

  const save=document.getElementById('gs-save');
  if(save) save.onclick=()=>{
    const v=(document.getElementById('gs-input').value||'')
      .split(',').map(s=>s.trim()).filter(Boolean);
    if(!v.length){ alert('Add at least one name.'); return; }
    names=v; saveNames(); counts={}; history=[];
    show('wheel'); gsDing();
    curtainReveal('GAME NIGHT!');
  };
  const sp=document.getElementById('gs-spin'); if(sp) sp.onclick=spin;
  const ed=document.getElementById('gs-edit'); if(ed) ed.onclick=()=>{
    document.getElementById('gs-input').value=names.join(', '); show('setup');
  };
}

function mount(host){ injectCSS(); host.innerHTML=html(); wire(); host.dataset.gsMounted='1'; }

/* watcher — survives framework re-renders */
setInterval(()=>{
  const host=document.getElementById('gs-host');
  if(host && !host.dataset.gsMounted) mount(host);
}, 200);

window.PorchShow = { spin, curtainReveal, picked:()=>picked, names:()=>names };
})();
