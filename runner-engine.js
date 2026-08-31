/* ============================================================
   RACE TO THE REUNION — self-mounting engine
   Watches for #rg-host to appear in the DOM, injects its own UI,
   and tears the loop down when the host leaves. Framework-agnostic
   so it survives the React runtime re-rendering around it.
   ============================================================ */
(function(){
if (window.__RG_LOADED__) return; window.__RG_LOADED__ = true;
let aC=null;function initA(){if(!aC)aC=new(window.AudioContext||window.webkitAudioContext)();if(aC.state==='suspended')aC.resume();}
function tone(f,t,d,v=0.3){try{initA();const o=aC.createOscillator(),g=aC.createGain();o.type=t;o.frequency.setValueAtTime(f,aC.currentTime);g.gain.setValueAtTime(v,aC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,aC.currentTime+d);o.connect(g);g.connect(aC.destination);o.start();o.stop(aC.currentTime+d);}catch(e){}}
function sfxDing(){tone(880,'sine',0.5);setTimeout(()=>tone(1100,'sine',0.35,0.2),60);}
function sfxBuzz(){tone(150,'sawtooth',0.7,0.4);}
function sfxTick(){tone(1800,'triangle',0.04,0.06);}
function sfxThud(){tone(80,'square',0.1,0.3);}
function sfxCount(){tone(600,'sine',0.15,0.2);}
function sfxDrum(){for(let i=0;i<16;i++)setTimeout(()=>tone(180+Math.random()*100,'triangle',0.06,0.1),i*75);}
function sfxFanfare(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,'square',i===3?0.7:0.18,0.25),i*160));}
function sfxSad(){[300,280,260,240].forEach((f,i)=>setTimeout(()=>tone(f,'sawtooth',i===3?1:0.3,0.25),i*300));}

/* ============ NAV ============ */
function toggleNav(){document.getElementById('nav-links').classList.toggle('open');}
function goTo(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('pg-'+page).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l=>{if(l.textContent.toLowerCase().includes(page==='home'?'home':page))l.classList.add('active');});
  document.getElementById('nav-links').classList.remove('open');
  window.scrollTo(0,0);
}

/* ============ PASSWORD ============ */
let gameUnlocked=false;
function checkPw(){
  const v=document.getElementById('pw-input').value.trim().toLowerCase();
  if(v==='porchgamenight'){gameUnlocked=true;document.getElementById('game-gate').style.display='none';document.getElementById('game-content').style.display='block';initA();}
  else{document.getElementById('pw-error').style.display='block';}
}

/* ============ GAME NAV ============ */
const BPM = 120, BEAT_FRAMES = 30;      // 0.5s @60fps

/* h = hazard {b:beat, t:type}   k = token {b:beat, y:height, tier}
   tiers: 'path' breadcrumb on the safe line | 'risk' beside a hazard | 'combo' streak
   diff 1..5 gates which chunks unlock as the run heats up            */
const CHUNKS = [
  // ---- diff 1 : teach ----
  { id:'breather', beats:8, diff:1, h:[], k:[{b:2,y:0,tier:'path'},{b:3,y:0,tier:'path'},{b:4,y:0,tier:'path'}] },
  { id:'first-hop', beats:8, diff:1, h:[{b:4,t:'pothole'}],
    k:[{b:3,y:40,tier:'path'},{b:4,y:95,tier:'path'},{b:5,y:40,tier:'path'}] },
  { id:'first-duck', beats:8, diff:1, h:[{b:4,t:'pigeons'}],
    k:[{b:3,y:0,tier:'path'},{b:4,y:0,tier:'path'},{b:5,y:0,tier:'path'}] },

  // ---- diff 2 : establish cadence ----
  { id:'two-step', beats:10, diff:2, h:[{b:2,t:'pothole'},{b:6,t:'cart'}],
    k:[{b:2,y:95,tier:'path'},{b:4,y:0,tier:'combo'},{b:6,y:95,tier:'path'}] },
  { id:'hay-run', beats:10, diff:2, h:[{b:4,t:'hay'},{b:8,t:'hay'}],
    k:[{b:4,y:95,tier:'path'},{b:6,y:30,tier:'combo'},{b:8,y:95,tier:'path'}] },
  { id:'low-sweep', beats:10, diff:2, h:[{b:4,t:'pigeons'},{b:8,t:'pothole'}],
    k:[{b:5,y:0,tier:'path'},{b:6,y:0,tier:'path'},{b:8,y:95,tier:'path'}] },

  // ---- diff 3 : mix verbs ----
  { id:'jump-duck-jump', beats:12, diff:3, h:[{b:2,t:'cart'},{b:6,t:'pigeons'},{b:10,t:'pothole'}],
    k:[{b:2,y:95,tier:'path'},{b:6,y:0,tier:'path'},{b:10,y:95,tier:'path'},{b:8,y:55,tier:'risk'}] },
  { id:'stutter', beats:12, diff:3, h:[{b:4,t:'pothole'},{b:6,t:'pothole'},{b:10,t:'hay'}],
    k:[{b:5,y:110,tier:'risk'},{b:8,y:0,tier:'combo'},{b:10,y:95,tier:'path'}] },
  { id:'leaf-trap', beats:12, diff:3, h:[{b:4,t:'leaves'},{b:8,t:'cart'}],
    k:[{b:4,y:80,tier:'risk'},{b:6,y:40,tier:'combo'},{b:8,y:95,tier:'path'}] },

  // ---- diff 4 : pressure ----
  { id:'triple-hop', beats:14, diff:4, h:[{b:2,t:'hay'},{b:6,t:'hay'},{b:10,t:'hay'}],
    k:[{b:2,y:95,tier:'path'},{b:6,y:95,tier:'path'},{b:10,y:95,tier:'path'},{b:12,y:30,tier:'combo'}] },
  { id:'high-low', beats:14, diff:4, h:[{b:2,t:'pigeons'},{b:4,t:'pothole'},{b:8,t:'pigeons'},{b:12,t:'cart'}],
    k:[{b:4,y:100,tier:'risk'},{b:6,y:0,tier:'combo'},{b:12,y:95,tier:'path'}] },
  { id:'gauntlet', beats:14, diff:4, h:[{b:2,t:'cart'},{b:6,t:'leaves'},{b:8,t:'pothole'},{b:12,t:'hay'}],
    k:[{b:2,y:95,tier:'path'},{b:8,y:105,tier:'risk'},{b:12,y:95,tier:'path'}] },

  // ---- diff 5 : payoff ----
  { id:'finale-rush', beats:16, diff:5, h:[{b:2,t:'hay'},{b:4,t:'pigeons'},{b:8,t:'cart'},{b:10,t:'pothole'},{b:14,t:'hay'}],
    k:[{b:2,y:95,tier:'path'},{b:6,y:45,tier:'combo'},{b:10,y:100,tier:'risk'},{b:14,y:95,tier:'path'}] },
  { id:'reward-lane', beats:12, diff:5, h:[{b:4,t:'pothole'},{b:12,t:'cart'}],
    k:[{b:5,y:60,tier:'combo'},{b:6,y:95,tier:'combo'},{b:7,y:110,tier:'combo'},{b:8,y:95,tier:'combo'},{b:9,y:60,tier:'combo'}] },
];

