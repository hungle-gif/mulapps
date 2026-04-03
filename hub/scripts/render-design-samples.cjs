const puppeteer = require('puppeteer');

const M = {
  name: 'Qwen3.5-27B Claude Opus Distilled',
  short: 'Qwen3.5-27B',
  downloads: '353K', likes: '1,950', params: '27B',
  desc: 'Chưng cất kiến thức từ Claude Opus vào Qwen3.5 27B — reasoning mạnh ngang Opus nhưng chạy local được',
  comparison: [
    { name: 'Qwen3.5-27B (gốc)', score: 72, color: '#6B7280' },
    { name: 'GPT-4o mini', score: 78, color: '#6B7280' },
    { name: 'Claude Sonnet', score: 82, color: '#6B7280' },
    { name: 'Qwen3.5 Distilled', score: 89, color: '#10B981' },
    { name: 'Claude Opus (teacher)', score: 95, color: '#8B5CF6' },
  ]
};
const B = 'tintucai.vn';
const BBar = `<div style="position:absolute;bottom:0;left:0;right:0;height:50px;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;color:rgba(255,255,255,0.5);font-family:Segoe UI;letter-spacing:3px">${B}</div>`;
const OUT = 'C:/tmp/design-samples';

const orb = (top, left, size, color) => `<div style="position:absolute;top:${top}px;left:${left}px;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,${color} 0%,transparent 70%);opacity:0.2;filter:blur(${size*0.3}px)"></div>`;

