const puppeteer = require('puppeteer');
const fs = require('fs');
const OUT = 'C:/tmp/design-samples-v4';
const B = 'tintucai.vn';

const base = `* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Segoe UI',system-ui,sans-serif; overflow:hidden; position:relative; } .mono { font-family:'Cascadia Code','Consolas',monospace; }`;

// 5 bảng màu khác nhau cho đa dạng
const themes = {
  violet:  { bg: '#08081a', accent: '#8B5CF6', accent2: '#C084FC', glow1: 'rgba(139,92,246,0.5)', glow2: 'rgba(192,132,252,0.3)', glow3: 'rgba(59,130,246,0.2)' },
  ocean:   { bg: '#071520', accent: '#06B6D4', accent2: '#22D3EE', glow1: 'rgba(6,182,212,0.5)', glow2: 'rgba(34,211,238,0.3)', glow3: 'rgba(16,185,129,0.2)' },
  sunset:  { bg: '#1a0a0a', accent: '#F97316', accent2: '#FB923C', glow1: 'rgba(249,115,22,0.5)', glow2: 'rgba(251,146,60,0.3)', glow3: 'rgba(239,68,68,0.2)' },
  emerald: { bg: '#061a12', accent: '#10B981', accent2: '#34D399', glow1: 'rgba(16,185,129,0.5)', glow2: 'rgba(52,211,153,0.3)', glow3: 'rgba(6,182,212,0.2)' },
  rose:    { bg: '#1a0818', accent: '#EC4899', accent2: '#F472B6', glow1: 'rgba(236,72,153,0.5)', glow2: 'rgba(244,114,182,0.3)', glow3: 'rgba(139,92,246,0.2)' },
};

const makeBg = (w, h, t) => `background:radial-gradient(ellipse at 15% 25%,${t.glow1} 0%,transparent 50%),radial-gradient(ellipse at 85% 15%,${t.glow2} 0%,transparent 50%),radial-gradient(ellipse at 55% 85%,${t.glow3} 0%,transparent 50%),linear-gradient(180deg,${t.bg} 0%,${t.bg}ee 100%);width:${w}px;height:${h}px;`;
const dots = `<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-image:radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;z-index:0"></div>`;
const orb = (t,l,s,c,o=0.2) => `<div style="position:absolute;top:${t}px;left:${l}px;width:${s}px;height:${s}px;border-radius:50%;background:radial-gradient(circle,${c} 0%,transparent 70%);opacity:${o};filter:blur(${Math.round(s*0.35)}px);pointer-events:none"></div>`;
const glass = (x='') => `background:rgba(255,255,255,0.04);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,0.08);border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.05);${x}`;

// Watermark brand - góc dưới phải
const watermark = `<div style="position:absolute;bottom:16px;right:20px;display:flex;align-items:center;gap:8px;z-index:10;opacity:0.6">
  <div style="width:6px;height:6px;border-radius:50%;background:#7C3AED"></div>
  <span style="font-size:14px;color:rgba(255,255,255,0.5);font-weight:600;letter-spacing:2px">${B}</span>
</div>`;

const bar = (label,val,max,color,hl) => {
  const w = (val/max*100).toFixed(0);
  return `<div style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:26px;color:${hl?'#e4e4ed':'rgba(255,255,255,0.4)'};font-weight:${hl?700:400}">${label}</span><span class="mono" style="font-size:26px;color:${hl?color:'rgba(255,255,255,0.4)'};font-weight:800">${val}%</span></div><div style="height:28px;border-radius:14px;background:rgba(255,255,255,0.04);overflow:hidden"><div style="width:${w}%;height:100%;border-radius:14px;background:${hl?`linear-gradient(90deg,${color},${color}bb)`:color+'28'};${hl?`box-shadow:0 0 20px ${color}44`:''}"></div></div></div>`;
};

const M = {
  short: 'Qwen3.5-27B', name: 'Qwen3.5-27B Claude Opus Distilled',
  dl: '353K', likes: '1.9K', params: '27B',
  desc: 'Chưng cất kiến thức từ Claude Opus vào Qwen3.5\nReasoning mạnh ngang Opus — chạy local',
  comp: [{n:'Qwen3.5 (gốc)',s:72,c:'#6B7280'},{n:'GPT-4o mini',s:78,c:'#6B7280'},{n:'Claude Sonnet',s:82,c:'#6B7280'},{n:'Qwen3.5 Distilled',s:89,c:'#10B981'},{n:'Claude Opus',s:95,c:'#8B5CF6'}]
};