/* ============================================================
   RACE TO THE REUNION — v3
   Chunk-stitched · beat-grid · pooled · coyote-time
   ============================================================ */
const RG = {
  W:900, H:460, GROUND_OFF:78,
  GRAV:0.446, JUMP_V:-9.91,        // derived: 0.74s airtime, 110px apex
  VMIN:4.2, VMAX:11.0, RAMP_M:42, RAMP_K:2,
  T_READ:24, D_CLEAR:90,           // MinGap(v) = v*T_READ + D_CLEAR
  BEAT:30,                         // 120 BPM @60fps
  COYOTE:6, BUFFER:7,              // 0.10s / 0.12s
  RUN_SECONDS:90, GOAL:4000,
  DUCK_H:38
};

const CHARS = [
  {key:'freddie', name:"Aunt Freddie",  role:"Balanced Tea Tray Runner",    perk:'steady',  blurb:"Starts with an extra heart.",              frames:2},
  {key:'norah',   name:"Uncle Norah",   role:"Precision Gadget Navigator",  perk:'magnet',  blurb:"Pulls nearby tokens toward you.",          frames:2},
  {key:'james',   name:"Uncle James",   role:"Dapper Keepsake Collector",   perk:'keepsake',blurb:"Risk tokens pay double.",                  frames:2},
  {key:'jean',    name:"Aunt Jean",     role:"Radiant Memory Trail Runner", perk:'swift',   blurb:"Higher jump, longer coyote time.",         frames:2},
  {key:'mildred', name:"Aunt Mildred",  role:"Efficient Cook-off Contender",perk:'combo',   blurb:"Combo climbs twice as fast.",              frames:2},
  {key:'alberta', name:"Aunt Alberta",  role:"The Peaceful Pacifier",       perk:'aura',    blurb:"Soothing Aura clears hazards nearby.",     frames:6},
];

const STAGES = [
  {name:"The Neighborhood", at:0,    sky:['#7EC0EE','#BFE3F5'], gnd:'#5D8A3C', road:'#6b6b6b', accent:'#4A7A2E', prop:'house'},
  {name:"Country Road",     at:1100, sky:['#F6B65C','#FCE0A8'], gnd:'#7A8B3C', road:'#7a6a55', accent:'#5E6E2A', prop:'tree'},
  {name:"Into Chattanooga", at:2300, sky:['#4E5A96','#B58BA6'], gnd:'#3F4A5A', road:'#555',    accent:'#2E3742', prop:'city'},
  {name:"Reunion Grounds",  at:3400, sky:['#2B2350','#6A4B8A'], gnd:'#3B5030', road:'#4a4a4a', accent:'#2A3A22', prop:'tent'},
];

const HAZ = {
  pothole:{w:46,h:14, ground:true,  verb:'jump'},
  cart   :{w:40,h:44, ground:false, verb:'jump'},
  hay    :{w:46,h:40, ground:false, verb:'jump'},
  leaves :{w:56,h:12, ground:true,  verb:'slow'},
  pigeons:{w:44,h:26, ground:false, verb:'duck', air:96},
};
const TIER = { path:{pts:50,r:11,col:'#FFD34D'}, risk:{pts:200,r:12,col:'#FF7BD5'}, combo:{pts:100,r:11,col:'#6EE7F9'} };

/* ---------- asset load ---------- */
const IMG={}; 
function loadArt(){ CHARS.forEach(c=>{ for(let i=0;i<c.frames;i++) px(`${c.key}_run${i}`,`sprites/${c.key}_run${i}.png`); px(`${c.key}_face`,`sprites/${c.key}_face.png`); }); }
function px(k,src){ const im=new Image(); im.onload=()=>{IMG[k]=im; if(typeof rgRefresh==='function') rgRefresh();}; im.onerror=()=>{}; im.src=src; }
loadArt();

/* ---------- object pools (zero alloc in loop) ---------- */
const POOL_H=40, POOL_K=48;
const hz = Array.from({length:POOL_H},()=>({on:false,x:0,y:0,w:0,h:0,type:'',verb:''}));
const tk = Array.from({length:POOL_K},()=>({on:false,x:0,y:0,tier:'path',got:false,t:0}));
function takeH(){ for(let i=0;i<POOL_H;i++) if(!hz[i].on) return hz[i]; return null; }
function takeK(){ for(let i=0;i<POOL_K;i++) if(!tk[i].on) return tk[i]; return null; }
function clearPools(){ for(let i=0;i<POOL_H;i++) hz[i].on=false; for(let i=0;i<POOL_K;i++) tk[i].on=false; }