async function render() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  // 1. BLOG FEATURED (1200x630)
  let p = await browser.newPage();
  await p.setViewport({ width: 1200, height: 630 });
  await p.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);font-family:Segoe UI;position:relative;overflow:hidden">
    ${orb(-100, 800, 400, '#7C3AED')}${orb(400, -50, 300, '#06B6D4')}
    <div style="padding:60px 70px;position:relative;z-index:1">
      <div style="display:flex;gap:12px;margin-bottom:24px">
        <span style="background:#7C3AED;color:#fff;padding:8px 20px;border-radius:20px;font-size:16px;font-weight:600">🔥 TRENDING #1</span>
        <span style="background:rgba(255,255,255,0.1);color:#fff;padding:8px 20px;border-radius:20px;font-size:16px;border:1px solid rgba(255,255,255,0.2)">HuggingFace</span>
      </div>
      <div style="font-size:52px;font-weight:900;color:#fff;line-height:1.15;text-shadow:0 0 40px rgba(124,58,237,0.5)">${M.short}</div>
      <div style="font-size:26px;color:#c4b5fd;margin-top:8px;font-weight:300">${M.desc}</div>
      <div style="display:flex;gap:20px;margin-top:30px">
        ${[{v:M.downloads,l:'Downloads',c:'#10B981'},{v:M.likes,l:'Likes',c:'#EF4444'},{v:M.params,l:'Params',c:'#F59E0B'}].map(s=>`<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px 24px;text-align:center"><div style="font-size:32px;font-weight:900;color:${s.c}">${s.v}</div><div style="font-size:14px;color:rgba(255,255,255,0.5)">${s.l}</div></div>`).join('')}
      </div>
    </div>${BBar}</body></html>`);
  await p.screenshot({ path: OUT+'/01_blog_featured_1200x630.png' }); await p.close();
  console.log('1. Blog Featured ✅');

  // 2. QUOTE CARD (1080x1080)
  p = await browser.newPage(); await p.setViewport({width:1080,height:1080});
  await p.setContent(`<html><body style="margin:0;width:1080px;height:1080px;background:linear-gradient(180deg,#0a0a1a,#1a1a2e);font-family:Segoe UI;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
    ${orb(100,-100,400,'#EC4899')}${orb(700,700,350,'#7C3AED')}
    <div style="text-align:center;padding:80px;position:relative;z-index:1">
      <div style="font-size:120px;margin-bottom:20px">💡</div>
      <div style="font-size:42px;color:#fff;font-weight:300;line-height:1.5;font-style:italic">"Chưng cất kiến thức từ Claude Opus vào model 27B — reasoning mạnh ngang hàng nhưng chạy local được"</div>
      <div style="width:80px;height:4px;background:linear-gradient(90deg,#7C3AED,#EC4899);border-radius:2px;margin:40px auto"></div>
      <div style="font-size:24px;color:#a78bfa">${M.name}</div>
      <div style="font-size:20px;color:rgba(255,255,255,0.4);margin-top:8px">353K downloads trong tuần đầu tiên</div>
    </div>${BBar}</body></html>`);
  await p.screenshot({ path: OUT+'/02_quote_card_1080x1080.png' }); await p.close();
  console.log('2. Quote Card ✅');

  // 3. COMPARISON (1080x1350)
  p = await browser.newPage(); await p.setViewport({width:1080,height:1350});
  const bars = M.comparison.map(c=>`<div style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:26px;color:${c.score>=85?'#fff':'rgba(255,255,255,0.5)'};font-weight:${c.score>=85?700:400}">${c.name}</span><span style="font-size:26px;color:${c.color};font-weight:700;font-family:Cascadia Code,monospace">${c.score}%</span></div><div style="width:100%;height:30px;border-radius:15px;background:rgba(255,255,255,0.06);overflow:hidden"><div style="width:${c.score}%;height:100%;border-radius:15px;background:${c.score>=85?'linear-gradient(90deg,'+c.color+','+c.color+'cc)':c.color+'55'};box-shadow:${c.score>=85?'0 0 20px '+c.color+'44':'none'}"></div></div></div>`).join('');
  await p.setContent(`<html><body style="margin:0;width:1080px;height:1350px;background:linear-gradient(180deg,#0d1b2a,#1b2838);font-family:Segoe UI;position:relative;overflow:hidden">
    ${orb(200,700,400,'#10B981')}
    <div style="padding:70px 60px;position:relative;z-index:1">
      <div style="font-size:20px;color:#10B981;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin-bottom:12px">✦ Benchmark ✦</div>
      <div style="font-size:48px;color:#fff;font-weight:900">Qwen3.5 Distilled vs Đối Thủ</div>
      <div style="width:80px;height:4px;background:linear-gradient(90deg,#10B981,#06B6D4);border-radius:2px;margin:20px 0 50px"></div>
      <div style="font-size:28px;color:#F59E0B;font-weight:700;margin-bottom:24px">🎯 Reasoning Benchmark</div>
      ${bars}
      <div style="margin-top:40px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:24px 30px;display:flex;align-items:center;gap:16px">
        <span style="font-size:40px">🏆</span>
        <div><div style="font-size:26px;color:#10B981;font-weight:700">89% — Gần bằng Claude Opus</div><div style="font-size:20px;color:rgba(255,255,255,0.5)">Nhưng chạy local trên GPU 24GB</div></div>
      </div>
    </div>${BBar}</body></html>`);
  await p.screenshot({ path: OUT+'/03_comparison_1080x1350.png' }); await p.close();
  console.log('3. Comparison Card ✅');

  // 4. STATS (1080x1080)
  p = await browser.newPage(); await p.setViewport({width:1080,height:1080});
  const stats = [{l:'Parameters',v:'27B',i:'⚡',c:'#F97316'},{l:'Teacher',v:'Claude Opus',i:'🧠',c:'#8B5CF6'},{l:'Context',v:'128K',i:'📏',c:'#06B6D4'},{l:'Downloads',v:'353K',i:'📥',c:'#10B981'},{l:'Likes',v:'1,950',i:'❤️',c:'#EF4444'},{l:'Base',v:'Qwen3.5',i:'🏗️',c:'#F59E0B'}];
  await p.setContent(`<html><body style="margin:0;width:1080px;height:1080px;background:linear-gradient(135deg,#0f0c29,#302b63);font-family:Segoe UI;position:relative;overflow:hidden">
    ${orb(-50,300,500,'#F59E0B')}
    <div style="padding:70px;position:relative;z-index:1">
      <div style="text-align:center;margin-bottom:50px">
        <div style="font-size:20px;color:#F59E0B;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin-bottom:12px">✦ Thông số ✦</div>
        <div style="font-size:48px;color:#fff;font-weight:900">${M.short}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center">
        ${stats.map(s=>`<div style="width:290px;background:rgba(255,255,255,0.04);border:1.5px solid ${s.c}33;border-radius:24px;padding:28px;text-align:center"><div style="font-size:40px;margin-bottom:8px">${s.i}</div><div style="font-size:38px;font-weight:900;color:#fff;font-family:Cascadia Code,monospace">${s.v}</div><div style="font-size:16px;color:rgba(255,255,255,0.4);margin-top:6px;text-transform:uppercase;letter-spacing:2px">${s.l}</div></div>`).join('')}
      </div>
    </div>${BBar}</body></html>`);
  await p.screenshot({ path: OUT+'/04_stats_1080x1080.png' }); await p.close();
  console.log('4. Stats Highlight ✅');

  // 5. CODE SNIPPET (1200x800)
  p = await browser.newPage(); await p.setViewport({width:1200,height:800});
  await p.setContent(`<html><body style="margin:0;width:1200px;height:800px;background:#1e1e2e;font-family:Segoe UI;padding:50px;position:relative;overflow:hidden">
    ${orb(-50,900,300,'#7C3AED')}
    <div style="background:#11111b;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;z-index:1">
      <div style="display:flex;align-items:center;gap:8px;padding:16px 24px;background:#181825">
        <div style="width:14px;height:14px;border-radius:50%;background:#f38ba8"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#a6e3a1"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#f9e2af"></div>
        <span style="margin-left:auto;font-size:14px;color:rgba(255,255,255,0.3);font-family:monospace">python</span>
      </div>
      <div style="padding:30px 32px;font-family:Cascadia Code,Consolas,monospace;font-size:22px;line-height:1.8">
        <div><span style="color:#cba6f7">from</span> <span style="color:#89b4fa">transformers</span> <span style="color:#cba6f7">import</span> <span style="color:#a6e3a1">AutoModelForCausalLM</span></div>
        <div><span style="color:#cba6f7">from</span> <span style="color:#89b4fa">transformers</span> <span style="color:#cba6f7">import</span> <span style="color:#a6e3a1">AutoTokenizer</span></div>
        <div style="color:#585b70">&nbsp;</div>
        <div><span style="color:#585b70"># Load Qwen3.5 Distilled from Claude Opus</span></div>
        <div><span style="color:#cdd6f4">model_id</span> <span style="color:#89dceb">=</span> <span style="color:#a6e3a1">"Jackrong/Qwen3.5-27B-Claude-4.6-Opus"</span></div>
        <div><span style="color:#cdd6f4">tokenizer</span> <span style="color:#89dceb">=</span> <span style="color:#89b4fa">AutoTokenizer</span>.<span style="color:#f9e2af">from_pretrained</span>(<span style="color:#cdd6f4">model_id</span>)</div>
        <div><span style="color:#cdd6f4">model</span> <span style="color:#89dceb">=</span> <span style="color:#89b4fa">AutoModelForCausalLM</span>.<span style="color:#f9e2af">from_pretrained</span>(</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#cdd6f4">model_id</span>,</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#cdd6f4">device_map</span><span style="color:#89dceb">=</span><span style="color:#a6e3a1">"auto"</span>,</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#cdd6f4">torch_dtype</span><span style="color:#89dceb">=</span><span style="color:#a6e3a1">"auto"</span></div>
        <div>)</div>
        <div style="color:#585b70">&nbsp;</div>
        <div><span style="color:#585b70"># 🔥 Reasoning ngang Claude Opus, chạy trên 1 GPU</span></div>
      </div>
    </div>
    <div style="position:absolute;bottom:20px;right:30px;font-size:16px;color:rgba(255,255,255,0.3);letter-spacing:2px">${B}</div>
  </body></html>`);
  await p.screenshot({ path: OUT+'/05_code_snippet_1200x800.png' }); await p.close();
  console.log('5. Code Snippet ✅');

  // 6. THUMBNAIL (1280x720)
  p = await browser.newPage(); await p.setViewport({width:1280,height:720});
  await p.setContent(`<html><body style="margin:0;width:1280px;height:720px;background:linear-gradient(135deg,#0f0c29,#302b63);font-family:Segoe UI;position:relative;overflow:hidden">
    ${orb(-100,900,500,'#EF4444')}${orb(500,-50,400,'#7C3AED')}
    <div style="padding:60px 70px;position:relative;z-index:1;display:flex;flex-direction:column;height:100%;box-sizing:border-box">
      <div style="display:flex;gap:12px;margin-bottom:20px">
        <span style="background:#EF4444;color:#fff;padding:10px 24px;border-radius:24px;font-size:22px;font-weight:800">🔥 #1 TRENDING</span>
        <span style="background:rgba(255,255,255,0.1);color:#fff;padding:10px 24px;border-radius:24px;font-size:22px;font-weight:600;border:1px solid rgba(255,255,255,0.2)">HuggingFace</span>
      </div>
      <div style="flex:1;display:flex;align-items:center">
        <div>
          <div style="font-size:72px;font-weight:900;color:#fff;line-height:1.1;text-shadow:0 4px 30px rgba(0,0,0,0.5)">Qwen3.5 <span style="background:linear-gradient(90deg,#F97316,#EF4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Distilled</span></div>
          <div style="font-size:40px;color:rgba(255,255,255,0.7);margin-top:10px">Claude Opus → Model 27B Local</div>
        </div>
      </div>
      <div style="display:flex;gap:20px">
        <span style="font-size:28px;color:#10B981;font-weight:700">📥 353K</span>
        <span style="font-size:28px;color:#EF4444;font-weight:700">❤️ 1,950</span>
        <span style="font-size:28px;color:#F59E0B;font-weight:700">⚡ 27B params</span>
      </div>
    </div>
    <div style="position:absolute;bottom:15px;right:30px;font-size:18px;color:rgba(255,255,255,0.3);letter-spacing:2px">${B}</div>
  </body></html>`);
  await p.screenshot({ path: OUT+'/06_thumbnail_1280x720.png' }); await p.close();
  console.log('6. Thumbnail ✅');

  // 7. CHECKLIST (1080x1350)
  p = await browser.newPage(); await p.setViewport({width:1080,height:1350});
  const checks = [
    {t:'Reasoning mạnh ngang Claude Opus',d:true},{t:'Chạy local trên 1 GPU (24GB)',d:true},
    {t:'128K context window',d:true},{t:'Open-source trên HuggingFace',d:true},
    {t:'353K downloads tuần đầu',d:true},{t:'Hỗ trợ tiếng Việt tốt',d:false},{t:'Production-ready',d:false}
  ];
  await p.setContent(`<html><body style="margin:0;width:1080px;height:1350px;background:linear-gradient(180deg,#0a192f,#172a45);font-family:Segoe UI;position:relative;overflow:hidden">
    ${orb(900,700,400,'#06B6D4')}
    <div style="padding:70px 60px;position:relative;z-index:1">
      <div style="font-size:20px;color:#06B6D4;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin-bottom:12px">✦ Checklist ✦</div>
      <div style="font-size:48px;color:#fff;font-weight:900">Qwen3.5 Distilled</div>
      <div style="font-size:24px;color:rgba(255,255,255,0.5);margin-top:8px">Có đáng thử không?</div>
      <div style="width:80px;height:4px;background:linear-gradient(90deg,#06B6D4,#10B981);border-radius:2px;margin:30px 0 40px"></div>
      ${checks.map(c=>`<div style="display:flex;align-items:center;gap:20px;margin-bottom:18px;background:rgba(255,255,255,${c.d?'0.04':'0.02'});border-radius:18px;padding:22px 28px;border:1px solid rgba(255,255,255,${c.d?'0.08':'0.04'})"><div style="width:44px;height:44px;border-radius:22px;background:${c.d?'#10B981':'rgba(255,255,255,0.1)'};display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;font-weight:700;flex-shrink:0">${c.d?'✓':'?'}</div><span style="font-size:28px;color:${c.d?'#fff':'rgba(255,255,255,0.4)'};font-weight:${c.d?'500':'400'}">${c.t}</span></div>`).join('')}
      <div style="margin-top:30px;text-align:center;font-size:28px;color:#10B981;font-weight:700">5/7 — Đáng thử! 🚀</div>
    </div>${BBar}</body></html>`);
  await p.screenshot({ path: OUT+'/07_checklist_1080x1350.png' }); await p.close();
  console.log('7. Checklist ✅');

  // 8. INFOGRAPHIC (1080x2400)
  p = await browser.newPage(); await p.setViewport({width:1080,height:2400});
  await p.setContent(`<html><body style="margin:0;width:1080px;height:2400px;background:linear-gradient(180deg,#0a0a1a 0%,#0d1b2a 30%,#1a0a2e 60%,#0f0c29 100%);font-family:Segoe UI;position:relative;overflow:hidden">
    <div style="padding:70px 60px">
      <div style="text-align:center;margin-bottom:60px">
        <div style="font-size:20px;color:#7C3AED;letter-spacing:6px;text-transform:uppercase;font-weight:700;margin-bottom:16px">TINTUCAI.VN</div>
        <div style="font-size:52px;font-weight:900;color:#fff;line-height:1.2">Qwen3.5-27B<br><span style="background:linear-gradient(90deg,#7C3AED,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Claude Opus Distilled</span></div>
        <div style="font-size:24px;color:rgba(255,255,255,0.5);margin-top:16px">Model #1 Trending trên HuggingFace</div>
        <div style="width:80px;height:4px;background:linear-gradient(90deg,#7C3AED,#06B6D4);border-radius:2px;margin:30px auto"></div>
      </div>
      <div style="font-size:20px;color:#F59E0B;letter-spacing:4px;text-transform:uppercase;font-weight:700;margin-bottom:20px">✦ TẠI SAO HOT? ✦</div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:36px;margin-bottom:40px">
        <div style="font-size:26px;color:#e2e8f0;line-height:1.7">Chưng cất kiến thức từ <span style="color:#8B5CF6;font-weight:700">Claude 4.6 Opus</span> — model mạnh nhất của Anthropic — vào kiến trúc <span style="color:#06B6D4;font-weight:700">Qwen3.5 27B</span>. Kết quả: reasoning gần bằng Opus nhưng chạy local trên 1 GPU.</div>
      </div>
      <div style="font-size:20px;color:#10B981;letter-spacing:4px;text-transform:uppercase;font-weight:700;margin-bottom:20px">✦ THÔNG SỐ ✦</div>
      <div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:40px">
        ${[{l:'Parameters',v:'27B',c:'#F97316'},{l:'Teacher',v:'Opus',c:'#8B5CF6'},{l:'Context',v:'128K',c:'#06B6D4'},{l:'Downloads',v:'353K',c:'#10B981'}].map(s=>`<div style="flex:1;min-width:200px;background:rgba(255,255,255,0.04);border:1px solid ${s.c}33;border-radius:20px;padding:24px;text-align:center"><div style="font-size:34px;font-weight:900;color:${s.c};font-family:monospace">${s.v}</div><div style="font-size:16px;color:rgba(255,255,255,0.4);margin-top:6px;text-transform:uppercase;letter-spacing:2px">${s.l}</div></div>`).join('')}
      </div>
      <div style="font-size:20px;color:#EC4899;letter-spacing:4px;text-transform:uppercase;font-weight:700;margin-bottom:20px">✦ SO SÁNH ✦</div>
      ${M.comparison.map(c=>`<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:22px;color:${c.score>=85?'#fff':'rgba(255,255,255,0.5)'};font-weight:${c.score>=85?700:400}">${c.name}</span><span style="font-size:22px;color:${c.color};font-weight:700;font-family:monospace">${c.score}%</span></div><div style="width:100%;height:24px;border-radius:12px;background:rgba(255,255,255,0.06);overflow:hidden"><div style="width:${c.score}%;height:100%;border-radius:12px;background:${c.score>=85?'linear-gradient(90deg,'+c.color+','+c.color+'cc)':c.color+'55'}"></div></div></div>`).join('')}
      <div style="margin-top:50px;font-size:20px;color:#06B6D4;letter-spacing:4px;text-transform:uppercase;font-weight:700;margin-bottom:20px">✦ ĐÁNH GIÁ ✦</div>
      <div style="display:flex;gap:20px">
        <div style="flex:1;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:28px">
          <div style="font-size:24px;color:#10B981;font-weight:700;margin-bottom:12px">✅ Ưu điểm</div>
          <div style="font-size:20px;color:rgba(255,255,255,0.7);line-height:1.8">• Reasoning gần Opus<br>• Chạy local 1 GPU<br>• Open-source<br>• 128K context</div>
        </div>
        <div style="flex:1;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:20px;padding:28px">
          <div style="font-size:24px;color:#EF4444;font-weight:700;margin-bottom:12px">⚠️ Lưu ý</div>
          <div style="font-size:20px;color:rgba(255,255,255,0.7);line-height:1.8">• Cần GPU 24GB+<br>• Distilled ≠ Original<br>• Chưa test production<br>• Community model</div>
        </div>
      </div>
      <div style="margin-top:50px;text-align:center">
        <div style="background:linear-gradient(135deg,#7C3AED,#06B6D4);border-radius:50px;padding:20px 50px;display:inline-block;box-shadow:0 8px 30px rgba(124,58,237,0.4)">
          <span style="font-size:32px;font-weight:900;color:#fff">${B}</span>
        </div>
        <div style="font-size:18px;color:rgba(255,255,255,0.4);margin-top:16px">Follow để cập nhật tin tức AI mới nhất</div>
      </div>
    </div>
  </body></html>`);
  await p.screenshot({ path: OUT+'/08_infographic_1080x2400.png' }); await p.close();
  console.log('8. Infographic ✅');

  await browser.close();
  console.log('\n✅ All 8 images → C:/tmp/design-samples/');
}

render().catch(e => console.error('Error:', e.message));
