/* Verify every sprite path the engine requests exists on disk.
   This is the check that would have caught the rename mistake. */
const fs=require('fs');
const src=fs.readFileSync('runner-engine.js','utf8');
const asks=new Set();

// pattern A: px('key','sprites/...')  literal paths
for(const m of src.matchAll(/px\([^,]+,\s*['"`]([^'"`]+\.png)['"`]\)/g)) asks.add(m[1]);
// pattern B: template/concat paths built inside forEach lists
for(const m of src.matchAll(/\[([^\]]+)\]\.forEach\(\s*\w+\s*=>\s*px\([^,]+,\s*['"`]([^'"`]*)['"`]\s*\+\s*\w+\s*\+\s*['"`]([^'"`]*)['"`]/g)){
  const keys=[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  keys.forEach(k=>asks.add(m[2]+k+m[3]));
}
// pattern C: backtick templates
for(const m of src.matchAll(/px\([^,]+,\s*`([^`]+)`\)/g)){
  const t=m[1];
  if(t.includes('${c.key}')){
    // read the REAL frame count per character from the CHARS table
    const chars=[...src.matchAll(/\{key:'(\w+)'[^}]*?frames:(\d+)\}/g)].map(m=>({k:m[1],n:+m[2]}));
    chars.forEach(c=>{
      if(t.includes('_run')) for(let i=0;i<c.n;i++) asks.add(t.replace('${c.key}',c.k).replace('${i}',i));
      else asks.add(t.replace('${c.key}',c.k));
    });
  }
}
let missing=0, checked=0;
[...asks].sort().forEach(p=>{
  if(p.includes('${')) return;              // unresolved template, skip
  checked++;
  if(!fs.existsSync(p)){ console.log('  ❌ MISSING', p); missing++; }
});
console.log(missing ? `❌ ${missing} of ${checked} sprite paths do not exist`
                    : `✅ all ${checked} sprite paths resolve on disk`);
process.exit(missing?1:0);