/* ---------- state ---------- */
let rgSel=0,rgCv,rgX,rgOn=false,rgRaf=null,rgLast=0;
let P,eli,deco,stageIdx,dist,score,hp,combo,comboT,runT;
let tShield,tSpeed,tSlow,tAura,cdAura,iFr,puppy,trail;
let cursorPx,lastChunk,bestScore=0,peakCombo=0,tokensGot=0;

/* ---------- formulas ---------- */
const velAt = t => RG.VMIN + (RG.VMAX-RG.VMIN)*Math.pow(t,RG.RAMP_K)/(Math.pow(t,RG.RAMP_K)+Math.pow(RG.RAMP_M,RG.RAMP_K));
const minGap = v => v*RG.T_READ + RG.D_CLEAR;
const diffAt = t => Math.min(5, 1 + Math.floor(t/18));      // 1→5 across 90s

/* ---------- chunk stitching ---------- */
function pickChunk(t){
  const d = diffAt(t);
  // weight toward current tier, allow one below for breathing room
  let pool = CHUNKS.filter(c=>c.diff<=d && c.diff>=Math.max(1,d-1));
  if(!pool.length) pool = CHUNKS.filter(c=>c.diff<=d);
  if(lastChunk && pool.length>1) pool = pool.filter(c=>c.id!==lastChunk);
  return pool[(Math.random()*pool.length)|0];
}
function stitch(v,t){
  const c = pickChunk(t); lastChunk = c.id;
  const g = RG.H-RG.GROUND_OFF;
  const beatPx = v*RG.BEAT;                 // rhythm constant in time, scales in space
  const gapOK = Math.max(beatPx*2, minGap(v));   // never violate MinGap
  const unit  = gapOK/2;                    // one beat of horizontal room
  c.h.forEach(h=>{
    const s=takeH(); if(!s) return; const d=HAZ[h.t];
    s.on=true; s.type=h.t; s.verb=d.verb; s.w=d.w; s.h=d.h;
    s.x = cursorPx + h.b*unit;
    s.y = d.ground ? g-d.h+6 : (d.air ? g-d.air : g-d.h);
  });
  c.k.forEach(k=>{
    const s=takeK(); if(!s) return;
    s.on=true; s.tier=k.tier; s.got=false; s.t=0;
    s.x = cursorPx + k.b*unit;
    s.y = g - 26 - k.y;
  });
  cursorPx += c.beats*unit;
}

/* ---------- lifecycle ---------- */
function rgRefresh(){ if(document.getElementById('rg-roster')) buildRoster(); if(typeof drawHomeSprites==='function') drawHomeSprites(); }
function buildRoster(){
  const host=document.getElementById('rg-roster'); if(!host) return; host.innerHTML='';
  CHARS.forEach((c,i)=>{
    const card=document.createElement('div'); card.className='rg-card'+(i===rgSel?' sel':'');
    const art=IMG[`${c.key}_face`]||IMG[`${c.key}_run0`];
    card.innerHTML=`<div class="rg-portrait">${art?`<img src="${art.src}" alt="${c.name}">`:''}</div>
      <div class="rg-name">${c.name}</div><div class="rg-role">${c.role}</div><div class="rg-perk">${c.blurb}</div>`;
    card.onclick=()=>{rgSel=i;buildRoster();document.getElementById('rg-go').disabled=false;};
    host.appendChild(card);
  });
}
function rgShowSelect(){
  document.getElementById('rg-select').style.display='block';
  document.getElementById('rg-play').style.display='none';
  document.getElementById('rg-over').style.display='none';
  if(rgRaf){cancelAnimationFrame(rgRaf);rgRaf=null;} rgOn=false;
}
function rgStart(){
  initA();
  rgCv=document.getElementById('rg-canvas'); rgX=rgCv.getContext('2d'); rgX.imageSmoothingEnabled=false;
  const g=RG.H-RG.GROUND_OFF;
  P={x:130,y:g,vy:0,onGround:true,duck:false,anim:0,coyote:0,buffer:0};
  clearPools(); deco=[]; trail=[];
  eli={on:false,x:0,y:0,variant:0,life:0,shot:null,cool:480};
  stageIdx=0;dist=0;score=0;hp=3;combo=1;comboT=0;runT=0;
  tShield=0;tSpeed=0;tSlow=0;tAura=0;cdAura=0;iFr=0;puppy=null;
  peakCombo=1;tokensGot=0;
  cursorPx=RG.W+120; lastChunk=null;
  if(CHARS[rgSel].perk==='steady') hp=4;
  for(let i=0;i<10;i++) deco.push({x:i*180+Math.random()*120,layer:Math.random()<.5?0:1,t:Math.random()});
  document.getElementById('rg-select').style.display='none';
  document.getElementById('rg-play').style.display='block';
  document.getElementById('rg-over').style.display='none';
  document.getElementById('rg-aura').style.display=CHARS[rgSel].perk==='aura'?'inline-block':'none';
  rgOn=true; rgLast=performance.now(); rgRaf=requestAnimationFrame(rgLoop);
}

/* ---------- input: buffer + coyote ---------- */
function rgJump(){ if(rgOn) P.buffer=RG.BUFFER; }        // remember the press
function rgDuck(on){ if(rgOn) P.duck=on; }
function rgAura(){
  if(!rgOn||CHARS[rgSel].perk!=='aura'||cdAura>0||tAura>0) return;
  tAura=170; cdAura=560; sfxDing(); puppy={x:P.x-52,y:RG.H-RG.GROUND_OFF,b:0}; flash('✨ SOOTHING AURA');
}
function flash(m){ const e=document.getElementById('rg-flash'); if(!e)return; e.textContent=m; e.style.opacity='1'; clearTimeout(e._t); e._t=setTimeout(()=>e.style.opacity='0',1400); }

