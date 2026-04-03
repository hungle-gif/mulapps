const puppeteer = require('puppeteer');
const fs = require('fs');
const OUT = 'C:/tmp/design-samples-v3';
const B = 'tintucai.vn';

// === DESIGN SYSTEM (8px grid) ===
const base = `* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Segoe UI',system-ui,sans-serif; overflow:hidden; position:relative; } .mono { font-family:'Cascadia Code','Consolas',monospace; }`;

// Aurora bg
const bg = (w,h) => `background:radial-gradient(ellipse at 15% 25%,rgba(124,58,237,0.45) 0%,transparent 50%),radial-gradient(ellipse at 85% 15%,rgba(6,182,212,0.35) 0%,transparent 50%),radial-gradient(ellipse at 55% 85%,rgba(236,72,153,0.2) 0%,transparent 50%),linear-gradient(180deg,#07071a 0%,#0c0c24 100%);width:${w}px;height:${h}px;`;
const dots = `<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-image:radial-gradient(circle,rgba(255,255,255,0.06) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;z-index:0"></div>`;
const orb = (t,l,s,c,o=0.2) => `<div style="position:absolute;top:${t}px;left:${l}px;width:${s}px;height:${s}px;border-radius:50%;background:radial-gradient(circle,${c} 0%,transparent 70%);opacity:${o};filter:blur(${Math.round(s*0.35)}px);pointer-events:none"></div>`;
const glass = (x='') => `background:rgba(255,255,255,0.035);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,0.08);border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.05);${x}`;
const gradLine = (w='120px') => `<div style="width:${w};height:2px;background:linear-gradient(90deg,transparent 0%,rgba(124,58,237,0.6) 20%,rgba(6,182,212,0.6) 80%,transparent 100%);border-radius:1px;margin:24px auto"></div>`;
const kicker = (t,c='#7C3AED') => `<div style="font-size:12px;color:${c};font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:16px">✦ ${t} ✦</div>`;
const brandBar = `<div style="position:absolute;bottom:0;left:0;right:0;height:40px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:13px;color:rgba(255,255,255,0.35);letter-spacing:4px;z-index:10">${B}</div>`;
const bracket = (p) => { const s={tl:'top:24px;left:24px;border-top:1.5px solid rgba(255,255,255,0.1);border-left:1.5px solid rgba(255,255,255,0.1)',br:'bottom:24px;right:24px;border-bottom:1.5px solid rgba(255,255,255,0.1);border-right:1.5px solid rgba(255,255,255,0.1)'}; return `<div style="position:absolute;${s[p]};width:32px;height:32px;pointer-events:none;z-index:1"></div>`; };

// Bar chart
const bar = (label,val,max,color,hl) => {
  const w = (val/max*100).toFixed(0);
  return `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:20px;color:${hl?'#e4e4ed':'rgba(255,255,255,0.4)'};font-weight:${hl?600:400};letter-spacing:-0.01em">${label}</span><span class="mono" style="font-size:20px;color:${hl?color:'rgba(255,255,255,0.4)'};font-weight:700">${val}%</span></div><div style="height:20px;border-radius:10px;background:rgba(255,255,255,0.04);overflow:hidden"><div style="width:${w}%;height:100%;border-radius:10px;background:${hl?`linear-gradient(90deg,${color},${color}bb)`:color+'28'};${hl?`box-shadow:0 0 16px ${color}33`:''}"></div></div></div>`;
};

const M = {
  short: 'Qwen3.5-27B', name: 'Qwen3.5-27B Claude Opus Distilled',
  dl: '353K', likes: '1.9K', params: '27B',
  desc: 'Chưng cất kiến thức từ Claude Opus vào Qwen3.5 — reasoning mạnh ngang Opus nhưng chạy local',
  comp: [{n:'Qwen3.5 (gốc)',s:72,c:'#6B7280'},{n:'GPT-4o mini',s:78,c:'#6B7280'},{n:'Claude Sonnet',s:82,c:'#6B7280'},{n:'Qwen3.5 Distilled',s:89,c:'#10B981'},{n:'Claude Opus',s:95,c:'#8B5CF6'}]
};

