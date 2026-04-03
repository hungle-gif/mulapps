const puppeteer = require('puppeteer');
const OUT = 'C:/tmp/design-samples-v2';
const B = 'tintucai.vn';

// Shared premium CSS
const base = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; overflow:hidden; position:relative; }
  .mono { font-family: 'Cascadia Code','Consolas',monospace; }
`;

// Aurora mesh gradient background
const aurora = (w, h) => `
  background:
    radial-gradient(ellipse at 20% 30%, rgba(124,58,237,0.5) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(6,182,212,0.4) 0%, transparent 50%),
    radial-gradient(ellipse at 60% 80%, rgba(236,72,153,0.3) 0%, transparent 50%),
    radial-gradient(ellipse at 30% 70%, rgba(16,185,129,0.2) 0%, transparent 50%),
    linear-gradient(180deg, #08081a 0%, #0f0f2a 100%);
  width:${w}px; height:${h}px;
`;

// Dot grid overlay
const dots = `background-image:radial-gradient(circle,rgba(255,255,255,0.08) 1px,transparent 1px);background-size:24px 24px;position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:0;`;

// Glass card
const glass = (extra='') => `background:rgba(255,255,255,0.04);backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);border:1px solid rgba(255,255,255,0.1);border-radius:24px;box-shadow:0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.06);${extra}`;

// Orb decoration
const orb = (top, left, size, color, opacity=0.25) => `<div style="position:absolute;top:${top}px;left:${left}px;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,${color} 0%,transparent 70%);opacity:${opacity};filter:blur(${Math.round(size*0.3)}px);pointer-events:none"></div>`;

// Corner bracket decoration
const bracket = (pos) => {
  const styles = {
    tl: 'top:20px;left:20px;border-top:2px solid rgba(255,255,255,0.15);border-left:2px solid rgba(255,255,255,0.15)',
    tr: 'top:20px;right:20px;border-top:2px solid rgba(255,255,255,0.15);border-right:2px solid rgba(255,255,255,0.15)',
    bl: 'bottom:20px;left:20px;border-bottom:2px solid rgba(255,255,255,0.15);border-left:2px solid rgba(255,255,255,0.15)',
    br: 'bottom:20px;right:20px;border-bottom:2px solid rgba(255,255,255,0.15);border-right:2px solid rgba(255,255,255,0.15)'
  };
  return `<div style="position:absolute;${styles[pos]};width:40px;height:40px;pointer-events:none"></div>`;
};

// Gradient line
const gradLine = (w='100px') => `<div style="width:${w};height:3px;background:linear-gradient(90deg,transparent,rgba(124,58,237,0.8),rgba(6,182,212,0.8),transparent);border-radius:2px;margin:20px auto"></div>`;

// Kicker label
const kicker = (text, color='#7C3AED') => `<div style="font-size:14px;color:${color};font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:14px">✦ ${text} ✦</div>`;

// Brand bar
const brandBar = `<div style="position:absolute;bottom:0;left:0;right:0;height:48px;${glass()};border-radius:0;display:flex;align-items:center;justify-content:center;font-size:16px;color:rgba(255,255,255,0.4);letter-spacing:4px;z-index:10">${B}</div>`;

// Stat badge
const statBadge = (v, l, c, icon='') => `<div style="${glass('padding:20px 28px;text-align:center;min-width:140px')};border-color:${c}22"><div style="font-size:16px;margin-bottom:6px">${icon}</div><div class="mono" style="font-size:36px;font-weight:900;color:${c};text-shadow:0 0 20px ${c}44">${v}</div><div style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;letter-spacing:0.08em;text-transform:uppercase">${l}</div></div>`;

