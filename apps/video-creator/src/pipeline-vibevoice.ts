/**
 * FULL PIPELINE: VibeVoice review — Video + Images
 * Called by Hub after analysis
 */
import { renderVideo } from "./lib/render.js";
import puppeteer from "puppeteer";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";

const OUTPUT_IMG = resolve(process.cwd(), "output", "vibevoice-images");

// =============================================
// PART 1: VIDEO
// =============================================
const VIDEO_CODE = `
import React from "react";
import {
  AbsoluteFill, Audio, interpolate, useCurrentFrame,
  useVideoConfig, spring, staticFile,
} from "remotion";

const T = {
  s1: { start: 0, end: 300 },
  s2: { start: 300, end: 700 },
  s3: { start: 700, end: 1100 },
  s4: { start: 1100, end: 1500 },
  s5: { start: 1500, end: 1800 },
};
const FADE = 15;
const F = "'Segoe UI', sans-serif";
const M = "'Cascadia Code', monospace";

const useL = (t: { start: number }) => useCurrentFrame() - t.start;
const useS = (t: { start: number }, d: number, c?: object) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return spring({ frame: f - t.start - d, fps, config: { damping: 12, stiffness: 100, ...c } });
};

const Sc: React.FC<{ children: React.ReactNode; t: { start: number; end: number } }> = ({ children, t }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [t.start, t.start + FADE, t.end - FADE, t.end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return o > 0 ? <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill> : null;
};

const Orb: React.FC<{ x: number; y: number; s: number; c: string; sp?: number }> = ({ x, y, s, c, sp = 0.02 }) => {
  const f = useCurrentFrame();
  return <div style={{
    position: "absolute", left: x + Math.sin(f * 0.008 + x) * 35, top: y + Math.cos(f * 0.006 + y) * 25,
    width: s, height: s, borderRadius: "50%",
    background: \`radial-gradient(circle, \${c} 0%, transparent 70%)\`,
    opacity: (Math.sin(f * sp) * 0.3 + 0.7) * 0.2, filter: \`blur(\${s * 0.3}px)\`, pointerEvents: "none",
  }} />;
};

const Shine: React.FC<{ delay: number; w: number; h: number }> = ({ delay, w, h }) => {
  const f = useCurrentFrame();
  const p = interpolate(f - delay, [0, 45], [-0.3, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (p > -0.2 && p < 1.2) ? (
    <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h, overflow: "hidden", pointerEvents: "none", borderRadius: 28 }}>
      <div style={{ position: "absolute", top: 0, left: \`\${p * 100}%\`, width: 100, height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)", transform: "skewX(-20deg)" }} />
    </div>
  ) : null;
};

const Bar: React.FC<{ label: string; val: string; sub: string; color: string; delay: number }> = ({ label, val, sub, color, delay }) => {
  const s = useS({ start: 0 }, delay, { damping: 10, stiffness: 70 });
  return (
    <div style={{ opacity: interpolate(s, [0, 1], [0, 1]), transform: \`translateX(\${interpolate(s, [0, 1], [80, 0])}px)\`, display: "flex", alignItems: "center", gap: 22, background: "rgba(255,255,255,0.04)", border: \`1.5px solid \${color}33\`, borderRadius: 24, padding: "24px 28px", position: "relative", overflow: "hidden", marginBottom: 20 }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: color }} />
      <Shine delay={delay + 15} w={920} h={80} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", fontFamily: F }}>{label}</div>
        <div style={{ fontSize: 24, color: "rgba(255,255,255,0.45)", marginTop: 4, fontFamily: F }}>{sub}</div>
      </div>
      <div style={{ background: \`\${color}15\`, border: \`1px solid \${color}33\`, borderRadius: 16, padding: "10px 22px" }}>
        <span style={{ fontSize: 28, color, fontWeight: 800, fontFamily: M }}>{val}</span>
      </div>
    </div>
  );
};

// S1: HOOK
const S1: React.FC = () => {
  const lf = useL(T.s1);
  const s1 = useS(T.s1, 5, { damping: 5, stiffness: 120, mass: 0.6 });
  const s2 = useS(T.s1, 30);
  const pulse = Math.sin(lf * 0.08) * 25 + 50;
  const lineW = interpolate(lf, [35, 65], [0, 350], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "absolute", top: 280, opacity: interpolate(s1, [0, 1], [0, 1]), transform: \`scale(\${interpolate(s1, [0, 1], [0.4, 1])})\` }}>
        <div style={{ background: "linear-gradient(135deg, #0078D4, #50E6FF)", borderRadius: 40, padding: "16px 48px", boxShadow: "0 12px 40px rgba(0,120,212,0.4)" }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: F, letterSpacing: 4 }}>🔥 TRENDING #1 GITHUB</span>
        </div>
      </div>
      <div style={{ textAlign: "center", padding: "0 60px" }}>
        <div style={{ fontSize: 44, color: "rgba(255,255,255,0.5)", fontFamily: F, fontWeight: 600, opacity: interpolate(s1, [0, 1], [0, 1]) }}>Microsoft</div>
        <div style={{ fontSize: 88, fontWeight: 900, fontFamily: F, lineHeight: 1.1, opacity: interpolate(s2, [0, 1], [0, 1]), transform: \`translateY(\${interpolate(s2, [0, 1], [40, 0])}px)\` }}>
          <span style={{ background: "linear-gradient(90deg, #0078D4, #50E6FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VibeVoice</span>
        </div>
        <div style={{ width: lineW, height: 5, borderRadius: 3, background: "linear-gradient(90deg, #0078D4, #50E6FF)", margin: "20px auto", boxShadow: \`0 0 20px rgba(0,120,212,0.4)\` }} />
        <div style={{ fontSize: 36, color: "rgba(255,255,255,0.6)", fontFamily: F, opacity: interpolate(s2, [0, 1], [0, 1]) }}>
          Voice AI mã nguồn mở mạnh nhất
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 380, opacity: interpolate(lf, [70, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), display: "flex", gap: 16 }}>
        <div style={{ background: "rgba(80,230,255,0.1)", border: "1.5px solid rgba(80,230,255,0.3)", borderRadius: 16, padding: "12px 24px" }}>
          <span style={{ fontSize: 24, color: "#50E6FF", fontWeight: 700 }}>⭐ 32.8K stars</span>
        </div>
        <div style={{ background: "rgba(255,107,53,0.1)", border: "1.5px solid rgba(255,107,53,0.3)", borderRadius: 16, padding: "12px 24px" }}>
          <span style={{ fontSize: 24, color: "#FF6B35", fontWeight: 700 }}>+3,862 hôm nay</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S2: 3 MODELS
const S2: React.FC = () => {
  const lf = useL(T.s2);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
      <div style={{ textAlign: "center", marginBottom: 44, opacity: interpolate(lf, [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ fontSize: 28, color: "#0078D4", fontFamily: F, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 14 }}>✦ Bộ 3 Model ✦</div>
        <div style={{ fontSize: 52, color: "#fff", fontFamily: F, fontWeight: 900 }}>Một Hệ Sinh Thái Hoàn Chỉnh</div>
        <div style={{ width: 100, height: 4, background: "linear-gradient(90deg, #0078D4, #50E6FF)", borderRadius: 2, margin: "18px auto 0" }} />
      </div>
      <div style={{ width: 940 }}>
        <Bar label="ASR-7B — Nhận dạng giọng nói" val="60 phút" sub="50+ ngôn ngữ • Who/When/What cùng lúc" color="#0078D4" delay={T.s2.start + 30} />
        <Bar label="TTS-1.5B — Tạo giọng nói" val="90 phút" sub="4 speakers • Đa ngôn ngữ • Cảm xúc" color="#50E6FF" delay={T.s2.start + 70} />
        <Bar label="Realtime-0.5B — Streaming" val="300ms" sub="Siêu nhẹ • 9 ngôn ngữ • Realtime" color="#10B981" delay={T.s2.start + 110} />
      </div>
    </AbsoluteFill>
  );
};

// S3: SO SÁNH
const S3: React.FC = () => {
  const lf = useL(T.s3);
  const rows = [
    { feat: "Audio dài nhất", vibe: "60-90 phút", other: "5-10 phút", win: true },
    { feat: "Tokenization", vibe: "7.5 Hz", other: "50-75 Hz", win: true },
    { feat: "ASR Output", vibe: "Who+When+What", other: "Chỉ text", win: true },
    { feat: "Realtime latency", vibe: "300ms", other: "500ms-2s", win: true },
    { feat: "License", vibe: "MIT (free)", other: "Hạn chế", win: true },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
      <div style={{ textAlign: "center", marginBottom: 40, opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ fontSize: 28, color: "#10B981", fontFamily: F, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 14 }}>✦ So sánh ✦</div>
        <div style={{ fontSize: 52, color: "#fff", fontFamily: F, fontWeight: 900 }}>VibeVoice vs Đối Thủ</div>
        <div style={{ width: 100, height: 4, background: "linear-gradient(90deg, #10B981, #50E6FF)", borderRadius: 2, margin: "18px auto 0" }} />
      </div>
      <div style={{ width: 940 }}>
        {/* Header */}
        <div style={{ display: "flex", padding: "14px 24px", marginBottom: 12, opacity: interpolate(lf, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <div style={{ flex: 2, fontSize: 22, color: "rgba(255,255,255,0.35)", fontFamily: F, fontWeight: 600 }}>Tính năng</div>
          <div style={{ flex: 1.5, fontSize: 22, color: "#0078D4", fontFamily: F, fontWeight: 700, textAlign: "center" }}>VibeVoice</div>
          <div style={{ flex: 1.5, fontSize: 22, color: "rgba(255,255,255,0.35)", fontFamily: F, fontWeight: 600, textAlign: "center" }}>Khác</div>
        </div>
        {rows.map((r, i) => {
          const s = useS(T.s3, 30 + i * 35, { damping: 10, stiffness: 70 });
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", padding: "18px 24px",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 18, marginBottom: 12,
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: \`translateY(\${interpolate(s, [0, 1], [30, 0])}px)\`,
            }}>
              <div style={{ flex: 2, fontSize: 26, color: "rgba(255,255,255,0.7)", fontFamily: F }}>{r.feat}</div>
              <div style={{ flex: 1.5, textAlign: "center" }}>
                <span style={{ fontSize: 26, color: "#10B981", fontWeight: 700, fontFamily: M }}>{r.vibe}</span>
              </div>
              <div style={{ flex: 1.5, textAlign: "center" }}>
                <span style={{ fontSize: 24, color: "rgba(255,255,255,0.3)", fontFamily: M }}>{r.other}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// S4: VERDICT
const S4: React.FC = () => {
  const lf = useL(T.s4);
  const { fps } = useVideoConfig();
  const scoreSp = spring({ frame: lf - 10, fps, config: { damping: 6, stiffness: 60, mass: 1.2 } });
  const scoreVal = interpolate(scoreSp, [0, 1], [0, 9.5]);
  const pros = ["Audio 60-90 phút — dài gấp 10x đối thủ", "300ms latency — gần như realtime", "MIT License — tự do thương mại", "ICLR 2026 — được học thuật công nhận"];
  const cons = ["TTS code bị remove (chỉ còn weights)", "Model 7B cần GPU mạnh"];

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
      <div style={{ transform: \`scale(\${interpolate(scoreSp, [0, 1], [0.3, 1])})\`, textAlign: "center", marginBottom: 36 }}>
        <div style={{ width: 180, height: 180, borderRadius: "50%", border: "5px solid #0078D4", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", boxShadow: "0 0 50px rgba(0,120,212,0.3)", margin: "0 auto" }}>
          <div style={{ fontSize: 80, fontWeight: 900, color: "#0078D4", fontFamily: F, lineHeight: 1 }}>{scoreVal.toFixed(1)}</div>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.5)", fontFamily: F }}>/ 10</div>
        </div>
      </div>
      <div style={{ width: 920 }}>
        <div style={{ fontSize: 30, color: "#10B981", fontFamily: F, fontWeight: 700, marginBottom: 14, letterSpacing: 2, opacity: interpolate(lf, [50, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>PROS</div>
        {pros.map((p, i) => {
          const s = useS(T.s4, 55 + i * 22);
          return (<div key={i} style={{ opacity: interpolate(s, [0, 1], [0, 1]), transform: \`translateX(\${interpolate(s, [0, 1], [-40, 0])}px)\`, display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <span style={{ fontSize: 28, color: "#10B981" }}>✓</span>
            <span style={{ fontSize: 30, color: "#fff", fontFamily: F, fontWeight: 600 }}>{p}</span>
          </div>);
        })}
        <div style={{ fontSize: 30, color: "#EF4444", fontFamily: F, fontWeight: 700, marginTop: 28, marginBottom: 14, letterSpacing: 2, opacity: interpolate(lf, [200, 220], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>CONS</div>
        {cons.map((c, i) => {
          const s = useS(T.s4, 210 + i * 22);
          return (<div key={i} style={{ opacity: interpolate(s, [0, 1], [0, 1]), transform: \`translateX(\${interpolate(s, [0, 1], [-40, 0])}px)\`, display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <span style={{ fontSize: 28, color: "#EF4444" }}>✗</span>
            <span style={{ fontSize: 28, color: "rgba(255,255,255,0.5)", fontFamily: F }}>{ c}</span>
          </div>);
        })}
      </div>
    </AbsoluteFill>
  );
};

// S5: CTA
const S5: React.FC = () => {
  const lf = useL(T.s5);
  const s1 = useS(T.s5, 5, { damping: 5, stiffness: 40 });
  const s2 = useS(T.s5, 30, { damping: 8, stiffness: 60 });
  const pulse = Math.sin(lf * 0.06) * 0.03;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {[0.6, 0.9, 1.2].map((b, i) => (
        <div key={i} style={{ position: "absolute", top: "42%", left: "50%", width: 350 * (b + lf * 0.0008), height: 350 * (b + lf * 0.0008), borderRadius: "50%", border: \`\${i === 0 ? 2 : 1}px solid rgba(0,120,212,\${0.15 - i * 0.04})\`, transform: "translate(-50%, -50%)" }} />
      ))}
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: 40, color: "rgba(255,255,255,0.5)", fontFamily: F, marginBottom: 16, opacity: interpolate(s1, [0, 1], [0, 1]) }}>Cảm ơn đã theo dõi ❤️</div>
        <div style={{ fontSize: 34, color: "rgba(255,255,255,0.45)", fontFamily: F, marginBottom: 24, opacity: interpolate(s1, [0, 1], [0, 1]) }}>Xem chi tiết tại</div>
        <div style={{ background: "linear-gradient(135deg, rgba(0,120,212,0.12), rgba(80,230,255,0.12))", border: "2px solid rgba(0,120,212,0.35)", borderRadius: 28, padding: "26px 56px", opacity: interpolate(s2, [0, 1], [0, 1]), transform: \`scale(\${interpolate(s2, [0, 1], [0.85, 1])})\`, position: "relative", overflow: "hidden" }}>
          <Shine delay={T.s5.start + 40} w={400} h={80} />
          <span style={{ fontSize: 46, fontWeight: 800, fontFamily: F }}><span style={{ color: "#0078D4" }}>tintucai</span><span style={{ color: "rgba(255,255,255,0.4)" }}>.</span><span style={{ color: "#50E6FF" }}>vn</span></span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 440, zIndex: 1, opacity: interpolate(lf, [55, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), transform: \`scale(\${1 + pulse})\` }}>
        <div style={{ background: "linear-gradient(135deg, #0078D4, #50E6FF)", borderRadius: 60, padding: "24px 64px", boxShadow: "0 16px 50px rgba(0,120,212,0.4)" }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: "#fff", fontFamily: F }}>Follow kênh ✨</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const TikTokVideo: React.FC = () => {
  const f = useCurrentFrame();
  const bgHue = interpolate(f, [0, 2000], [210, 250], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: \`linear-gradient(160deg, hsl(\${bgHue}, 30%, 5%) 0%, hsl(\${bgHue + 15}, 25%, 7%) 50%, hsl(\${bgHue - 10}, 20%, 4%) 100%)\`, overflow: "hidden" }}>
      <Audio src={staticFile("voiceover.mp3")} />
      <Orb x={-80} y={100} s={500} c="rgba(0,120,212,0.1)" sp={0.018} />
      <Orb x={700} y={500} s={450} c="rgba(80,230,255,0.06)" sp={0.025} />
      <Orb x={0} y={1100} s={400} c="rgba(16,185,129,0.06)" sp={0.012} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />
      <Sc t={T.s1}><S1 /></Sc>
      <Sc t={T.s2}><S2 /></Sc>
      <Sc t={T.s3}><S3 /></Sc>
      <Sc t={T.s4}><S4 /></Sc>
      <Sc t={T.s5}><S5 /></Sc>
      <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 100, pointerEvents: "none" }}>
        <div style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", borderRadius: 30, padding: "10px 28px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", fontFamily: F, fontWeight: 600, letterSpacing: 1 }}>tintucai.vn</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

const VOICE_SCRIPTS = [
  { id: "s1_hook", text: "Microsoft VibeVoice, đang trending số 1 trên GitHub hôm nay với hơn 3800 stars chỉ trong 1 ngày. Đây là bộ AI giọng nói mã nguồn mở mạnh nhất hiện tại. Cùng mình tìm hiểu.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "s2_models", text: "VibeVoice gồm 3 model. ASR-7B nhận dạng giọng nói lên tới 60 phút liên tục, hỗ trợ hơn 50 ngôn ngữ. TTS-1.5B tạo giọng nói tới 90 phút, hỗ trợ 4 người nói cùng lúc. Và Realtime-0.5B chỉ 300 mili giây độ trễ, streaming realtime.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "s3_compare", text: "So với đối thủ, VibeVoice xử lý audio dài gấp 10 lần. Tokenization hiệu quả gấp 7 lần ở tần số 7 chấm 5 héc. ASR trả về đồng thời ai nói, nói lúc nào, nói gì. Và hoàn toàn miễn phí với license MIT.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "s4_verdict", text: "Đánh giá của mình, 9 chấm 5 trên 10. Ưu điểm là audio cực dài, latency cực thấp, license MIT tự do, và paper được ICLR 2026 chấp nhận. Nhược điểm là phần TTS code đã bị gỡ, và model 7B cần GPU mạnh.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "s5_cta", text: "Xem đánh giá chi tiết hơn, tại website, tin tức ai chấm vn. Follow kênh, để cập nhật tin tức AI mới nhất. Hẹn gặp lại các bạn.", voice: "vi-VN-NamMinhNeural", rate: "+5%", pitch: "-5Hz", engine: "edge" as const },
];

// =============================================
// PART 2: IMAGES (run after video)
// =============================================
const IMAGES = [
  {
    name: "og-vibevoice",
    width: 1200, height: 630,
    html: `<div style="width:1200px;height:630px;background:linear-gradient(135deg,#0B0B1A,#0d1f3c,#0d0d1e);display:flex;align-items:center;padding:0 70px;font-family:'Segoe UI',sans-serif;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-80px;right:-80px;width:400px;height:400px;background:radial-gradient(circle,rgba(0,120,212,0.15) 0%,transparent 70%);border-radius:50%;"></div>
      <div style="flex:1;z-index:1;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;"><div style="background:linear-gradient(135deg,#0078D4,#50E6FF);border-radius:20px;padding:8px 20px;"><span style="font-size:16px;font-weight:800;color:#fff;letter-spacing:3px;">🔥 TRENDING #1</span></div><span style="font-size:16px;color:rgba(255,255,255,0.4);">tintucai.vn</span></div>
        <div style="font-size:54px;font-weight:900;line-height:1.15;margin-bottom:16px;"><span style="color:#fff;">Microsoft </span><span style="background:linear-gradient(90deg,#0078D4,#50E6FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">VibeVoice</span></div>
        <div style="font-size:20px;color:rgba(255,255,255,0.5);line-height:1.5;max-width:550px;">Voice AI mã nguồn mở: ASR 60 phút, TTS 90 phút, Realtime 300ms. MIT License.</div>
        <div style="display:flex;gap:12px;margin-top:20px;">
          <div style="background:rgba(0,120,212,0.12);border:1px solid rgba(0,120,212,0.3);border-radius:12px;padding:8px 18px;"><span style="font-size:16px;color:#0078D4;font-weight:700;">⭐ 32.8K</span></div>
          <div style="background:rgba(80,230,255,0.12);border:1px solid rgba(80,230,255,0.3);border-radius:12px;padding:8px 18px;"><span style="font-size:16px;color:#50E6FF;font-weight:700;">+3,862 today</span></div>
          <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:8px 18px;"><span style="font-size:16px;color:#10B981;font-weight:700;">9.5/10</span></div>
        </div>
      </div>
      <div style="width:180px;height:180px;background:linear-gradient(135deg,rgba(0,120,212,0.15),rgba(80,230,255,0.15));border-radius:40px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(0,120,212,0.2);z-index:1;"><span style="font-size:90px;">🎙️</span></div>
    </div>`,
  },
  {
    name: "ig-vibevoice",
    width: 1080, height: 1080,
    html: `<div style="width:1080px;height:1080px;background:linear-gradient(160deg,#0B0B1A,#0d1f3c,#0d0d1e);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;position:relative;overflow:hidden;padding:60px;">
      <div style="position:absolute;top:-100px;right:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(0,120,212,0.12) 0%,transparent 70%);border-radius:50%;"></div>
      <div style="background:linear-gradient(135deg,#0078D4,#50E6FF);border-radius:30px;padding:12px 36px;margin-bottom:30px;"><span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:4px;">🔥 TRENDING #1 GITHUB</span></div>
      <div style="font-size:40px;color:rgba(255,255,255,0.5);margin-bottom:8px;">Microsoft</div>
      <div style="font-size:86px;font-weight:900;background:linear-gradient(90deg,#0078D4,#50E6FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:30px;">VibeVoice</div>
      <div style="display:flex;gap:20px;margin-bottom:36px;">
        <div style="text-align:center;background:rgba(255,255,255,0.04);border:1.5px solid rgba(0,120,212,0.3);border-radius:24px;padding:20px 28px;min-width:140px;"><div style="font-size:38px;font-weight:900;color:#0078D4;font-family:'Cascadia Code',monospace;">60min</div><div style="font-size:18px;color:rgba(255,255,255,0.4);margin-top:6px;">ASR</div></div>
        <div style="text-align:center;background:rgba(255,255,255,0.04);border:1.5px solid rgba(80,230,255,0.3);border-radius:24px;padding:20px 28px;min-width:140px;"><div style="font-size:38px;font-weight:900;color:#50E6FF;font-family:'Cascadia Code',monospace;">90min</div><div style="font-size:18px;color:rgba(255,255,255,0.4);margin-top:6px;">TTS</div></div>
        <div style="text-align:center;background:rgba(255,255,255,0.04);border:1.5px solid rgba(16,185,129,0.3);border-radius:24px;padding:20px 28px;min-width:140px;"><div style="font-size:38px;font-weight:900;color:#10B981;font-family:'Cascadia Code',monospace;">300ms</div><div style="font-size:18px;color:rgba(255,255,255,0.4);margin-top:6px;">Realtime</div></div>
      </div>
      <div style="width:180px;height:180px;border-radius:50%;border:5px solid #0078D4;display:flex;align-items:center;justify-content:center;flex-direction:column;box-shadow:0 0 50px rgba(0,120,212,0.3);"><div style="font-size:72px;font-weight:900;color:#0078D4;line-height:1;">9.5</div><div style="font-size:22px;color:rgba(255,255,255,0.5);">/ 10</div></div>
      <div style="margin-top:24px;font-size:22px;color:rgba(255,255,255,0.3);">tintucai.vn</div>
    </div>`,
  },
];

async function main() {
  console.log("================================================");
  console.log("  FULL PIPELINE: VibeVoice Review");
  console.log("  Article ✓ → Video → Images");
  console.log("================================================\n");

  // VIDEO
  console.log("=== RENDERING VIDEO ===\n");
  const videoResult = await renderVideo({ code: VIDEO_CODE, voice_scripts: VOICE_SCRIPTS });
  console.log(`\n✅ Video: ${videoResult.video_path}`);
  console.log(`   ${videoResult.duration_seconds.toFixed(0)}s | ${(videoResult.file_size_bytes / 1024 / 1024).toFixed(1)}MB\n`);

  // IMAGES
  console.log("=== GENERATING IMAGES ===\n");
  if (!existsSync(OUTPUT_IMG)) await mkdir(OUTPUT_IMG, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

  for (const img of IMAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: img.width, height: img.height, deviceScaleFactor: 2 });
    await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}</style></head><body>${img.html}</body></html>`, { waitUntil: "domcontentloaded", timeout: 5000 });
    await page.screenshot({ path: join(OUTPUT_IMG, `${img.name}.png`), type: "png" });
    await page.close();
    console.log(`✅ ${img.name}.png`);
  }
  await browser.close();

  // SUMMARY
  console.log("\n================================================");
  console.log("  ✅ PIPELINE HOÀN THÀNH");
  console.log("================================================");
  console.log(`  📝 Bài viết:  hub/output/vibevoice-article.md`);
  console.log(`  🎬 Video:     ${videoResult.video_path}`);
  console.log(`  🖼️  Ảnh OG:    ${OUTPUT_IMG}/og-vibevoice.png`);
  console.log(`  🖼️  Ảnh IG:    ${OUTPUT_IMG}/ig-vibevoice.png`);
  console.log("================================================\n");

  const { execSync } = await import("child_process");
  execSync(`start explorer "${OUTPUT_IMG}"`);
}

main().catch(console.error);