async function render() {
  const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox'] });
  fs.mkdirSync(OUT, { recursive: true });

  // ===== 1. BLOG FEATURED (1200x630) — F-pattern, left-heavy =====
  let p = await browser.newPage(); await p.setViewport({width:1200,height:630});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${bg(1200,630)}">
    ${dots}${orb(-60,780,400,'#7C3AED',0.3)}${orb(300,-40,300,'#06B6D4',0.2)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:56px 64px;height:100%;display:flex;gap:40px">
      <!-- Left 61.8% -->
      <div style="flex:0 0 680px;display:flex;flex-direction:column;justify-content:center">
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <span style="background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;padding:6px 16px;border-radius:16px;font-size:12px;font-weight:700;letter-spacing:0.06em">🔥 TRENDING #1</span>
          <span style="padding:6px 16px;border-radius:16px;font-size:12px;color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1)">HuggingFace</span>
        </div>
        <div style="font-size:44px;font-weight:800;color:#e4e4ed;line-height:1.12;letter-spacing:-0.03em">Qwen3.5 <span style="background:linear-gradient(90deg,#7C3AED,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Distilled</span></div>
        <div style="font-size:20px;color:rgba(255,255,255,0.5);margin-top:12px;font-weight:300;line-height:1.4;letter-spacing:-0.01em">${M.desc}</div>
        <div style="width:80px;height:2px;background:linear-gradient(90deg,#7C3AED,#06B6D4);border-radius:1px;margin:24px 0"></div>
        <div style="display:flex;gap:16px">
          ${[{v:M.dl,l:'Downloads',c:'#10B981'},{v:M.likes,l:'Likes',c:'#EF4444'},{v:M.params,l:'Params',c:'#F59E0B'}].map(s=>`<div style="${glass('padding:14px 20px;text-align:center;min-width:120px')}"><div class="mono" style="font-size:28px;font-weight:800;color:${s.c};text-shadow:0 0 16px ${s.c}33">${s.v}</div><div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;letter-spacing:0.1em;text-transform:uppercase">${s.l}</div></div>`).join('')}
        </div>
      </div>
      <!-- Right 38.2% — visual accent -->
      <div style="flex:1;display:flex;align-items:center;justify-content:center;position:relative">
        <div style="width:240px;height:240px;border-radius:50%;border:2px solid rgba(124,58,237,0.2);display:flex;align-items:center;justify-content:center;position:relative">
          <div style="width:180px;height:180px;border-radius:50%;border:1.5px solid rgba(6,182,212,0.15);display:flex;align-items:center;justify-content:center">
            <div style="font-size:64px;filter:drop-shadow(0 0 20px rgba(124,58,237,0.5))">🧠</div>
          </div>
        </div>
        <div style="position:absolute;top:20px;right:40px;font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:0.1em;text-transform:uppercase">27B params</div>
        <div style="position:absolute;bottom:20px;left:20px;font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:0.1em;text-transform:uppercase">128K context</div>
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({path:OUT+'/01_blog_featured.png'}); await p.close();
  console.log('1. Blog Featured ✅');

  // ===== 2. QUOTE CARD (1080x1080) — Centered, single focal =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1080});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${bg(1080,1080)}">
    ${dots}${orb(50,-60,400,'#EC4899',0.25)}${orb(600,650,350,'#7C3AED',0.2)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;height:100%;display:flex;align-items:center;justify-content:center;padding:72px">
      <div style="text-align:center;max-width:880px">
        <div style="font-size:64px;margin-bottom:32px;filter:drop-shadow(0 0 16px rgba(124,58,237,0.4))">💡</div>
        <div style="font-size:36px;color:#e4e4ed;font-weight:300;line-height:1.55;letter-spacing:-0.01em;font-style:italic">
          "Chưng cất kiến thức từ <span style="color:#a78bfa;font-weight:500">Claude Opus</span> vào model 27B — reasoning mạnh ngang hàng nhưng <span style="color:#22d3ee;font-weight:500">chạy local</span> được"
        </div>
        ${gradLine('80px')}
        <div style="font-size:18px;color:rgba(255,255,255,0.5);font-weight:500;letter-spacing:-0.01em">${M.name}</div>
        <div style="display:flex;gap:24px;justify-content:center;margin-top:32px">
          ${[{v:'353K',l:'downloads',c:'#10B981'},{v:'1.9K',l:'likes',c:'#EF4444'}].map(s=>`<div style="text-align:center"><span class="mono" style="font-size:24px;font-weight:800;color:${s.c}">${s.v}</span> <span style="font-size:14px;color:rgba(255,255,255,0.35)">${s.l}</span></div>`).join(`<div style="width:1px;height:24px;background:rgba(255,255,255,0.1)"></div>`)}
        </div>
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({path:OUT+'/02_quote_card.png'}); await p.close();
  console.log('2. Quote Card ✅');

  // ===== 3. COMPARISON (1080x1350) — Three-band vertical =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1350});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${bg(1080,1350)}">
    ${dots}${orb(80,680,350,'#10B981',0.25)}${orb(800,-40,250,'#8B5CF6',0.15)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:80px 72px">
      <!-- Top band -->
      <div style="margin-bottom:48px">
        ${kicker('BENCHMARK','#10B981')}
        <div style="font-size:44px;font-weight:800;color:#e4e4ed;letter-spacing:-0.03em;line-height:1.15">Qwen3.5 Distilled<br><span style="font-size:28px;font-weight:400;color:rgba(255,255,255,0.45)">vs Đối Thủ — Reasoning Score</span></div>
        <div style="width:64px;height:2px;background:linear-gradient(90deg,#10B981,#06B6D4);border-radius:1px;margin-top:24px"></div>
      </div>
      <!-- Middle band — bars -->
      <div style="${glass('padding:36px 32px;margin-bottom:32px')}">
        ${M.comp.map(c=>bar(c.n,c.s,100,c.c,c.s>=85)).join('')}
      </div>
      <!-- Bottom band — verdict -->
      <div style="${glass('padding:24px 28px;display:flex;align-items:center;gap:16px;border-color:rgba(16,185,129,0.15)')}">
        <div style="width:48px;height:48px;border-radius:24px;background:linear-gradient(135deg,#10B981,#059669);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;box-shadow:0 4px 16px rgba(16,185,129,0.3)">🏆</div>
        <div>
          <div style="font-size:20px;color:#10B981;font-weight:700;letter-spacing:-0.01em">89% — Gần bằng Claude Opus</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.4);margin-top:2px">Nhưng chạy local trên 1 GPU 24GB</div>
        </div>
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({path:OUT+'/03_comparison.png'}); await p.close();
  console.log('3. Comparison ✅');

  // ===== 4. STATS (1080x1080) — Grid, center gravity at 45% =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1080});
  const stats = [{l:'Parameters',v:'27B',i:'⚡',c:'#F97316'},{l:'Teacher',v:'Opus',i:'🧠',c:'#8B5CF6'},{l:'Context',v:'128K',i:'📏',c:'#06B6D4'},{l:'Downloads',v:'353K',i:'📥',c:'#10B981'},{l:'Likes',v:'1.9K',i:'❤️',c:'#EF4444'},{l:'Base',v:'Qwen3.5',i:'🏗️',c:'#F59E0B'}];
  await p.setContent(`<html><head><style>${base}</style></head><body style="${bg(1080,1080)}">
    ${dots}${orb(-40,350,400,'#F59E0B',0.15)}${orb(650,100,300,'#7C3AED',0.12)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:72px;height:100%;display:flex;flex-direction:column;justify-content:center">
      <!-- Title at ~35% from top -->
      <div style="text-align:center;margin-bottom:48px">
        ${kicker('THÔNG SỐ KỸ THUẬT','#F59E0B')}
        <div style="font-size:48px;font-weight:800;color:#e4e4ed;letter-spacing:-0.03em">${M.short}</div>
        ${gradLine('80px')}
      </div>
      <!-- 2x3 grid -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${stats.map(s=>`<div style="${glass('padding:24px;text-align:center')}">
          <div style="font-size:32px;margin-bottom:8px;filter:drop-shadow(0 0 8px ${s.c}44)">${s.i}</div>
          <div class="mono" style="font-size:32px;font-weight:800;color:#e4e4ed;text-shadow:0 0 16px ${s.c}33">${s.v}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:6px;letter-spacing:0.12em;text-transform:uppercase">${s.l}</div>
        </div>`).join('')}
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({path:OUT+'/04_stats.png'}); await p.close();
  console.log('4. Stats ✅');

  // ===== 5. CODE SNIPPET (1200x800) =====
  p = await browser.newPage(); await p.setViewport({width:1200,height:800});
  await p.setContent(`<html><head><style>${base}</style></head><body style="background:#0b0b1a;width:1200px;height:800px;padding:48px;position:relative;overflow:hidden">
    ${dots}${orb(-30,850,280,'#7C3AED',0.15)}${orb(500,-30,220,'#06B6D4',0.1)}
    <div style="position:relative;z-index:1;${glass('overflow:hidden')}">
      <div style="display:flex;align-items:center;gap:8px;padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.05)">
        <div style="width:11px;height:11px;border-radius:50%;background:#f38ba8"></div>
        <div style="width:11px;height:11px;border-radius:50%;background:#a6e3a1"></div>
        <div style="width:11px;height:11px;border-radius:50%;background:#f9e2af"></div>
        <span style="margin-left:16px;font-size:13px;color:rgba(255,255,255,0.25)">qwen_distilled.py</span>
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,0.15);letter-spacing:0.12em;text-transform:uppercase">Python</span>
      </div>
      <div class="mono" style="padding:28px 32px;font-size:19px;line-height:1.85;color:#cdd6f4">
        <div><span style="color:#cba6f7">from</span> <span style="color:#89b4fa">transformers</span> <span style="color:#cba6f7">import</span> <span style="color:#a6e3a1">AutoModelForCausalLM</span>, <span style="color:#a6e3a1">AutoTokenizer</span></div>
        <div style="color:#45475a">&nbsp;</div>
        <div><span style="color:#45475a"># 🔥 Load Qwen3.5 Distilled from Claude Opus</span></div>
        <div><span style="color:#cdd6f4">model_id</span> <span style="color:#89dceb">=</span> <span style="color:#a6e3a1">"Jackrong/Qwen3.5-27B-Claude-4.6-Opus"</span></div>
        <div style="color:#45475a">&nbsp;</div>
        <div><span style="color:#cdd6f4">tokenizer</span> <span style="color:#89dceb">=</span> <span style="color:#89b4fa">AutoTokenizer</span>.<span style="color:#f9e2af">from_pretrained</span>(<span style="color:#cdd6f4">model_id</span>)</div>
        <div><span style="color:#cdd6f4">model</span> <span style="color:#89dceb">=</span> <span style="color:#89b4fa">AutoModelForCausalLM</span>.<span style="color:#f9e2af">from_pretrained</span>(</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#cdd6f4">model_id</span>,</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#cdd6f4">device_map</span><span style="color:#89dceb">=</span><span style="color:#a6e3a1">"auto"</span>,  <span style="color:#45475a"># Tự phân bổ GPU</span></div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#cdd6f4">torch_dtype</span><span style="color:#89dceb">=</span><span style="color:#a6e3a1">"auto"</span></div>
        <div>)</div>
        <div style="color:#45475a">&nbsp;</div>
        <div><span style="color:#45475a"># ⚡ Reasoning ngang Claude Opus — chạy trên 1 GPU 24GB</span></div>
      </div>
    </div>
    <div style="position:absolute;bottom:14px;right:24px;font-size:12px;color:rgba(255,255,255,0.15);letter-spacing:4px;z-index:1">${B}</div>
  </body></html>`);
  await p.screenshot({path:OUT+'/05_code_snippet.png'}); await p.close();
  console.log('5. Code Snippet ✅');

  // ===== 6. THUMBNAIL (1280x720) — Bold impact, max 7 words =====
  p = await browser.newPage(); await p.setViewport({width:1280,height:720});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${bg(1280,720)}">
    ${dots}${orb(-80,850,500,'#EF4444',0.35)}${orb(350,-60,350,'#7C3AED',0.3)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:56px 64px;height:100%;display:flex;flex-direction:column;justify-content:space-between">
      <div style="display:flex;gap:8px">
        <span style="background:linear-gradient(135deg,#EF4444,#F97316);color:#fff;padding:8px 20px;border-radius:20px;font-size:16px;font-weight:800;letter-spacing:0.04em;box-shadow:0 4px 16px rgba(239,68,68,0.4)">🔥 #1 TRENDING</span>
      </div>
      <div>
        <div style="font-size:88px;font-weight:900;color:#e4e4ed;line-height:1.0;letter-spacing:-0.04em;text-shadow:0 4px 24px rgba(0,0,0,0.5)">
          Qwen3.5<br><span style="background:linear-gradient(90deg,#F97316,#EF4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Distilled</span>
        </div>
        <div style="font-size:36px;color:rgba(255,255,255,0.55);margin-top:8px;font-weight:300;letter-spacing:-0.02em">Claude Opus → 27B Local</div>
      </div>
      <div style="display:flex;gap:12px">
        ${[{v:'📥 353K',c:'#10B981'},{v:'❤️ 1.9K',c:'#EF4444'},{v:'⚡ 27B',c:'#F59E0B'}].map(s=>`<span style="${glass(`padding:8px 16px;border-radius:12px;font-size:18px;color:${s.c};font-weight:700`)}">${s.v}</span>`).join('')}
      </div>
    </div>
  </body></html>`);
  await p.screenshot({path:OUT+'/06_thumbnail.png'}); await p.close();
  console.log('6. Thumbnail ✅');

  // ===== 7. CHECKLIST (1080x1350) =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1350});
  const checks = [{t:'Reasoning mạnh ngang Opus',d:true},{t:'Chạy local 1 GPU (24GB)',d:true},{t:'128K context window',d:true},{t:'Open-source HuggingFace',d:true},{t:'353K downloads tuần đầu',d:true},{t:'Hỗ trợ tiếng Việt tốt',d:false},{t:'Production-ready',d:false}];
  await p.setContent(`<html><head><style>${base}</style></head><body style="${bg(1080,1350)}">
    ${dots}${orb(850,650,350,'#06B6D4',0.2)}${orb(-30,-30,250,'#10B981',0.15)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:80px 72px">
      <div style="margin-bottom:48px">
        ${kicker('CHECKLIST','#06B6D4')}
        <div style="font-size:44px;font-weight:800;color:#e4e4ed;letter-spacing:-0.03em">Qwen3.5 Distilled</div>
        <div style="font-size:20px;color:rgba(255,255,255,0.4);margin-top:8px;font-weight:300">Có đáng thử không?</div>
        <div style="width:56px;height:2px;background:linear-gradient(90deg,#06B6D4,#10B981);border-radius:1px;margin-top:24px"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${checks.map(c=>`<div style="${glass(`display:flex;align-items:center;gap:16px;padding:18px 24px;${c.d?'border-color:rgba(16,185,129,0.12)':'opacity:0.55'}`)}>
          <div style="width:36px;height:36px;border-radius:18px;background:${c.d?'linear-gradient(135deg,#10B981,#059669)':'rgba(255,255,255,0.06)'};display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:700;flex-shrink:0;${c.d?'box-shadow:0 2px 8px rgba(16,185,129,0.25)':''}">${c.d?'✓':'?'}</div>
          <span style="font-size:22px;color:${c.d?'#e4e4ed':'rgba(255,255,255,0.4)'};font-weight:${c.d?500:300};letter-spacing:-0.01em">${c.t}</span>
        </div>`).join('')}
      </div>
      <div style="margin-top:40px;text-align:center">
        <span class="mono" style="font-size:48px;font-weight:900;background:linear-gradient(90deg,#10B981,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">5/7</span>
        <span style="font-size:22px;color:rgba(255,255,255,0.5);margin-left:12px;font-weight:300">— Đáng thử!</span>
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({path:OUT+'/07_checklist.png'}); await p.close();
  console.log('7. Checklist ✅');

  // ===== 8. INFOGRAPHIC (1080x2400) — Modular sections =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:2400});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${bg(1080,2400)}">
    ${dots}${orb(-30,300,450,'#7C3AED',0.25)}${orb(700,600,350,'#06B6D4',0.15)}${orb(1500,-30,300,'#EC4899',0.15)}${orb(2000,650,280,'#10B981',0.12)}
    <div style="position:relative;z-index:1;padding:80px 64px">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:64px">
        <div style="font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:6px;text-transform:uppercase;margin-bottom:20px">${B}</div>
        <div style="font-size:52px;font-weight:900;color:#e4e4ed;line-height:1.12;letter-spacing:-0.03em">Qwen3.5-27B<br><span style="background:linear-gradient(90deg,#7C3AED,#EC4899,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Claude Opus Distilled</span></div>
        <div style="font-size:18px;color:rgba(255,255,255,0.35);margin-top:14px;font-weight:300">#1 Trending HuggingFace · Tháng 4/2026</div>
        ${gradLine('160px')}
      </div>

      <!-- Section 01 -->
      <div style="margin-bottom:56px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <span class="mono" style="font-size:40px;font-weight:800;color:rgba(124,58,237,0.3)">01</span>
          ${kicker('TẠI SAO HOT?','#F59E0B')}
        </div>
        <div style="${glass('padding:28px 32px')}">
          <div style="font-size:20px;color:rgba(255,255,255,0.7);line-height:1.7;letter-spacing:-0.01em">Chưng cất kiến thức từ <span style="color:#a78bfa;font-weight:600">Claude 4.6 Opus</span> vào <span style="color:#22d3ee;font-weight:600">Qwen3.5 27B</span>. Kết quả: reasoning gần bằng Opus nhưng chạy local trên 1 GPU.</div>
        </div>
      </div>

      <!-- Section 02 -->
      <div style="margin-bottom:56px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <span class="mono" style="font-size:40px;font-weight:800;color:rgba(16,185,129,0.3)">02</span>
          ${kicker('THÔNG SỐ','#10B981')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
          ${[{l:'Params',v:'27B',c:'#F97316'},{l:'Teacher',v:'Opus',c:'#8B5CF6'},{l:'Context',v:'128K',c:'#06B6D4'},{l:'Downloads',v:'353K',c:'#10B981'}].map(s=>`<div style="${glass('padding:20px;text-align:center')}"><div class="mono" style="font-size:28px;font-weight:800;color:${s.c};text-shadow:0 0 12px ${s.c}33">${s.v}</div><div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;letter-spacing:0.1em;text-transform:uppercase">${s.l}</div></div>`).join('')}
        </div>
      </div>

      <!-- Section 03 -->
      <div style="margin-bottom:56px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <span class="mono" style="font-size:40px;font-weight:800;color:rgba(236,72,153,0.3)">03</span>
          ${kicker('BENCHMARK','#EC4899')}
        </div>
        <div style="${glass('padding:28px 32px')}">
          ${M.comp.map(c=>bar(c.n,c.s,100,c.c,c.s>=85)).join('')}
        </div>
      </div>

      <!-- Section 04 -->
      <div style="margin-bottom:56px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <span class="mono" style="font-size:40px;font-weight:800;color:rgba(6,182,212,0.3)">04</span>
          ${kicker('ĐÁNH GIÁ','#06B6D4')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div style="${glass('padding:24px;border-color:rgba(16,185,129,0.12)')}">
            <div style="font-size:18px;color:#10B981;font-weight:700;margin-bottom:12px">✅ Ưu điểm</div>
            <div style="font-size:16px;color:rgba(255,255,255,0.55);line-height:1.8">• Reasoning gần Opus<br>• Chạy local 1 GPU<br>• Open-source<br>• 128K context</div>
          </div>
          <div style="${glass('padding:24px;border-color:rgba(239,68,68,0.12)')}">
            <div style="font-size:18px;color:#EF4444;font-weight:700;margin-bottom:12px">⚠️ Lưu ý</div>
            <div style="font-size:16px;color:rgba(255,255,255,0.55);line-height:1.8">• Cần GPU 24GB+<br>• Distilled ≠ Original<br>• Chưa production<br>• Community model</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;margin-top:48px">
        <div style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#06B6D4);border-radius:40px;padding:14px 48px;box-shadow:0 6px 24px rgba(124,58,237,0.35)">
          <span style="font-size:24px;font-weight:800;color:#fff;letter-spacing:0.02em">${B}</span>
        </div>
        <div style="font-size:14px;color:rgba(255,255,255,0.25);margin-top:14px;letter-spacing:0.06em">Follow để cập nhật tin tức AI mới nhất</div>
      </div>
    </div>
  </body></html>`);
  await p.screenshot({path:OUT+'/08_infographic.png'}); await p.close();
  console.log('8. Infographic ✅');

  await browser.close();
  console.log('\n✅ All 8 PRO V3 → C:/tmp/design-samples-v3/');
}

render().catch(e => console.error('Error:', e.message));