// Bar chart
const bar = (label, val, max, color, highlight) => {
  const w = (val/max*100).toFixed(0);
  return `<div style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding:0 4px">
      <span style="font-size:22px;color:${highlight?'#e4e4ed':'rgba(255,255,255,0.45)'};font-weight:${highlight?600:400}">${label}</span>
      <span class="mono" style="font-size:22px;color:${highlight?color:'rgba(255,255,255,0.45)'};font-weight:700">${val}%</span>
    </div>
    <div style="width:100%;height:24px;border-radius:12px;background:rgba(255,255,255,0.04);overflow:hidden">
      <div style="width:${w}%;height:100%;border-radius:12px;background:${highlight?`linear-gradient(90deg,${color},${color}cc)`:color+'33'};${highlight?`box-shadow:0 0 20px ${color}44`:''};transition:width 1s"></div>
    </div>
  </div>`;
};

const M = {
  name: 'Qwen3.5-27B Claude Opus Distilled',
  short: 'Qwen3.5-27B',
  downloads: '353K', likes: '1,950', params: '27B',
  desc: 'Chưng cất kiến thức từ Claude Opus vào Qwen3.5 — reasoning mạnh ngang Opus nhưng chạy local',
  comp: [
    { n: 'Qwen3.5 (gốc)', s: 72, c: '#6B7280' },
    { n: 'GPT-4o mini', s: 78, c: '#6B7280' },
    { n: 'Claude Sonnet', s: 82, c: '#6B7280' },
    { n: 'Qwen3.5 Distilled', s: 89, c: '#10B981' },
    { n: 'Claude Opus', s: 95, c: '#8B5CF6' },
  ]
};