/* ---------- loop ---------- */
function rgLoop(now){
  if(!rgOn) return;
  const dt=Math.min(2.2,(now-rgLast)/16.67); rgLast=now;
  runT += dt/60;
  const g=RG.H-RG.GROUND_OFF;
  const base=velAt(runT);
  const v=base*(tSpeed>0?1.4:1)*(tSlow>0?0.62:1);

  /* --- jump with coyote time + buffered input --- */
  if(P.onGround) P.coyote = CHARS[rgSel].perk==='swift'?RG.COYOTE+3:RG.COYOTE;
  else if(P.coyote>0) P.coyote-=dt;
  if(P.buffer>0){
    P.buffer-=dt;
    if(P.coyote>0){                       // forgiving: fires even just after leaving ground
      P.vy=RG.JUMP_V*(CHARS[rgSel].perk==='swift'?1.06:1);
      P.onGround=false; P.coyote=0; P.buffer=0;
      tone(560,'square',0.09,0.15);
    }
  }
  P.vy+=RG.GRAV*dt; P.y+=P.vy*dt;
  if(P.y>=g){P.y=g;P.vy=0;P.onGround=true;}
  P.anim+=dt*(P.onGround?0.28:0);

  /* --- stitch next chunk when the cursor nears the edge --- */
  cursorPx -= v*dt;
  if(cursorPx < RG.W+200) stitch(v,runT);

  /* --- move pooled objects --- */
  for(let i=0;i<POOL_H;i++){ const o=hz[i]; if(!o.on) continue; o.x-=v*dt; if(o.x<-90) o.on=false; }
  for(let i=0;i<POOL_K;i++){ const k=tk[i]; if(!k.on) continue; k.x-=v*dt; k.t+=dt;
    if(CHARS[rgSel].perk==='magnet'&&!k.got){
      const dx=(P.x+22)-k.x, dy=(P.y-34)-k.y, d=Math.hypot(dx,dy);
      if(d<150){ k.x+=dx/d*3.4*dt; k.y+=dy/d*3.4*dt; }
    }
    if(k.x<-40) k.on=false;
  }
  deco.forEach(d=>{ d.x-=v*(d.layer?.55:.22)*dt; if(d.x<-220){d.x=RG.W+Math.random()*260;d.t=Math.random();} });
  if(puppy){ puppy.b+=.18*dt; puppy.x+=((P.x-54)-puppy.x)*.09*dt; }
  if(CHARS[rgSel].perk==='swift') trail.push({x:P.x+20,y:P.y-30,a:1});
  trail.forEach(t=>t.a-=.045*dt); trail=trail.filter(t=>t.a>0);

  /* --- Eli --- */
  eli.cool-=dt;
  if(eli.cool<=0&&!eli.on){ eli.on=true;eli.x=RG.W+50;eli.y=g-70;eli.variant=(Math.random()*3)|0;eli.life=260;eli.shot=null;eli.cool=560+Math.random()*260; }
  if(eli.on){ eli.x-=v*.62*dt; eli.life-=dt;
    if(eli.life<=0||eli.x<-90) eli.on=false;
    if(!eli.shot&&eli.x<RG.W-120&&Math.random()<.02*dt){ eli.shot={x:eli.x-6,y:eli.y+16,w:18,h:14}; tone(240,'sawtooth',.16,.18); }
  }
  if(eli.shot){ eli.shot.x-=(v+4.2)*dt; if(eli.shot.x<-30) eli.shot=null; }

  /* --- timers --- */
  if(tShield>0)tShield-=dt; if(tSpeed>0)tSpeed-=dt; if(tSlow>0)tSlow-=dt;
  if(cdAura>0)cdAura-=dt; if(iFr>0)iFr-=dt;
  if(tAura>0){ tAura-=dt;
    for(let i=0;i<POOL_H;i++){ const o=hz[i]; if(o.on&&Math.abs((o.x+o.w/2)-(P.x+22))<120){o.on=false;score+=30*combo;} }
    if(eli.shot) eli.shot=null;
  }
  if(comboT>0){ comboT-=dt; if(comboT<=0) combo=1; }

  /* --- collisions --- */
  const ph=P.duck?RG.DUCK_H:62;
  const bx=P.x+8, by=P.y-ph, bw=28, bh=ph;
  const safe = tShield>0||tAura>0||iFr>0;
  for(let i=0;i<POOL_H;i++){
    const o=hz[i]; if(!o.on||safe) continue;
    if(bx+bw>o.x&&bx<o.x+o.w&&by+bh>o.y&&by<o.y+o.h){
      if(o.verb==='slow'){ tSlow=90; flash('🍂 Slowed!'); tone(200,'triangle',.2,.18); }
      else hurt();
      o.on=false;
    }
  }
  if(eli.shot&&!safe){ const s=eli.shot;
    if(bx+bw>s.x&&bx<s.x+s.w&&by+bh>s.y&&by<s.y+s.h){ hurt(); eli.shot=null; } }
  for(let i=0;i<POOL_K;i++){
    const k=tk[i]; if(!k.on||k.got) continue;
    if(bx+bw>k.x-14&&bx<k.x+14&&by+bh>k.y-14&&by<k.y+14){ k.got=true; k.on=false; grabToken(k.tier); }
  }

  /* --- progression --- */
  dist += v*dt*0.34;
  score += Math.round(v*dt*0.6*combo);
  const ns=STAGES.reduce((a,s,i)=>dist>=s.at?i:a,0);
  if(ns!==stageIdx){ stageIdx=ns; flash('📍 '+STAGES[ns].name); sfxDing(); }
  if(dist>=RG.GOAL || runT>=RG.RUN_SECONDS+8) return finish(dist>=RG.GOAL);

  hud();
  try { draw(v); } catch(err){ console.error('draw() failed:',err); }
  rgRaf=requestAnimationFrame(rgLoop);
}

