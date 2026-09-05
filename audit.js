/* Full pre-flight audit — catches the bug classes that have actually bitten us */
const fs=require('fs');
let FAIL=0, WARN=0;
const bad=m=>{console.log('  ❌ '+m);FAIL++;};
const warn=m=>{console.log('  ⚠️  '+m);WARN++;};
const ok=m=>console.log('  ✅ '+m);

const h=fs.readFileSync('index.html','utf8');
const dc=h.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);

console.log('\n=== 1. SYNTAX ===');
['runner-engine.js','firebase-live.js','firebase-config.js','pf-icons.js'].forEach(f=>{
  if(!fs.existsSync(f)) return bad(f+' MISSING');
  try{new Function(fs.readFileSync(f,'utf8'));ok(f)}catch(e){bad(f+': '+e.message)}
});
try{new Function('DCLogic',dc[1]);ok('dc component')}catch(e){bad('dc component: '+e.message)}
const inline=[...h.matchAll(/<script(?![^>]*src)(?![^>]*x-dc)[^>]*>([\s\S]*?)<\/script>/g)];
let iok=true;inline.forEach((x,i)=>{try{new Function(x[1])}catch(e){iok=false;bad('inline script '+i+': '+e.message)}});
if(iok)ok(inline.length+' inline scripts');

console.log('\n=== 2. TEMPLATE TAGS ===');
const io=(h.match(/<sc-if/g)||[]).length, ic=(h.match(/<\/sc-if>/g)||[]).length;
io===ic?ok(`sc-if balanced (${io})`):bad(`sc-if ${io} open / ${ic} close`);
const fo=(h.match(/<sc-for/g)||[]).length, fc=(h.match(/<\/sc-for>/g)||[]).length;
fo===fc?ok(`sc-for balanced (${fo})`):bad(`sc-for ${fo} open / ${fc} close`);

console.log('\n=== 3. SCREEN WIRING (template guard + return entry) ===');
const screens=[...h.matchAll(/\{\{\s*(screen[A-Z]\w*)\s*\}\}/g)].map(m=>m[1]);
[...new Set(screens)].forEach(s=>{
  h.includes(s+': scr===')||h.includes(s+':scr===') ? ok(s) : bad(s+' in template but NOT in return block');
});


console.log('\n=== 4. RETURN BLOCK: every expose resolves ===');
const code=dc[1];
const ri=code.lastIndexOf('return {');
const retEnd=code.indexOf('\n    };',ri);
const ret=code.slice(ri+8,retEnd);
const scope=code.slice(0,ri);
const declared=new Set();
[...scope.matchAll(/(?:const|let|var)\s+([\s\S]{0,400}?)(?:=[^,;]|;)/g)].forEach(m=>{
  m[1].split(',').forEach(p=>{const n=p.trim().split(/[\s=(]/)[0].replace(/[{}\[\]]/g,'');
    if(n&&/^[A-Za-z_$][\w$]*$/.test(n))declared.add(n);});
});
[...scope.matchAll(/(?:const|let|var)\s+(\w+)/g)].forEach(m=>declared.add(m[1]));
// multi-declarations: let a = 1, b = [];
[...scope.matchAll(/(?:const|let|var)\s+[^;\n]*/g)].forEach(m=>{
  m[0].replace(/^(?:const|let|var)\s+/,'').split(',').forEach(p=>{
    const n=p.trim().split(/[\s=]/)[0];
    if(n&&/^[A-Za-z_$][\w$]*$/.test(n))declared.add(n);
  });
});
const exposed=[...ret.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?=,|\n|$)/gm)].map(m=>m[1]);
const missing=[...new Set(exposed)].filter(x=>!declared.has(x));
missing.length?missing.forEach(x=>bad(x+' exposed but never declared')):ok(`all ${new Set(exposed).size} exposes resolve`);


console.log('\n=== 3b. GAME SCREENS render on entry (mode guard vs nav+init) ===');
{
  const st=(code.match(/state\s*=\s*\{([\s\S]*?)\n  \};/)||[])[1]||'';
  const navB=code.slice(code.indexOf('const nav = {'), code.indexOf('};',code.indexOf('const nav = {')));
  [['dealMode','dealOff'],['bingoMode','bingoMenuOn'],['auctionMode','aucOff'],['reokeMode','reokeOff']].forEach(([m,g])=>{
    const init=((st.match(new RegExp(m+':\\s*([^,\\n]+)'))||[])[1]||'MISSING').trim();
    const expr=((code.match(new RegExp('const '+g+'\\s*=\\s*([^;]+)'))||[])[1]||'MISSING').trim();
    // find the nav handler that navigates to this screen
    const scr=m.replace('Mode','').toLowerCase();
    const navLine=navB.split('\n').find(l=>l.trim().startsWith(scr+':'))||'';
    const navSets=(navLine.match(new RegExp(m+':\\s*([^,}]+)'))||[])[1];
    const effective=navSets?navSets.trim():init;
    const renders = expr.startsWith('!s.') ? (effective==='null'||effective==='undefined') : null;
    if(renders===false) bad(`${scr} screen: nav sets ${m}=${effective} but guard is ${expr} → renders BLANK`);
    else ok(`${scr}: ${m}=${effective}, guard ${g} → shows menu`);
  });
}