async function render() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--font-render-hinting=none'] });
  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });

  // ===== 1. BLOG FEATURED (1200x630) =====
  let p = await browser.newPage();
  await p.setViewport({ width: 1200, height: 630 });
  await p.setContent(`<html><head><style>${base}</style></head><body style="${aurora(1200,630)}">
    <div style="${dots}"></div>
    ${orb(-80,750,450,'#7C3AED',0.35)}${orb(350,-80,350,'#06B6D4',0.25)}${orb(200,500,200,'#EC4899',0.15)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:55px 65px;height:100%;display:flex;flex-direction:column;justify-content:center">
      <div style="display:flex;gap:10px;margin-bottom:20px">
        <span style="background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;padding:7px 18px;border-radius:20px;font-size:13px;font-weight:700;letter-spacing:0.05em;box-shadow:0 4px 15px rgba(124,58,237,0.4)">🔥 TRENDING #1</span>
        <span style="${glass('padding:7px 18px;border-radius:20px;font-size:13px;color:rgba(255,255,255,0.7)')}">HuggingFace</span>
      </div>
      <div style="font-size:56px;font-weight:900;color:#e4e4ed;line-height:1.05;letter-spacing:-0.03em;text-shadow:0 0 40px rgba(124,58,237,0.4)">
        <span>Qwen3.5</span> <span style="background:linear-gradient(90deg,#7C3AED,#EC4899,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Distilled</span>
      </div>
      <div style="font-size:22px;color:rgba(255,255,255,0.55);margin-top:10px;font-weight:300;letter-spacing:-0.01em">${M.desc}</div>
      ${gradLine('300px')}
      <div style="display:flex;gap:16px;margin-top:8px">
        ${statBadge(M.downloads,'Downloads','#10B981','📥')}
        ${statBadge(M.likes,'Likes','#EF4444','❤️')}
        ${statBadge(M.params,'Parameters','#F59E0B','⚡')}
        ${statBadge('128K','Context','#06B6D4','📏')}
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({ path: OUT+'/01_blog_featured.png' }); await p.close();
  console.log('1. Blog Featured ✅');

  // ===== 2. QUOTE CARD (1080x1080) =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1080});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${aurora(1080,1080)}">
    <div style="${dots}"></div>
    ${orb(50,-80,500,'#EC4899',0.3)}${orb(600,600,400,'#7C3AED',0.25)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:center;height:100%;padding:80px">
      <div style="${glass('padding:60px;text-align:center;max-width:900px')}">
        <div style="font-size:80px;margin-bottom:24px;filter:drop-shadow(0 0 20px rgba(124,58,237,0.5))">💡</div>
        <div style="font-size:38px;color:#e4e4ed;font-weight:300;line-height:1.55;font-style:italic;letter-spacing:-0.01em">
          "Chưng cất kiến thức từ <span style="color:#a78bfa;font-weight:500">Claude Opus</span> vào model 27B — reasoning mạnh ngang hàng nhưng <span style="color:#22d3ee;font-weight:500">chạy local</span> được"
        </div>
        ${gradLine('120px')}
        <div style="font-size:20px;color:rgba(255,255,255,0.6);font-weight:500">${M.name}</div>
        <div style="font-size:15px;color:rgba(255,255,255,0.3);margin-top:8px;letter-spacing:0.05em">353K downloads · Tuần đầu tiên</div>
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({ path: OUT+'/02_quote_card.png' }); await p.close();
  console.log('2. Quote Card ✅');

  // ===== 3. COMPARISON (1080x1350) =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1350});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${aurora(1080,1350)}">
    <div style="${dots}"></div>
    ${orb(100,700,400,'#10B981',0.3)}${orb(800,-50,300,'#8B5CF6',0.2)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:60px 55px">
      <div style="text-align:center;margin-bottom:40px">
        ${kicker('BENCHMARK','#10B981')}
        <div style="font-size:46px;font-weight:900;color:#e4e4ed;letter-spacing:-0.03em;text-shadow:0 0 30px rgba(16,185,129,0.3)">Qwen3.5 Distilled vs Đối Thủ</div>
        ${gradLine('150px')}
      </div>
      <div style="${glass('padding:40px 36px;margin-bottom:24px')}">
        <div style="font-size:18px;color:#F59E0B;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:24px">🎯 Reasoning Score</div>
        ${M.comp.map(c => bar(c.n, c.s, 100, c.c, c.s >= 85)).join('')}
      </div>
      <div style="${glass('padding:24px 30px;display:flex;align-items:center;gap:16px')}">
        <span style="font-size:40px;filter:drop-shadow(0 0 10px rgba(16,185,129,0.5))">🏆</span>
        <div>
          <div style="font-size:22px;color:#10B981;font-weight:700">89% — Gần bằng Claude Opus</div>
          <div style="font-size:16px;color:rgba(255,255,255,0.4)">Nhưng chạy local trên GPU 24GB</div>
        </div>
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({ path: OUT+'/03_comparison.png' }); await p.close();
  console.log('3. Comparison ✅');

  // ===== 4. STATS (1080x1080) =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1080});
  const stats = [{l:'Parameters',v:'27B',i:'⚡',c:'#F97316'},{l:'Teacher',v:'Opus',i:'🧠',c:'#8B5CF6'},{l:'Context',v:'128K',i:'📏',c:'#06B6D4'},{l:'Downloads',v:'353K',i:'📥',c:'#10B981'},{l:'Likes',v:'1.9K',i:'❤️',c:'#EF4444'},{l:'Base',v:'Qwen3.5',i:'🏗️',c:'#F59E0B'}];
  await p.setContent(`<html><head><style>${base}</style></head><body style="${aurora(1080,1080)}">
    <div style="${dots}"></div>
    ${orb(-50,300,500,'#F59E0B',0.2)}${orb(700,100,300,'#7C3AED',0.15)}
    ${bracket('tl')}${bracket('tr')}${bracket('bl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:65px;height:100%;display:flex;flex-direction:column;justify-content:center">
      <div style="text-align:center;margin-bottom:44px">
        ${kicker('THÔNG SỐ','#F59E0B')}
        <div style="font-size:52px;font-weight:900;color:#e4e4ed;letter-spacing:-0.03em">${M.short}</div>
        ${gradLine('100px')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center">
        ${stats.map(s => `<div style="${glass(`width:290px;padding:28px;text-align:center;border-color:${s.c}20`)}">
          <div style="font-size:36px;margin-bottom:8px;filter:drop-shadow(0 0 10px ${s.c}55)">${s.i}</div>
          <div class="mono" style="font-size:40px;font-weight:900;color:#e4e4ed;text-shadow:0 0 25px ${s.c}44">${s.v}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.35);margin-top:8px;letter-spacing:0.1em;text-transform:uppercase">${s.l}</div>
        </div>`).join('')}
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({ path: OUT+'/04_stats.png' }); await p.close();
  console.log('4. Stats ✅');

  // ===== 5. CODE SNIPPET (1200x800) =====
  p = await browser.newPage(); await p.setViewport({width:1200,height:800});
  await p.setContent(`<html><head><style>${base}</style></head><body style="background:#0e0e1a;width:1200px;height:800px;padding:40px;position:relative;overflow:hidden">
    ${orb(-40,850,300,'#7C3AED',0.2)}${orb(500,-50,250,'#06B6D4',0.15)}
    <div style="${dots}"></div>
    <div style="position:relative;z-index:1;${glass('overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.05)')}">
      <div style="display:flex;align-items:center;gap:8px;padding:18px 24px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06)">
        <div style="width:12px;height:12px;border-radius:50%;background:#f38ba8"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:#a6e3a1"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:#f9e2af"></div>
        <span style="margin-left:16px;font-size:13px;color:rgba(255,255,255,0.3);font-family:monospace">qwen_distilled.py</span>
        <span style="margin-left:auto;font-size:12px;color:rgba(255,255,255,0.2);letter-spacing:0.1em">PYTHON</span>
      </div>
      <div style="padding:28px 32px;font-family:'Cascadia Code','Consolas',monospace;font-size:20px;line-height:1.9;color:#cdd6f4">
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
        <div><span style="color:#45475a"># ⚡ Reasoning ngang Claude Opus, chạy trên 1 GPU 24GB</span></div>
      </div>
    </div>
    <div style="position:absolute;bottom:16px;right:28px;font-size:14px;color:rgba(255,255,255,0.2);letter-spacing:3px;z-index:1">${B}</div>
  </body></html>`);
  await p.screenshot({ path: OUT+'/05_code_snippet.png' }); await p.close();
  console.log('5. Code Snippet ✅');

  // ===== 6. THUMBNAIL (1280x720) =====
  p = await browser.newPage(); await p.setViewport({width:1280,height:720});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${aurora(1280,720)}">
    <div style="${dots}"></div>
    ${orb(-80,900,500,'#EF4444',0.35)}${orb(400,-80,400,'#7C3AED',0.3)}${orb(300,600,250,'#06B6D4',0.2)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:50px 60px;height:100%;display:flex;flex-direction:column;justify-content:space-between">
      <div style="display:flex;gap:10px">
        <span style="background:linear-gradient(135deg,#EF4444,#F97316);color:#fff;padding:10px 22px;border-radius:24px;font-size:18px;font-weight:800;letter-spacing:0.03em;box-shadow:0 4px 20px rgba(239,68,68,0.4)">🔥 #1 TRENDING</span>
        <span style="${glass('padding:10px 22px;border-radius:24px;font-size:18px;color:rgba(255,255,255,0.7);font-weight:500')}">HuggingFace</span>
      </div>
      <div>
        <div style="font-size:78px;font-weight:900;color:#e4e4ed;line-height:1.05;letter-spacing:-0.03em;text-shadow:0 4px 30px rgba(0,0,0,0.5)">
          Qwen3.5 <span style="background:linear-gradient(90deg,#F97316,#EF4444,#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Distilled</span>
        </div>
        <div style="font-size:36px;color:rgba(255,255,255,0.6);margin-top:8px;font-weight:300;letter-spacing:-0.01em">Claude Opus → Model 27B chạy Local</div>
      </div>
      <div style="display:flex;gap:16px">
        ${[{v:'📥 353K',c:'#10B981'},{v:'❤️ 1,950',c:'#EF4444'},{v:'⚡ 27B',c:'#F59E0B'}].map(s => `<span style="${glass(`padding:10px 20px;border-radius:16px;font-size:22px;color:${s.c};font-weight:700;border-color:${s.c}22`)}">${s.v}</span>`).join('')}
      </div>
    </div>
    <div style="position:absolute;bottom:12px;right:24px;font-size:16px;color:rgba(255,255,255,0.25);letter-spacing:3px;z-index:1">${B}</div>
  </body></html>`);
  await p.screenshot({ path: OUT+'/06_thumbnail.png' }); await p.close();
  console.log('6. Thumbnail ✅');

  // ===== 7. CHECKLIST (1080x1350) =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:1350});
  const checks = [
    {t:'Reasoning mạnh ngang Claude Opus',d:true},{t:'Chạy local trên 1 GPU (24GB)',d:true},
    {t:'128K context window',d:true},{t:'Open-source trên HuggingFace',d:true},
    {t:'353K downloads tuần đầu',d:true},{t:'Hỗ trợ tiếng Việt tốt',d:false},{t:'Production-ready',d:false}
  ];
  await p.setContent(`<html><head><style>${base}</style></head><body style="${aurora(1080,1350)}">
    <div style="${dots}"></div>
    ${orb(800,650,400,'#06B6D4',0.25)}${orb(-50,-50,300,'#10B981',0.2)}
    ${bracket('tl')}${bracket('br')}
    <div style="position:relative;z-index:1;padding:60px 55px">
      <div style="text-align:center;margin-bottom:40px">
        ${kicker('CHECKLIST','#06B6D4')}
        <div style="font-size:46px;font-weight:900;color:#e4e4ed;letter-spacing:-0.03em">Qwen3.5 Distilled</div>
        <div style="font-size:20px;color:rgba(255,255,255,0.4);margin-top:8px;font-weight:300">Có đáng thử không?</div>
        ${gradLine('100px')}
      </div>
      ${checks.map(c => `<div style="${glass(`display:flex;align-items:center;gap:18px;margin-bottom:14px;padding:20px 24px;border-color:${c.d?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.04)'}`)};opacity:${c.d?1:0.6}">
        <div style="width:40px;height:40px;border-radius:20px;background:${c.d?'linear-gradient(135deg,#10B981,#059669)':'rgba(255,255,255,0.08)'};display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;font-weight:700;flex-shrink:0;${c.d?'box-shadow:0 4px 12px rgba(16,185,129,0.3)':''}">${c.d?'✓':'?'}</div>
        <span style="font-size:24px;color:${c.d?'#e4e4ed':'rgba(255,255,255,0.4)'};font-weight:${c.d?500:300}">${c.t}</span>
      </div>`).join('')}
      <div style="margin-top:28px;text-align:center">
        <span style="font-size:48px;font-weight:900;background:linear-gradient(90deg,#10B981,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">5/7</span>
        <span style="font-size:24px;color:rgba(255,255,255,0.6);margin-left:12px">Đáng thử! 🚀</span>
      </div>
    </div>
    ${brandBar}
  </body></html>`);
  await p.screenshot({ path: OUT+'/07_checklist.png' }); await p.close();
  console.log('7. Checklist ✅');

  // ===== 8. INFOGRAPHIC (1080x2400) =====
  p = await browser.newPage(); await p.setViewport({width:1080,height:2400});
  await p.setContent(`<html><head><style>${base}</style></head><body style="${aurora(1080,2400)}">
    <div style="${dots}"></div>
    ${orb(-50,300,500,'#7C3AED',0.3)}${orb(800,600,400,'#06B6D4',0.2)}${orb(1600,-50,350,'#EC4899',0.2)}${orb(2000,700,300,'#10B981',0.15)}
    <div style="position:relative;z-index:1;padding:65px 55px">
      <div style="text-align:center;margin-bottom:55px">
        <div style="font-size:14px;color:rgba(255,255,255,0.3);letter-spacing:6px;text-transform:uppercase;margin-bottom:16px">${B}</div>
        <div style="font-size:54px;font-weight:900;color:#e4e4ed;line-height:1.15;letter-spacing:-0.03em">Qwen3.5-27B<br><span style="background:linear-gradient(90deg,#7C3AED,#EC4899,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Claude Opus Distilled</span></div>
        <div style="font-size:20px;color:rgba(255,255,255,0.4);margin-top:14px;font-weight:300">Model #1 Trending trên HuggingFace · Tháng 4/2026</div>
        ${gradLine('200px')}
      </div>

      <div style="margin-bottom:40px">
        ${kicker('TẠI SAO HOT?','#F59E0B')}
        <div style="${glass('padding:32px')}">
          <div style="font-size:22px;color:rgba(255,255,255,0.8);line-height:1.7">Chưng cất kiến thức từ <span style="color:#a78bfa;font-weight:600">Claude 4.6 Opus</span> — model mạnh nhất Anthropic — vào kiến trúc <span style="color:#22d3ee;font-weight:600">Qwen3.5 27B</span>. Kết quả: reasoning gần bằng Opus nhưng chạy local trên 1 GPU.</div>
        </div>
      </div>

      <div style="margin-bottom:40px">
        ${kicker('THÔNG SỐ','#10B981')}
        <div style="display:flex;flex-wrap:wrap;gap:16px">
          ${[{l:'Params',v:'27B',c:'#F97316'},{l:'Teacher',v:'Opus',c:'#8B5CF6'},{l:'Context',v:'128K',c:'#06B6D4'},{l:'Downloads',v:'353K',c:'#10B981'}].map(s => `<div style="${glass(`flex:1;min-width:200px;padding:22px;text-align:center;border-color:${s.c}20`)}"><div class="mono" style="font-size:32px;font-weight:900;color:${s.c};text-shadow:0 0 20px ${s.c}33">${s.v}</div><div style="font-size:13px;color:rgba(255,255,255,0.35);margin-top:6px;letter-spacing:0.1em;text-transform:uppercase">${s.l}</div></div>`).join('')}
        </div>
      </div>

      <div style="margin-bottom:40px">
        ${kicker('SO SÁNH BENCHMARK','#EC4899')}
        <div style="${glass('padding:32px')}">
          ${M.comp.map(c => bar(c.n, c.s, 100, c.c, c.s >= 85)).join('')}
        </div>
      </div>

      <div style="margin-bottom:40px">
        ${kicker('ĐÁNH GIÁ','#06B6D4')}
        <div style="display:flex;gap:16px">
          <div style="${glass('flex:1;padding:24px;border-color:rgba(16,185,129,0.2)')}">
            <div style="font-size:20px;color:#10B981;font-weight:700;margin-bottom:12px">✅ Ưu điểm</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.6);line-height:1.8">• Reasoning gần Opus<br>• Chạy local 1 GPU<br>• Open-source<br>• 128K context</div>
          </div>
          <div style="${glass('flex:1;padding:24px;border-color:rgba(239,68,68,0.2)')}">
            <div style="font-size:20px;color:#EF4444;font-weight:700;margin-bottom:12px">⚠️ Lưu ý</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.6);line-height:1.8">• Cần GPU 24GB+<br>• Distilled ≠ Original<br>• Chưa test production<br>• Community model</div>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:50px">
        <div style="background:linear-gradient(135deg,#7C3AED,#EC4899,#06B6D4);border-radius:50px;padding:18px 50px;display:inline-block;box-shadow:0 8px 30px rgba(124,58,237,0.4)">
          <span style="font-size:28px;font-weight:900;color:#fff;letter-spacing:0.02em">${B}</span>
        </div>
        <div style="font-size:16px;color:rgba(255,255,255,0.3);margin-top:14px;letter-spacing:0.05em">Follow để cập nhật tin tức AI mới nhất</div>
      </div>
    </div>
  </body></html>`);
  await p.screenshot({ path: OUT+'/08_infographic.png' }); await p.close();
  console.log('8. Infographic ✅');

  await browser.close();
  console.log('\n✅ All 8 premium images → C:/tmp/design-samples-v2/');
}

render().catch(e => console.error('Error:', e.message));