function hurt(){ hp--; combo=1; comboT=0; iFr=70; sfxBuzz(); shake(); if(hp<=0) finish(false); }
function grabToken(tier){
  sfxDing(); tokensGot++;
  const step = CHARS[rgSel].perk==='combo'?2:1;
  combo=Math.min(8,combo+(tier==='combo'?step:step)); comboT=260;
  if(combo>peakCombo) peakCombo=combo;
  let pts=TIER[tier].pts;
  if(tier==='risk'&&CHARS[rgSel].perk==='keepsake') pts*=2;
  score+=pts*combo;
}
function shake(){ const c=document.getElementById('rg-canvas'); if(!c)return;
  c.style.transform='translateX(-6px)'; setTimeout(()=>c.style.transform='translateX(6px)',60); setTimeout(()=>c.style.transform='',120); }
function hud(){
  document.getElementById('rg-hp').textContent='❤️'.repeat(Math.max(0,hp));
  document.getElementById('rg-dist').textContent=Math.floor(dist)+'m';
  document.getElementById('rg-score').textContent=score.toLocaleString();
  document.getElementById('rg-combo').textContent='x'+combo;
  document.getElementById('rg-stage').textContent=STAGES[stageIdx].name;
  document.getElementById('rg-bar').style.width=Math.min(100,dist/RG.GOAL*100)+'%';
  const a=document.getElementById('rg-aura');
  if(a&&CHARS[rgSel].perk==='aura'){
    if(tAura>0){a.textContent='✨ ACTIVE';a.disabled=true;}
    else if(cdAura>0){a.textContent='✨ '+Math.ceil(cdAura/60)+'s';a.disabled=true;}
    else{a.textContent='✨ AURA';a.disabled=false;}
  }
}
function finish(won){
  rgOn=false; if(rgRaf)cancelAnimationFrame(rgRaf);
  if(score>bestScore) bestScore=score;
  document.getElementById('rg-over').style.display='block';
  document.getElementById('rg-over-title').textContent = won?'🎉 YOU MADE IT!':'RACE OVER';
  document.getElementById('rg-over-title').style.color = won?'var(--green)':'var(--gold)';
  document.getElementById('rg-over-msg').innerHTML = (won
    ? `<strong>${CHARS[rgSel].name}</strong> made it to the reunion!`
    : `<strong>${CHARS[rgSel].name}</strong> got ${Math.floor(dist)}m of ${RG.GOAL}m.`)
    + `<br>Score <strong>${score.toLocaleString()}</strong> · Best ${bestScore.toLocaleString()}`
    + `<br><span style="font-size:.85em;color:#8b93a3">${tokensGot} tokens · peak combo x${peakCombo}</span>`;
  if(won&&typeof fireConfetti==='function') fireConfetti();
  won?sfxFanfare():sfxSad();
}

