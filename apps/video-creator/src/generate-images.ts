/**
 * Generate social media images from video scenes
 * Output: OG image (1200x630), Instagram (1080x1080), TikTok thumbnail (1080x1920)
 */
import puppeteer from "puppeteer";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";

const OUTPUT = resolve(process.cwd(), "output", "images");

interface ImageConfig {
  name: string;
  width: number;
  height: number;
  html: string;
}

const images: ImageConfig[] = [
  // === OG Image (Website / Facebook share) — 1200x630 ===
  {
    name: "og-image-qwen36",
    width: 1200,
    height: 630,
    html: `
      <div style="width:1200px;height:630px;background:linear-gradient(135deg,#0B0B1A 0%,#1a103c 50%,#0d0d1e 100%);display:flex;align-items:center;padding:0 70px;font-family:'Segoe UI',sans-serif;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-80px;right:-80px;width:400px;height:400px;background:radial-gradient(circle,rgba(249,115,22,0.15) 0%,transparent 70%);border-radius:50%;"></div>
        <div style="position:absolute;bottom:-100px;left:-50px;width:350px;height:350px;background:radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%);border-radius:50%;"></div>
        <div style="flex:1;z-index:1;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <div style="background:linear-gradient(135deg,#F97316,#EF4444);border-radius:20px;padding:8px 20px;">
              <span style="font-size:16px;font-weight:800;color:#fff;letter-spacing:3px;text-transform:uppercase;">🔥 Review</span>
            </div>
            <span style="font-size:16px;color:rgba(255,255,255,0.4);">new.operis.vn</span>
          </div>
          <div style="font-size:58px;font-weight:900;line-height:1.15;margin-bottom:16px;">
            <span style="color:#fff;">Qwen</span><span style="background:linear-gradient(90deg,#F97316,#EF4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">3.6</span>
            <span style="color:rgba(255,255,255,0.6);font-size:40px;"> Plus Preview</span>
          </div>
          <div style="font-size:22px;color:rgba(255,255,255,0.5);line-height:1.5;max-width:550px;">
            Model mã nguồn mở mới nhất từ Alibaba. Đánh bại GPT-5 mini tới 30% trên benchmark coding.
          </div>
          <div style="display:flex;gap:16px;margin-top:24px;">
            <div style="background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:12px;padding:8px 18px;">
              <span style="font-size:16px;color:#F97316;font-weight:700;">397B Params</span>
            </div>
            <div style="background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:8px 18px;">
              <span style="font-size:16px;color:#8B5CF6;font-weight:700;">256K Context</span>
            </div>
            <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:8px 18px;">
              <span style="font-size:16px;color:#10B981;font-weight:700;">9.2/10</span>
            </div>
          </div>
        </div>
        <div style="width:200px;height:200px;background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(139,92,246,0.15));border-radius:40px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(249,115,22,0.2);z-index:1;">
          <span style="font-size:100px;">🧠</span>
        </div>
      </div>`,
  },

  // === Instagram Post (1080x1080) ===
  {
    name: "instagram-qwen36",
    width: 1080,
    height: 1080,
    html: `
      <div style="width:1080px;height:1080px;background:linear-gradient(160deg,#0B0B1A 0%,#1a103c 50%,#0d0d1e 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;position:relative;overflow:hidden;padding:60px;">
        <div style="position:absolute;top:-100px;right:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 70%);border-radius:50%;"></div>
        <div style="position:absolute;bottom:-80px;left:-80px;width:400px;height:400px;background:radial-gradient(circle,rgba(139,92,246,0.08) 0%,transparent 70%);border-radius:50%;"></div>

        <div style="background:linear-gradient(135deg,#F97316,#EF4444);border-radius:30px;padding:12px 36px;margin-bottom:30px;">
          <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:4px;text-transform:uppercase;">🔥 AI Model Review</span>
        </div>

        <div style="font-size:90px;font-weight:900;text-align:center;line-height:1.1;margin-bottom:10px;">
          <span style="color:#fff;">Qwen</span><span style="background:linear-gradient(90deg,#F97316,#EF4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">3.6</span>
        </div>
        <div style="font-size:40px;color:rgba(255,255,255,0.5);margin-bottom:40px;">Plus Preview</div>

        <div style="display:flex;gap:20px;margin-bottom:40px;">
          ${[
            { val: "397B", label: "Params", color: "#F97316" },
            { val: "256K", label: "Context", color: "#8B5CF6" },
            { val: "201", label: "Languages", color: "#06B6D4" },
          ].map(s => `
            <div style="text-align:center;background:rgba(255,255,255,0.04);border:1.5px solid ${s.color}33;border-radius:24px;padding:20px 28px;min-width:140px;">
              <div style="font-size:40px;font-weight:900;color:${s.color};font-family:'Cascadia Code',monospace;">${s.val}</div>
              <div style="font-size:18px;color:rgba(255,255,255,0.4);margin-top:6px;">${s.label}</div>
            </div>
          `).join("")}
        </div>

        <div style="width:200px;height:200px;border-radius:50%;border:5px solid #10B981;display:flex;align-items:center;justify-content:center;flex-direction:column;box-shadow:0 0 50px rgba(16,185,129,0.3);margin-bottom:30px;">
          <div style="font-size:80px;font-weight:900;color:#10B981;line-height:1;">9.2</div>
          <div style="font-size:24px;color:rgba(255,255,255,0.5);">/ 10</div>
        </div>

        <div style="font-size:22px;color:rgba(255,255,255,0.35);">new.operis.vn</div>
      </div>`,
  },

  // === TikTok Thumbnail (1080x1920) ===
  {
    name: "tiktok-thumb-qwen36",
    width: 1080,
    height: 1920,
    html: `
      <div style="width:1080px;height:1920px;background:linear-gradient(160deg,#0B0B1A 0%,#1a103c 40%,#0d0d1e 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-100px;left:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 70%);border-radius:50%;"></div>
        <div style="position:absolute;bottom:-150px;right:-100px;width:600px;height:600px;background:radial-gradient(circle,rgba(139,92,246,0.08) 0%,transparent 70%);border-radius:50%;"></div>

        <div style="background:linear-gradient(135deg,#F97316,#EF4444);border-radius:40px;padding:16px 48px;margin-bottom:40px;box-shadow:0 12px 40px rgba(249,115,22,0.4);">
          <span style="font-size:32px;font-weight:800;color:#fff;letter-spacing:4px;">🔥 VỪA RA MẮT</span>
        </div>

        <div style="width:220px;height:220px;background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(139,92,246,0.15));border-radius:50px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(249,115,22,0.25);margin-bottom:30px;">
          <span style="font-size:120px;">🧠</span>
        </div>

        <div style="font-size:100px;font-weight:900;text-align:center;line-height:1.1;">
          <span style="color:#fff;">Qwen</span><span style="background:linear-gradient(90deg,#F97316,#EF4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">3.6</span>
        </div>
        <div style="font-size:48px;color:rgba(255,255,255,0.5);margin-bottom:50px;">Plus Preview</div>

        <div style="font-size:54px;font-weight:800;color:#fff;text-align:center;line-height:1.3;padding:0 80px;">
          Đánh bại <span style="color:#EF4444;">GPT-5 mini</span>
        </div>
        <div style="font-size:54px;font-weight:800;text-align:center;">
          <span style="background:linear-gradient(90deg,#10B981,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">tới 30%</span>
        </div>

        <div style="display:flex;gap:16px;margin-top:50px;">
          ${["397B Params", "256K Context", "9.2/10"].map((t, i) => {
            const colors = ["#F97316", "#8B5CF6", "#10B981"];
            return `<div style="background:${colors[i]}18;border:1.5px solid ${colors[i]}44;border-radius:16px;padding:14px 24px;">
              <span style="font-size:24px;color:${colors[i]};font-weight:700;">${t}</span>
            </div>`;
          }).join("")}
        </div>

        <div style="position:absolute;bottom:120px;font-size:28px;color:rgba(255,255,255,0.3);">new.operis.vn</div>
      </div>`,
  },

  // === Facebook Cover / Blog Banner (1200x628) — dark style ===
  {
    name: "blog-banner-qwen36",
    width: 1200,
    height: 628,
    html: `
      <div style="width:1200px;height:628px;background:linear-gradient(135deg,#0B0B1A 0%,#1e1045 50%,#0a1628 100%);display:flex;font-family:'Segoe UI',sans-serif;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-50px;left:50%;width:800px;height:800px;background:radial-gradient(circle,rgba(249,115,22,0.08) 0%,transparent 60%);border-radius:50%;transform:translateX(-50%);"></div>

        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:50px 60px;z-index:1;">
          <div style="font-size:18px;color:#F97316;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin-bottom:16px;">
            ✦ Đánh giá chi tiết ✦
          </div>
          <div style="font-size:52px;font-weight:900;color:#fff;line-height:1.15;margin-bottom:12px;">
            Qwen3.6 Plus Preview
          </div>
          <div style="font-size:20px;color:rgba(255,255,255,0.45);line-height:1.6;max-width:500px;margin-bottom:24px;">
            Model mã nguồn mở 397B tham số, đánh bại GPT-5 mini 30% trên coding benchmark. Context 256K, hỗ trợ 201 ngôn ngữ.
          </div>
          <div style="display:flex;gap:12px;">
            <div style="background:#10B981;border-radius:20px;padding:10px 24px;">
              <span style="font-size:18px;font-weight:800;color:#fff;">9.2 / 10</span>
            </div>
            <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:10px 24px;">
              <span style="font-size:18px;color:rgba(255,255,255,0.6);">new.operis.vn</span>
            </div>
          </div>
        </div>

        <div style="width:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;">
          <div style="width:160px;height:160px;background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(139,92,246,0.15));border-radius:40px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(249,115,22,0.2);margin-bottom:20px;">
            <span style="font-size:80px;">🧠</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
            ${[
              { val: "397B", color: "#F97316" },
              { val: "256K", color: "#8B5CF6" },
              { val: "201 Lang", color: "#06B6D4" },
            ].map(s => `
              <div style="background:${s.color}12;border:1px solid ${s.color}33;border-radius:14px;padding:6px 20px;">
                <span style="font-size:18px;color:${s.color};font-weight:700;font-family:'Cascadia Code',monospace;">${s.val}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>`,
  },
];

async function main() {
  console.log("=== GENERATING SOCIAL MEDIA IMAGES ===\n");

  if (!existsSync(OUTPUT)) await mkdir(OUTPUT, { recursive: true });

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

  for (const img of images) {
    const page = await browser.newPage();
    await page.setViewport({ width: img.width, height: img.height, deviceScaleFactor: 2 }); // 2x for retina
    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}</style></head><body>${img.html}</body></html>`,
      { waitUntil: "domcontentloaded", timeout: 5000 }
    );

    const path = join(OUTPUT, `${img.name}.png`);
    await page.screenshot({ path, type: "png" });
    await page.close();

    console.log(`✅ ${img.name}.png (${img.width}x${img.height} @2x)`);
  }

  await browser.close();
  console.log(`\nDone! ${images.length} images → ${OUTPUT}`);
}

main().catch(console.error);