async function render() {
  const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox'] });
  fs.mkdirSync(OUT, { recursive: true });

  // ===== 1. BLOG FEATURED (1200x630) — Theme: violet =====
  const t1 = themes.violet;
  let p = await browser.newPage(); await p.setViewport({width:1200,height:630});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${makeBg(1200,630,t1)}">
    ${dots}${orb(-60,780,400,t1.accent,0.3)}${orb(300,-40,300,t1.accent2,0.2)}
    <div style="position:relative;z-index:1;padding:56px 64px;height:100%;display:flex;gap:48px">
      <div style="flex:0 0 680px;display:flex;flex-direction:column;justify-content:center">
        <div style="display:flex;gap:8px;margin-bottom:20px">
          <span style="background:${t1.accent};color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:700;letter-spacing:0.05em">🔥 TRENDING #1</span>
        </div>
        <div style="font-size:54px;font-weight:900;color:#fff;line-height:1.08;letter-spacing:-0.03em;text-shadow:0 0 40px ${t1.accent}66">Qwen3.5 <span style="color:${t1.accent2}">Distilled</span></div>
        <div style="font-size:24px;color:rgba(255,255,255,0.5);margin-top:16px;font-weight:300;line-height:1.5">Chưng cất Claude Opus → Model 27B chạy local</div>
        <div style="width:80px;height:3px;background:linear-gradient(90deg,${t1.accent},${t1.accent2});border-radius:2px;margin:28px 0"></div>
        <div style="display:flex;gap:16px">
          ${[{v:M.dl,l:'Downloads',c:'#10B981'},{v:M.likes,l:'Likes',c:'#EF4444'},{v:'27B',l:'Params',c:'#F59E0B'}].map(s=>`<div style="${glass('padding:16px 24px;text-align:center')}"><div class="mono" style="font-size:34px;font-weight:900;color:${s.c};text-shadow:0 0 16px ${s.c}44">${s.v}</div><div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:4px;letter-spacing:0.1em;text-transform:uppercase">${s.l}</div></div>`).join('')}
        </div>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center">
        <div style="width:220px;height:220px;border-radius:50%;border:2px solid ${t1.accent}33;display:flex;align-items:center;justify-content:center">
          <div style="width:160px;height:160px;border-radius:50%;border:1.5px solid ${t1.accent2}22;display:flex;align-items:center;justify-content:center">
            <div style="font-size:72px;filter:drop-shadow(0 0 24px ${t1.accent}88)">🧠</div>
          </div>
        </div>
      </div>
    </div>
    ${watermark}
  </body></html>`);
  await p.screenshot({path:OUT+'/01_blog_featured.png'}); await p.close();
  console.log('1. Blog Featured (violet) ✅');

  // ===== 2. QUOTE CARD (1080x1080) — Theme: rose =====
  const t2 = themes.rose;
  p = await browser.newPage(); await p.setViewport({width:1080,height:1080});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${makeBg(1080,1080,t2)}">
    ${dots}${orb(50,-60,400,t2.accent,0.25)}${orb(600,650,350,t2.accent2,0.2)}
    <div style="position:relative;z-index:1;height:100%;display:flex;align-items:center;justify-content:center;padding:80px">
      <div style="text-align:center;max-width:880px">
        <div style="font-size:80px;margin-bottom:32px;filter:drop-shadow(0 0 20px ${t2.accent}55)">💡</div>
        <div style="font-size:42px;color:#fff;font-weight:300;line-height:1.5;letter-spacing:-0.01em;font-style:italic">
          "Chưng cất kiến thức từ <span style="color:${t2.accent2};font-weight:600">Claude Opus</span> vào model 27B — reasoning mạnh ngang nhưng <span style="color:#22d3ee;font-weight:600">chạy local</span> được"
        </div>
        <div style="width:80px;height:3px;background:linear-gradient(90deg,${t2.accent},${t2.accent2});border-radius:2px;margin:40px auto"></div>
        <div style="font-size:22px;color:rgba(255,255,255,0.55);font-weight:500">${M.name}</div>
        <div style="display:flex;gap:32px;justify-content:center;margin-top:32px">
          <div><span class="mono" style="font-size:28px;font-weight:900;color:#10B981">353K</span> <span style="font-size:16px;color:rgba(255,255,255,0.35)">downloads</span></div>
          <div style="width:1px;background:rgba(255,255,255,0.1)"></div>
          <div><span class="mono" style="font-size:28px;font-weight:900;color:${t2.accent}">1.9K</span> <span style="font-size:16px;color:rgba(255,255,255,0.35)">likes</span></div>
        </div>
      </div>
    </div>
    ${watermark}
  </body></html>`);
  await p.screenshot({path:OUT+'/02_quote_card.png'}); await p.close();
  console.log('2. Quote Card (rose) ✅');

  // ===== 3. COMPARISON (1080x1350) — Theme: emerald =====
  const t3 = themes.emerald;
  p = await browser.newPage(); await p.setViewport({width:1080,height:1350});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${makeBg(1080,1350,t3)}">
    ${dots}${orb(80,680,350,t3.accent,0.25)}${orb(800,-40,250,t3.accent2,0.15)}
    <div style="position:relative;z-index:1;padding:80px 64px">
      <div style="margin-bottom:48px">
        <div style="font-size:13px;color:${t3.accent};font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:16px">✦ BENCHMARK ✦</div>
        <div style="font-size:52px;font-weight:900;color:#fff;letter-spacing:-0.03em;line-height:1.1">Qwen3.5 Distilled</div>
        <div style="font-size:28px;color:rgba(255,255,255,0.45);margin-top:8px;font-weight:300">vs Đối Thủ — Reasoning Score</div>
        <div style="width:64px;height:3px;background:linear-gradient(90deg,${t3.accent},${t3.accent2});border-radius:2px;margin-top:24px"></div>
      </div>
      <div style="${glass('padding:40px 36px;margin-bottom:28px')}">
        ${M.comp.map(c=>bar(c.n,c.s,100,c.c,c.s>=85)).join('')}
      </div>
      <div style="${glass(`padding:24px 28px;display:flex;align-items:center;gap:16px;border-color:${t3.accent}22`)}">
        <div style="width:52px;height:52px;border-radius:26px;background:linear-gradient(135deg,${t3.accent},${t3.accent2});display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;box-shadow:0 4px 16px ${t3.accent}44">🏆</div>
        <div>
          <div style="font-size:24px;color:${t3.accent};font-weight:700">89% — Gần bằng Claude Opus</div>
          <div style="font-size:16px;color:rgba(255,255,255,0.4);margin-top:4px">Chạy local trên 1 GPU 24GB</div>
        </div>
      </div>
    </div>
    ${watermark}
  </body></html>`);
  await p.screenshot({path:OUT+'/03_comparison.png'}); await p.close();
  console.log('3. Comparison (emerald) ✅');

  // ===== 4. STATS (1080x1080) — Theme: sunset =====
  const t4 = themes.sunset;
  p = await browser.newPage(); await p.setViewport({width:1080,height:1080});
  const stats = [{l:'Parameters',v:'27B',i:'⚡',c:'#F97316'},{l:'Teacher',v:'Opus',i:'🧠',c:'#8B5CF6'},{l:'Context',v:'128K',i:'📏',c:'#06B6D4'},{l:'Downloads',v:'353K',i:'📥',c:'#10B981'},{l:'Likes',v:'1.9K',i:'❤️',c:'#EF4444'},{l:'Base',v:'Qwen3.5',i:'🏗️',c:'#F59E0B'}];
  await p.setContent(`<html><head><style>${base}</style></head><body style="${makeBg(1080,1080,t4)}">
    ${dots}${orb(-40,350,400,t4.accent,0.2)}${orb(650,100,300,t4.accent2,0.15)}
    <div style="position:relative;z-index:1;padding:72px;height:100%;display:flex;flex-direction:column;justify-content:center">
      <div style="text-align:center;margin-bottom:48px">
        <div style="font-size:13px;color:${t4.accent};font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:16px">✦ THÔNG SỐ KỸ THUẬT ✦</div>
        <div style="font-size:56px;font-weight:900;color:#fff;letter-spacing:-0.03em">${M.short}</div>
        <div style="width:80px;height:3px;background:linear-gradient(90deg,${t4.accent},${t4.accent2});border-radius:2px;margin:24px auto"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${stats.map(s=>`<div style="${glass('padding:28px;text-align:center')}">
          <div style="font-size:40px;margin-bottom:10px;filter:drop-shadow(0 0 10px ${s.c}55)">${s.i}</div>
          <div class="mono" style="font-size:40px;font-weight:900;color:#fff;text-shadow:0 0 20px ${s.c}44">${s.v}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.35);margin-top:8px;letter-spacing:0.1em;text-transform:uppercase">${s.l}</div>
        </div>`).join('')}
      </div>
    </div>
    ${watermark}
  </body></html>`);
  await p.screenshot({path:OUT+'/04_stats.png'}); await p.close();
  console.log('4. Stats (sunset) ✅');

  // ===== 5. CODE SNIPPET (1200x800) — Theme: ocean =====
  const t5 = themes.ocean;
  p = await browser.newPage(); await p.setViewport({width:1200,height:800});
  await p.setContent(`<html><head><style>${base}</style></head><body style="background:${t5.bg};width:1200px;height:800px;padding:48px;position:relative;overflow:hidden">
    ${dots}${orb(-30,850,280,t5.accent,0.15)}${orb(500,-30,220,t5.accent2,0.1)}
    <div style="position:relative;z-index:1;${glass('overflow:hidden')}">
      <div style="display:flex;align-items:center;gap:8px;padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.05)">
        <div style="width:12px;height:12px;border-radius:50%;background:#f38ba8"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:#a6e3a1"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:#f9e2af"></div>
        <span style="margin-left:16px;font-size:14px;color:rgba(255,255,255,0.3)">qwen_distilled.py</span>
        <span style="margin-left:auto;font-size:12px;color:rgba(255,255,255,0.2);letter-spacing:0.12em;text-transform:uppercase">Python</span>
      </div>
      <div class="mono" style="padding:28px 32px;font-size:21px;line-height:1.85;color:#cdd6f4">
        <div><span style="color:#cba6f7">from</span> <span style="color:#89b4fa">transformers</span> <span style="color:#cba6f7">import</span> <span style="color:#a6e3a1">AutoModelForCausalLM</span></div>
        <div><span style="color:#cba6f7">from</span> <span style="color:#89b4fa">transformers</span> <span style="color:#cba6f7">import</span> <span style="color:#a6e3a1">AutoTokenizer</span></div>
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
    ${watermark}
  </body></html>`);
  await p.screenshot({path:OUT+'/05_code_snippet.png'}); await p.close();
  console.log('5. Code Snippet (ocean) ✅');

  // ===== 6. THUMBNAIL (1280x720) — Theme: sunset =====
  p = await browser.newPage(); await p.setViewport({width:1280,height:720});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${makeBg(1280,720,t4)}">
    ${dots}${orb(-80,850,500,t4.accent,0.35)}${orb(350,-60,350,t4.accent2,0.3)}
    <div style="position:relative;z-index:1;padding:56px 64px;height:100%;display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <span style="background:linear-gradient(135deg,${t4.accent},#EF4444);color:#fff;padding:10px 24px;border-radius:24px;font-size:20px;font-weight:800;box-shadow:0 4px 16px ${t4.accent}55">🔥 #1 TRENDING</span>
      </div>
      <div>
        <div style="font-size:96px;font-weight:900;color:#fff;line-height:1.0;letter-spacing:-0.04em;text-shadow:0 4px 30px rgba(0,0,0,0.5)">Qwen3.5</div>
        <div style="font-size:72px;font-weight:900;letter-spacing:-0.03em;background:linear-gradient(90deg,${t4.accent},#EF4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Distilled</div>
        <div style="font-size:36px;color:rgba(255,255,255,0.55);margin-top:4px;font-weight:300">Claude Opus → 27B Local</div>
      </div>
      <div style="display:flex;gap:12px">
        ${[{v:'📥 353K',c:'#10B981'},{v:'❤️ 1.9K',c:'#EF4444'},{v:'⚡ 27B',c:'#F59E0B'}].map(s=>`<span style="${glass(`padding:10px 20px;border-radius:14px;font-size:22px;color:${s.c};font-weight:700`)}">${s.v}</span>`).join('')}
      </div>
    </div>
    ${watermark}
  </body></html>`);
  await p.screenshot({path:OUT+'/06_thumbnail.png'}); await p.close();
  console.log('6. Thumbnail (sunset) ✅');

  // ===== 7. CHECKLIST (1080x1350) — Theme: ocean =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1350});
  const checks = [{t:'Reasoning mạnh ngang Opus',d:true},{t:'Chạy local 1 GPU (24GB)',d:true},{t:'128K context window',d:true},{t:'Open-source HuggingFace',d:true},{t:'353K downloads tuần đầu',d:true},{t:'Hỗ trợ tiếng Việt tốt',d:false},{t:'Production-ready',d:false}];
  await p.setContent(`<html><head><style>${base}</style></head><body style="${makeBg(1080,1350,t5)}">
    ${dots}${orb(850,650,350,t5.accent,0.2)}${orb(-30,-30,250,t5.accent2,0.15)}
    <div style="position:relative;z-index:1;padding:80px 64px">
      <div style="margin-bottom:48px">
        <div style="font-size:13px;color:${t5.accent};font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:16px">✦ CHECKLIST ✦</div>
        <div style="font-size:52px;font-weight:900;color:#fff;letter-spacing:-0.03em">Qwen3.5 Distilled</div>
        <div style="font-size:24px;color:rgba(255,255,255,0.4);margin-top:8px;font-weight:300">Có đáng thử không?</div>
        <div style="width:56px;height:3px;background:linear-gradient(90deg,${t5.accent},${t5.accent2});border-radius:2px;margin-top:24px"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${checks.map(c=>`<div style="${glass(`display:flex;align-items:center;gap:18px;padding:22px 28px;${c.d?`border-color:${t5.accent}15`:'opacity:0.5'}`)}">
          <div style="width:44px;height:44px;border-radius:22px;background:${c.d?`linear-gradient(135deg,${t5.accent},${t5.accent2})`:'rgba(255,255,255,0.06)'};display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;font-weight:700;flex-shrink:0;${c.d?`box-shadow:0 3px 12px ${t5.accent}33`:''}">${c.d?'✓':'?'}</div>
          <span style="font-size:28px;color:${c.d?'#fff':'rgba(255,255,255,0.35)'};font-weight:${c.d?500:300}">${c.t}</span>
        </div>`).join('')}
      </div>
      <div style="margin-top:40px;text-align:center">
        <span class="mono" style="font-size:56px;font-weight:900;background:linear-gradient(90deg,${t5.accent},${t5.accent2});-webkit-background-clip:text;-webkit-text-fill-color:transparent">5/7</span>
        <span style="font-size:28px;color:rgba(255,255,255,0.5);margin-left:12px;font-weight:300">Đáng thử! 🚀</span>
      </div>
    </div>
    ${watermark}
  </body></html>`);
  await p.screenshot({path:OUT+'/07_checklist.png'}); await p.close();
  console.log('7. Checklist (ocean) ✅');

  // ===== 8. INFOGRAPHIC (1080x2400) — Theme: violet =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:2400});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${makeBg(1080,2400,t1)}">
    ${dots}${orb(-30,300,450,t1.accent,0.25)}${orb(700,600,350,t1.accent2,0.15)}${orb(1500,-30,300,'#EC4899',0.12)}${orb(2000,650,280,'#10B981',0.1)}
    <div style="position:relative;z-index:1;padding:80px 64px">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:64px">
        <div style="font-size:12px;color:rgba(255,255,255,0.3);letter-spacing:6px;text-transform:uppercase;margin-bottom:20px">${B}</div>
        <div style="font-size:60px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-0.03em">Qwen3.5-27B</div>
        <div style="font-size:48px;font-weight:900;letter-spacing:-0.02em;background:linear-gradient(90deg,${t1.accent},#EC4899,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:4px">Claude Opus Distilled</div>
        <div style="font-size:20px;color:rgba(255,255,255,0.35);margin-top:16px;font-weight:300">#1 Trending HuggingFace · Tháng 4/2026</div>
        <div style="width:120px;height:3px;background:linear-gradient(90deg,${t1.accent},${t1.accent2});border-radius:2px;margin:28px auto"></div>
      </div>

      <!-- 01 -->
      <div style="margin-bottom:56px">
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:20px">
          <span class="mono" style="font-size:44px;font-weight:900;color:${t1.accent}33">01</span>
          <span style="font-size:13px;color:#F59E0B;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">✦ TẠI SAO HOT? ✦</span>
        </div>
        <div style="${glass('padding:32px')}">
          <div style="font-size:24px;color:rgba(255,255,255,0.75);line-height:1.7">Chưng cất kiến thức từ <span style="color:${t1.accent2};font-weight:700">Claude 4.6 Opus</span> vào <span style="color:#22d3ee;font-weight:700">Qwen3.5 27B</span>. Kết quả: reasoning gần bằng Opus nhưng chạy local trên 1 GPU.</div>
        </div>
      </div>

      <!-- 02 -->
      <div style="margin-bottom:56px">
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:20px">
          <span class="mono" style="font-size:44px;font-weight:900;color:#10B98133">02</span>
          <span style="font-size:13px;color:#10B981;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">✦ THÔNG SỐ ✦</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
          ${[{l:'Params',v:'27B',c:'#F97316'},{l:'Teacher',v:'Opus',c:'#8B5CF6'},{l:'Context',v:'128K',c:'#06B6D4'},{l:'Downloads',v:'353K',c:'#10B981'}].map(s=>`<div style="${glass('padding:24px;text-align:center')}"><div class="mono" style="font-size:32px;font-weight:900;color:${s.c};text-shadow:0 0 16px ${s.c}33">${s.v}</div><div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:6px;letter-spacing:0.1em;text-transform:uppercase">${s.l}</div></div>`).join('')}
        </div>
      </div>

      <!-- 03 -->
      <div style="margin-bottom:56px">
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:20px">
          <span class="mono" style="font-size:44px;font-weight:900;color:#EC489933">03</span>
          <span style="font-size:13px;color:#EC4899;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">✦ BENCHMARK ✦</span>
        </div>
        <div style="${glass('padding:32px')}">
          ${M.comp.map(c=>bar(c.n,c.s,100,c.c,c.s>=85)).join('')}
        </div>
      </div>

      <!-- 04 -->
      <div style="margin-bottom:56px">
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:20px">
          <span class="mono" style="font-size:44px;font-weight:900;color:#06B6D433">04</span>
          <span style="font-size:13px;color:#06B6D4;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">✦ ĐÁNH GIÁ ✦</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div style="${glass('padding:28px;border-color:rgba(16,185,129,0.12)')}">
            <div style="font-size:22px;color:#10B981;font-weight:700;margin-bottom:14px">✅ Ưu điểm</div>
            <div style="font-size:20px;color:rgba(255,255,255,0.6);line-height:1.9">• Reasoning gần Opus<br>• Chạy local 1 GPU<br>• Open-source<br>• 128K context</div>
          </div>
          <div style="${glass('padding:28px;border-color:rgba(239,68,68,0.12)')}">
            <div style="font-size:22px;color:#EF4444;font-weight:700;margin-bottom:14px">⚠️ Lưu ý</div>
            <div style="font-size:20px;color:rgba(255,255,255,0.6);line-height:1.9">• Cần GPU 24GB+<br>• Distilled ≠ Original<br>• Chưa production<br>• Community model</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;margin-top:48px">
        <div style="display:inline-block;background:linear-gradient(135deg,${t1.accent},#06B6D4);border-radius:40px;padding:16px 48px;box-shadow:0 6px 24px ${t1.accent}44">
          <span style="font-size:28px;font-weight:900;color:#fff;letter-spacing:0.03em">${B}</span>
        </div>
        <div style="font-size:16px;color:rgba(255,255,255,0.25);margin-top:16px;letter-spacing:0.06em">Follow để cập nhật tin tức AI mới nhất</div>
      </div>
    </div>
    ${watermark}
  </body></html>`);
  await p.screenshot({path:OUT+'/08_infographic.png'}); await p.close();
  console.log('8. Infographic (violet) ✅');

  await browser.close();
  console.log('\n✅ All 8 V4 → C:/tmp/design-samples-v4/');
}

render().catch(e => console.error('Error:', e.message));