/* ---------- render ---------- */
function draw(v){
  const X=rgX,g=RG.H-RG.GROUND_OFF,st=STAGES[stageIdx];
  X.clearRect(0,0,RG.W,RG.H);
  const sky=X.createLinearGradient(0,0,0,RG.H); sky.addColorStop(0,st.sky[0]); sky.addColorStop(1,st.sky[1]);
  X.fillStyle=sky; X.fillRect(0,0,RG.W,RG.H);
  X.fillStyle= stageIdx>=3?'rgba(255,250,220,.9)':'rgba(255,245,200,.75)';
  X.beginPath(); X.arc(RG.W-130,82,stageIdx>=3?26:34,0,7); X.fill();
  deco.filter(d=>!d.layer).forEach(d=>farProp(X,d,st,g));
  deco.filter(d=>d.layer).forEach(d=>nearProp(X,d,st,g));
  X.fillStyle=st.gnd; X.fillRect(0,g,RG.W,RG.H-g);
  X.fillStyle=st.accent; X.fillRect(0,g,RG.W,5);
  X.fillStyle=st.road; X.fillRect(0,g+5,RG.W,42);
  X.fillStyle='rgba(255,215,0,.85)';
  const off=(dist*3)%70; for(let i=-1;i<RG.W/70+1;i++) X.fillRect(i*70-off,g+24,34,4);
  if(dist>RG.GOAL-380){
    const fx=RG.W-(RG.GOAL-dist)*2.2;
    for(let r=0;r<9;r++) for(let c=0;c<2;c++){ X.fillStyle=((r+c)%2)?'#fff':'#111'; X.fillRect(fx+c*16,g-120+r*14,16,14); }
    X.fillStyle='#FFD700'; X.font='bold 16px Outfit'; X.fillText('REUNION!',fx-14,g-132);
  }
  for(let i=0;i<POOL_H;i++) if(hz[i].on) drawHaz(X,hz[i]);
  for(let i=0;i<POOL_K;i++) if(tk[i].on) drawTok(X,tk[i]);
  trail.forEach(t=>{X.fillStyle=`rgba(230,200,255,${t.a*.5})`;X.fillRect(t.x,t.y,5,5);});
  if(eli.on) drawEli(X,eli);
  if(puppy){ const b=Math.abs(Math.sin(puppy.b))*5;
    X.fillStyle='#D2A679';X.fillRect(puppy.x,g-16-b,22,11);X.fillRect(puppy.x+18,g-22-b,10,9);
    X.fillStyle='#8B6544';X.fillRect(puppy.x+17,g-25-b,4,5);X.fillRect(puppy.x+24,g-25-b,4,5);X.fillRect(puppy.x-4,g-19-b,5,4);
    X.fillStyle='#000';X.fillRect(puppy.x+23,g-19-b,2,2); }
  drawHero(X,g);
  if(stageIdx>=2){ const vg=X.createRadialGradient(RG.W/2,RG.H/2,RG.H*.4,RG.W/2,RG.H/2,RG.H*.95);
    vg.addColorStop(0,'transparent'); vg.addColorStop(1,'rgba(0,0,10,.45)'); X.fillStyle=vg; X.fillRect(0,0,RG.W,RG.H); }
}
function farProp(X,d,st,g){
  if(st.prop==='city'){
    X.fillStyle='rgba(20,25,45,0.55)';
    const h=70+((d.t*100)%90); X.fillRect(d.x,g-h,54,h);
    X.fillStyle='rgba(255,220,120,0.25)';
    for(let r=0;r<h/18;r++) X.fillRect(d.x+8,g-h+8+r*18,10,8);
  } else {
    X.fillStyle='rgba(255,255,255,0.55)';
    X.beginPath(); X.ellipse(d.x,70+d.t*40,52,17,0,0,Math.PI*2); X.fill();
  }
}
function nearProp(X,d,st,g){
  if(st.prop==='tree'){
    X.fillStyle='#3E2A18'; X.fillRect(d.x+16,g-52,10,52);
    X.fillStyle='#2F5C24'; X.beginPath(); X.arc(d.x+21,g-64,26,0,Math.PI*2); X.fill();
  } else if(st.prop==='house'){
    X.fillStyle='#B58A5E'; X.fillRect(d.x,g-58,64,58);
    X.fillStyle='#7C3B2A'; X.beginPath(); X.moveTo(d.x-6,g-58); X.lineTo(d.x+32,g-86); X.lineTo(d.x+70,g-58); X.closePath(); X.fill();
    X.fillStyle='#FFE9A8'; X.fillRect(d.x+12,g-42,16,14); X.fillRect(d.x+38,g-42,16,14);
  } else if(st.prop==='city'){
    X.fillStyle='#2A3550'; X.fillRect(d.x,g-96,58,96);
    X.fillStyle='rgba(255,225,140,0.6)';
    for(let r=0;r<5;r++) for(let c=0;c<2;c++) if((r+c+((d.t*10)|0))%2) X.fillRect(d.x+10+c*24,g-86+r*17,14,10);
  } else {
    X.fillStyle='#C94F5A'; X.beginPath(); X.moveTo(d.x,g); X.lineTo(d.x+34,g-56); X.lineTo(d.x+68,g); X.closePath(); X.fill();
    X.fillStyle='#FFD86B'; X.fillRect(d.x+28,g-22,14,22);
    X.strokeStyle='rgba(255,240,180,0.7)'; X.lineWidth=2;
    X.beginPath(); X.moveTo(d.x-20,g-64); X.quadraticCurveTo(d.x+34,g-80,d.x+88,g-64); X.stroke();
  }
}
function drawTok(X,k){
  const T=TIER[k.tier], bob=Math.sin(k.t*.12)*4;
  X.save(); X.shadowColor=T.col; X.shadowBlur=14;
  X.fillStyle=T.col; X.beginPath(); X.arc(k.x,k.y+bob,T.r,0,7); X.fill();
  X.fillStyle='rgba(255,255,255,.85)'; X.beginPath(); X.arc(k.x-3,k.y+bob-3,T.r*.32,0,7); X.fill();
  X.restore();
  if(k.tier==='risk'){ X.strokeStyle='rgba(255,255,255,.75)'; X.lineWidth=2;
    X.beginPath(); X.arc(k.x,k.y+bob,T.r+5,0,7); X.stroke(); }
}
function drawHaz(X,o){
  if(o.type==='pothole'){ X.fillStyle='#1a1a1a';X.beginPath();X.ellipse(o.x+o.w/2,o.y+8,o.w/2,9,0,0,7);X.fill();
    X.fillStyle='#000';X.beginPath();X.ellipse(o.x+o.w/2,o.y+8,o.w/2-6,5,0,0,7);X.fill(); }
  else if(o.type==='cart'){ X.fillStyle='#9aa4ad';X.fillRect(o.x,o.y+8,o.w,26);
    X.fillStyle='#c0392b';X.fillRect(o.x+5,o.y,12,12);X.fillStyle='#27ae60';X.fillRect(o.x+20,o.y+2,14,10);
    X.fillStyle='#333';X.beginPath();X.arc(o.x+9,o.y+40,6,0,7);X.arc(o.x+32,o.y+40,6,0,7);X.fill(); }
  else if(o.type==='hay'){ X.fillStyle='#C9A227';X.beginPath();X.arc(o.x+o.w/2,o.y+o.h/2,o.h/2,0,7);X.fill();
    X.strokeStyle='#8f7318';X.lineWidth=3;X.beginPath();X.arc(o.x+o.w/2,o.y+o.h/2,o.h/4,0,7);X.stroke(); }
  else if(o.type==='leaves'){ const c=['#B85C2E','#C9873A','#8E6B2F','#A34428'];
    for(let i=0;i<9;i++){X.fillStyle=c[i%4];X.fillRect(o.x+i*6,o.y+((i*3)%9),7,5);} }
  else { X.fillStyle='#8d99a6';
    for(let i=0;i<3;i++){ const bx=o.x+i*15, by=o.y+Math.sin(Date.now()/180+i)*6;
      X.beginPath();X.ellipse(bx,by,8,5,0,0,7);X.fill(); X.fillStyle='#6c7885';X.fillRect(bx-3,by-6,6,4);X.fillStyle='#8d99a6'; } }
}
function drawEli(X,e){
  const b=Math.sin(Date.now()/140)*3;
  const shirt=e.variant===1?'#1F3A93':e.variant===0?'#5A3B1E':'#6E6E6E';
  X.fillStyle=shirt;X.fillRect(e.x-15,e.y+b,30,46);
  X.fillStyle='#6B4423';X.fillRect(e.x-10,e.y-16+b,20,17);
  X.fillStyle='#222';X.fillRect(e.x-11,e.y-20+b,22,5);
  X.fillStyle='#fff';X.fillRect(e.x-6,e.y-11+b,4,4);X.fillRect(e.x+2,e.y-11+b,4,4);
  X.fillStyle='#000';X.fillRect(e.x-5,e.y-10+b,2,2);X.fillRect(e.x+3,e.y-10+b,2,2);
  if(e.variant===1){ X.fillStyle='#E74C3C';X.beginPath();X.arc(e.x+24,e.y+10+b,11,0,7);X.fill();
    X.fillStyle='#fff';X.font='bold 9px Outfit';X.fillText('STOP',e.x+13,e.y+13+b); }
  X.fillStyle='#FF5252';X.font='bold 11px Outfit';X.fillText('COUSIN ELI',e.x-32,e.y-26+b);
  if(e.shot){ X.fillStyle='#FFF3B0';X.fillRect(e.shot.x,e.shot.y,e.shot.w,e.shot.h);
    X.strokeStyle='#c0392b';X.strokeRect(e.shot.x,e.shot.y,e.shot.w,e.shot.h);
    X.fillStyle='#c0392b';X.font='9px Outfit';X.fillText('TKT',e.shot.x+2,e.shot.y+10); }
}
function drawHero(X,g){
  const c=CHARS[rgSel];
  if(tAura>0){ const gr=X.createRadialGradient(P.x+22,P.y-32,0,P.x+22,P.y-32,72);
    gr.addColorStop(0,'rgba(130,255,225,.34)');gr.addColorStop(.6,'rgba(160,205,255,.14)');gr.addColorStop(1,'transparent');
    X.fillStyle=gr;X.beginPath();X.arc(P.x+22,P.y-32,72,0,7);X.fill();
    for(let i=0;i<6;i++){const a=(Date.now()/280+i*1.05)%6.28;
      X.fillStyle='rgba(215,255,245,.9)';X.fillRect(P.x+22+Math.cos(a)*52,P.y-32+Math.sin(a)*46,4,4);} }
  if(tShield>0){ X.strokeStyle=`rgba(255,215,0,${.5+Math.sin(Date.now()/90)*.3})`;X.lineWidth=3;
    X.beginPath();X.arc(P.x+22,P.y-30,42,0,7);X.stroke(); }
  if(iFr>0&&((Date.now()/70)|0)%2) return;
  const fi=c.frames>1?(Math.floor(P.anim)%c.frames):0;
  const im=IMG[`${c.key}_run${fi}`]||IMG[`${c.key}_run0`];
  if(im){ const h=P.duck?46:66, w=im.width*(h/im.height);
    if(tSpeed>0){ X.globalAlpha=.28; for(let i=1;i<4;i++) X.drawImage(im,P.x+22-w/2-i*13,P.y-h,w,h); X.globalAlpha=1; }
    X.drawImage(im,P.x+22-w/2,P.y-h,w,h);
  } else { X.fillStyle='#7B2635'; X.fillRect(P.x,P.y-60,44,60); }
}