console.log('\n=== 4b. METHOD CALLS resolve (this._x) ===');
{
  const calls=[...new Set([...code.matchAll(/this\.(_\w+)\s*\(/g)].map(m=>m[1]))];
  const defined=new Set();
  [...code.matchAll(/^\s{2}(_\w+)\s*[\(=]/gm)].forEach(m=>defined.add(m[1]));
  const miss=calls.filter(c=>!defined.has(c));
  miss.length?miss.forEach(m=>bad('this.'+m+'() called but never defined')):ok(`all ${calls.length} method calls resolve`);
}

console.log('\n=== 4c. STATE FIELDS referenced in render exist in state ===');
{
  const stateBlock=(code.match(/state\s*=\s*\{([\s\S]*?)\n  \};/)||[])[1]||'';
  const stateKeys=new Set([...stateBlock.matchAll(/(\w+)\s*:/g)].map(m=>m[1]));
  const used=[...new Set([...code.matchAll(/\bs\.(\w+)/g)].map(m=>m[1]))];
  const miss=used.filter(u=>!stateKeys.has(u));
  miss.length?warn('s.'+miss.join(', s.')+' read but not in initial state (may be fine if set later)'):ok(`all ${used.length} state reads declared`);
}

console.log('\n=== 5. TEMPLATE BINDINGS resolve to return block ===');
const bindings=[...h.matchAll(/\{\{\s*([a-z][\w$]*)\s*\}\}/g)].map(m=>m[1]);
const retNames=new Set([...ret.matchAll(/([A-Za-z_$][\w$]*)\s*[,:]/g)].map(m=>m[1]));
const unresolved=[...new Set(bindings)].filter(b=>!retNames.has(b)&&!b.match(/^(true|false|null)$/));
unresolved.length?unresolved.slice(0,15).forEach(x=>warn(x+' used in template, not in return block')):ok('all template bindings resolve');

console.log('\n=== 6. DUPLICATE METHODS (silent overwrite) ===');
const methods=[...code.matchAll(/^\s{2}(\w+)\s*\(/gm)].map(m=>m[1]).filter(n=>!['if','for','while','switch','catch','return','function'].includes(n));
const counts={};methods.forEach(m=>counts[m]=(counts[m]||0)+1);
const dupes=Object.entries(counts).filter(([k,v])=>v>1);
dupes.length?dupes.forEach(([k,v])=>bad(`${k}() declared ${v}x — second silently overwrites first`)):ok('no duplicate methods');

console.log('\n=== 7. RAW onclick INSIDE x-dc (framework strips these) ===');
const xs=h.indexOf('<x-dc>'), xe=h.indexOf('</x-dc>');
const inside=h.slice(xs,xe);
const raw=[...inside.matchAll(/onclick="([^"]+)"/g)];
raw.length?raw.forEach(m=>bad('raw onclick inside x-dc: '+m[1]+' (use onClick="{{ }}")')):ok('no raw onclick inside x-dc');

console.log('\n=== 8. ASSETS ===');
const sprites=[];
for(const m of fs.readFileSync('runner-engine.js','utf8').matchAll(/\[([^\]]+)\]\.forEach\(\w+=>px\('(\w+)_?'\+\w+,'([^']+)'\+\w+\+'([^']*)'\)/g)){}
try{require('child_process').execSync('node check-assets.js',{stdio:'pipe'});ok('all sprite paths resolve')}catch(e){bad('sprite paths broken')}
['sounds/three_big_doors.mp3','sounds/Countdown.mp3','sounds/Countdown_sound.mp3'].forEach(f=>
  fs.existsSync(f)?ok(f):bad(f+' MISSING'));

console.log('\n=== 9. FIREBASE SYNC KEYS match persist mapper ===');
const live=fs.readFileSync('firebase-live.js','utf8');
const keys=(live.match(/var KEYS = \[([^\]]+)\]/)||[])[1];
const keyList=keys?keys.split(',').map(s=>s.trim().replace(/'/g,'')):[];
const mapper=(h.match(/const map = \{([\s\S]*?)\};/)||[])[1]||'';
const mapped=[...mapper.matchAll(/(\w+):'(\w+)'/g)].map(m=>m[2]);
mapped.forEach(m=>keyList.includes(m)?null:bad(`persist maps to '${m}' but firebase-live KEYS lacks it`));
ok(`${keyList.length} sync keys: ${keyList.join(', ')}`);

console.log('\n=== 10. PASSWORDS ===');
[['porchfamilyweekend','admin'],['porchgamenight','game host'],['porchfamilyannounce','announcements'],['Porchfamilyquiz','quiz editor']]
 .forEach(([p,label])=>h.includes(p)?ok(`${label}: ${p}`):bad(`${label} password missing`));

console.log('\n'+'='.repeat(46));
console.log(FAIL?`❌ ${FAIL} ERROR(S), ${WARN} warning(s)`:`✅ CLEAN — ${WARN} warning(s)`);