/* ---------- bindings ---------- */
document.addEventListener('keydown',e=>{
  const pg=document.getElementById('pg-runner'); if(!pg||!pg.classList.contains('active'))return;
  if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();rgJump();}
  if(e.code==='ArrowDown'){e.preventDefault();rgDuck(true);}
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();rgAura();}
});
document.addEventListener('keyup',e=>{ if(e.code==='ArrowDown') rgDuck(false); });


/* ---------- injected UI + lifecycle ---------- */
const RG_CSS = `
#rg-host{--gold:#ffd700;--cyan:#00f3ff;--pink:#ff2d95;--green:#00ff88;--red:#ff4444;
  font-family:'Outfit',system-ui,sans-serif;color:#fff;}
#rg-host *{box-sizing:border-box;}
.rg-roster{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
@media(max-width:640px){.rg-roster{grid-template-columns:repeat(2,1fr);}}
.rg-card{background:#fff;border:2px solid #eee;border-radius:14px;padding:10px 8px;cursor:pointer;
  transition:all .18s;text-align:center;-webkit-tap-highlight-color:transparent;}
.rg-card:hover{border-color:#d8b4fe;}
.rg-card.sel{border-color:#7B2D8E;background:#faf5ff;box-shadow:0 0 0 3px rgba(123,45,142,.12);}
.rg-portrait{height:74px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;}
.rg-portrait img{max-height:74px;max-width:100%;image-rendering:pixelated;border-radius:8px;}
.rg-name{font-family:'Fredoka',sans-serif;font-size:13px;color:#7B2D8E;line-height:1.2;}
.rg-role{font-size:9.5px;color:#999;line-height:1.25;margin-top:1px;}
.rg-perk{font-size:9.5px;color:#666;line-height:1.3;margin-top:3px;}
.rg-btn{display:block;width:100%;padding:15px;border:none;border-radius:999px;color:#fff;cursor:pointer;
  font-family:'Fredoka',sans-serif;font-size:17px;box-shadow:0 4px 16px rgba(0,0,0,.18);}
.rg-btn:disabled{opacity:.45;cursor:not-allowed;}
.rg-btn.go{background:linear-gradient(135deg,#7B2D8E,#A855F7);}
.rg-btn.amber{background:linear-gradient(135deg,#F59E0B,#F97316);}
.rg-hud{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;
  font-family:'Fredoka',sans-serif;font-size:13px;color:#7B2D8E;padding:6px 2px;}
.rg-journey{height:7px;background:#eee;border-radius:4px;overflow:hidden;margin-bottom:6px;}
.rg-journey i{display:block;height:100%;width:0;border-radius:4px;
  background:linear-gradient(90deg,#00f3ff,#ffd700,#ff2d95);transition:width .2s;}
#rg-canvas{width:100%;display:block;border-radius:14px;background:#7EC0EE;image-rendering:pixelated;
  cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.28);transition:transform .06s;}
.rg-stagebox{position:relative;}
#rg-flash{position:absolute;top:13%;left:0;width:100%;text-align:center;pointer-events:none;
  font-family:'Fredoka',sans-serif;font-size:clamp(1.2rem,5vw,2rem);color:#fff;
  text-shadow:0 3px 0 rgba(0,0,0,.55),0 0 22px rgba(255,215,0,.75);opacity:0;transition:opacity .35s;}
.rg-ctrls{display:flex;gap:8px;margin-top:10px;}
.rg-ctrls .rg-btn{font-size:15px;padding:14px 10px;}
.rg-legend{font-size:12px;color:#777;line-height:1.85;}
.rg-legend b{color:#333;}
.rg-card-panel{background:#fff;border-radius:16px;padding:16px;margin-top:12px;box-shadow:0 2px 10px rgba(0,0,0,.05);}
`;
function injectCSS(){
  if(document.getElementById('rg-style')) return;
  const s=document.createElement('style'); s.id='rg-style'; s.textContent=RG_CSS;
  document.head.appendChild(s);
}
const RG_HTML = `
<div id="rg-select">
  <div class="rg-roster" id="rg-roster"></div>
  <div style="margin-top:12px"><button class="rg-btn go" id="rg-go" disabled>Pick a runner first</button></div>
  <div class="rg-card-panel">
    <div style="font-family:'Fredoka',sans-serif;font-size:15px;color:#7B2D8E;margin-bottom:6px">How to play</div>
    <div class="rg-legend">
      <b>Tap the canvas</b> or press <b>Space</b> to jump<br>
      <b>Hold DUCK</b> (or ↓) to slide under pigeons<br>
      Grab tokens to build your <b>combo</b> — a hit resets it<br>
      Reach <b>4,000m</b> to make it to the reunion
    </div>
  </div>
</div>
<div id="rg-play" style="display:none">
  <div class="rg-journey"><i id="rg-bar"></i></div>
  <div class="rg-hud">
    <span id="rg-hp">❤️❤️❤️</span><span id="rg-stage">The Neighborhood</span>
    <span id="rg-combo">x1</span><span id="rg-dist">0m</span><span id="rg-score">0</span>
  </div>
  <div class="rg-stagebox">
    <canvas id="rg-canvas" width="900" height="460"></canvas>
    <div id="rg-flash"></div>
  </div>
  <div class="rg-ctrls">
    <button class="rg-btn amber" id="rg-jump" style="flex:2">⬆️ JUMP</button>
    <button class="rg-btn go" id="rg-duckb" style="flex:1">⬇️ DUCK</button>
    <button class="rg-btn go" id="rg-aura" style="flex:1;display:none">✨ AURA</button>
  </div>
  <div id="rg-over" style="display:none" class="rg-card-panel">
    <div id="rg-over-title" style="font-family:'Fredoka',sans-serif;font-size:22px;color:#7B2D8E;text-align:center"></div>
    <p id="rg-over-msg" style="font-size:13px;color:#666;text-align:center;line-height:1.6;margin:8px 0 14px"></p>
    <button class="rg-btn amber" id="rg-again">Run it back</button>
    <button class="rg-btn go" id="rg-change" style="margin-top:8px;background:#eee;color:#7B2D8E;box-shadow:none">Change runner</button>
  </div>
</div>`;

function wire(){
  document.getElementById('rg-go').onclick     = ()=>rgStart();
  document.getElementById('rg-again').onclick  = ()=>rgStart();
  document.getElementById('rg-change').onclick = ()=>rgShowSelect();
  document.getElementById('rg-jump').onclick   = ()=>rgJump();
  document.getElementById('rg-aura').onclick   = ()=>rgAura();
  const d=document.getElementById('rg-duckb');
  d.onmousedown=()=>rgDuck(true); d.onmouseup=()=>rgDuck(false); d.onmouseleave=()=>rgDuck(false);
  d.ontouchstart=e=>{e.preventDefault();rgDuck(true);}; d.ontouchend=e=>{e.preventDefault();rgDuck(false);};
  const cv=document.getElementById('rg-canvas');
  cv.onclick=()=>rgJump();
  cv.ontouchstart=e=>{e.preventDefault();rgJump();};
  buildRoster();
}
function mount(host){
  injectCSS();
  host.innerHTML=RG_HTML;
  wire();
  host.dataset.rgMounted='1';
}
function unmount(){
  if(rgRaf) cancelAnimationFrame(rgRaf);
  rgRaf=null; rgOn=false;
}
// keyboard: only while the host is on screen
document.addEventListener('keydown',e=>{
  if(!document.getElementById('rg-host')) return;
  if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();rgJump();}
  if(e.code==='ArrowDown'){e.preventDefault();rgDuck(true);}
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();rgAura();}
});
document.addEventListener('keyup',e=>{ if(e.code==='ArrowDown') rgDuck(false); });

// watcher: survives the framework mounting/unmounting the screen
setInterval(()=>{
  const host=document.getElementById('rg-host');
  if(host && !host.dataset.rgMounted) mount(host);
  if(!host && rgOn) unmount();
}, 180);

window.RGEngine = { mount, unmount, start:()=>rgStart(), CHARS };
})();
