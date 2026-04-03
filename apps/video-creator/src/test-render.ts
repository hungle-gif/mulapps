/**
 * Video TikTok: Review Qwen3.6 Plus Preview — vừa release 30/03/2026
 * Layout TO, chỉnh chu cho xem trên điện thoại
 */
import { renderVideo } from "./lib/render.js";

const REMOTION_CODE = `
import React from "react";
import {
  AbsoluteFill, Audio, interpolate, useCurrentFrame,
  useVideoConfig, spring, staticFile,
} from "remotion";

const T = {
  s1: { start: 0, end: 300 },
  s2: { start: 300, end: 700 },
  s3: { start: 700, end: 1200 },
  s4: { start: 1200, end: 1700 },
  s5: { start: 1700, end: 2000 },
};
const FADE = 15;
const F = "'Segoe UI', sans-serif";
const M = "'Cascadia Code', 'Consolas', monospace";

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

// Animated benchmark bar — TO, rõ
const Bar: React.FC<{ label: string; val: number; max: number; color: string; delay: number; highlight?: boolean }> = ({ label, val, max, color, delay, highlight }) => {
  const s = useS({ start: 0 }, delay, { damping: 14, stiffness: 80 });
  const w = interpolate(s, [0, 1], [0, (val / max) * 750]);
  const v = (val * interpolate(s, [0, 1], [0, 1])).toFixed(1);
  return (
    <div style={{ opacity: interpolate(s, [0, 1], [0, 1]), marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "0 6px" }}>
        <span style={{ fontSize: 30, color: highlight ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: F, fontWeight: highlight ? 700 : 500 }}>{label}</span>
        <span style={{ fontSize: 30, color: highlight ? color : "rgba(255,255,255,0.55)", fontFamily: M, fontWeight: 700 }}>{v}%</span>
      </div>
      <div style={{ width: 780, height: 32, borderRadius: 16, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          width: w, height: "100%", borderRadius: 16,
          background: highlight ? \`linear-gradient(90deg, \${color}, \${color}cc)\` : \`\${color}55\`,
          boxShadow: highlight ? \`0 0 25px \${color}44\` : "none",
        }} />
      </div>
    </div>
  );
};

// ==========================================
// S1: HOOK — Qwen3.6 vừa ra mắt
// ==========================================
const S1: React.FC = () => {
  const lf = useL(T.s1);
  const s1 = useS(T.s1, 5, { damping: 5, stiffness: 120, mass: 0.6 });
  const s2 = useS(T.s1, 30);
  const s3 = useS(T.s1, 60);
  const lineW = interpolate(lf, [35, 65], [0, 350], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = lf > 75 && lf < 90 ? Math.sin(lf * 3) * 4 : 0;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{
        position: "absolute", top: 300,
        opacity: interpolate(s1, [0, 1], [0, 1]),
        transform: \`scale(\${interpolate(s1, [0, 1], [0.4, 1])})\`,
      }}>
        <div style={{
          background: "linear-gradient(135deg, #F97316, #EF4444)",
          borderRadius: 40, padding: "16px 48px",
          boxShadow: "0 12px 40px rgba(249,115,22,0.4)",
        }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: "#fff", fontFamily: F, letterSpacing: 4, textTransform: "uppercase" }}>
            🔥 Vừa ra mắt hôm qua
          </span>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "0 60px" }}>
        <div style={{
          fontSize: 90, fontWeight: 900, fontFamily: F, lineHeight: 1.1,
          opacity: interpolate(s2, [0, 1], [0, 1]),
          transform: \`translateY(\${interpolate(s2, [0, 1], [40, 0])}px)\`,
        }}>
          <span style={{ color: "#fff" }}>Qwen</span><span style={{
            background: "linear-gradient(90deg, #F97316, #EF4444)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>3.6</span>
        </div>
        <div style={{
          fontSize: 52, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: F,
          opacity: interpolate(s2, [0, 1], [0, 1]),
          transform: \`translateY(\${interpolate(s2, [0, 1], [30, 0])}px)\`,
          marginTop: 8,
        }}>Plus Preview</div>

        <div style={{ width: lineW, height: 5, borderRadius: 3, background: "linear-gradient(90deg, #F97316, #EF4444)", margin: "28px auto", boxShadow: "0 0 20px rgba(249,115,22,0.4)" }} />

        <div style={{
          fontSize: 38, color: "rgba(255,255,255,0.5)", fontFamily: F, fontWeight: 500,
          opacity: interpolate(s3, [0, 1], [0, 1]),
          transform: \`translateX(\${shake}px)\`,
        }}>
          Đánh bại <span style={{ color: "#EF4444", fontWeight: 700 }}>GPT-5 mini</span> tới 30%?
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// S2: SPECS — Thông số ấn tượng
// ==========================================
const S2: React.FC = () => {
  const lf = useL(T.s2);
  const specs = [
    { label: "Parameters", value: "397B total", sub: "17B active (MoE)", icon: "⚡", color: "#F97316" },
    { label: "Context", value: "256K tokens", sub: "Dài gấp 2x GPT-4", icon: "📏", color: "#8B5CF6" },
    { label: "Languages", value: "201", sub: "Đa ngôn ngữ nhất", icon: "🌍", color: "#06B6D4" },
    { label: "Architecture", value: "Hybrid MoE", sub: "Nhanh & hiệu quả", icon: "🧠", color: "#10B981" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 220 }}>
      <div style={{
        textAlign: "center", marginBottom: 50,
        opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 28, color: "#F97316", fontFamily: F, fontWeight: 700, letterSpacing: 5, textTransform: "uppercase", marginBottom: 14 }}>
          ✦ Thông số ✦
        </div>
        <div style={{ fontSize: 56, color: "#fff", fontFamily: F, fontWeight: 900 }}>Con Số Ấn Tượng</div>
        <div style={{ width: 100, height: 4, background: "linear-gradient(90deg, #F97316, #EF4444)", borderRadius: 2, margin: "18px auto 0" }} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, width: 980, justifyContent: "center" }}>
        {specs.map((sp, i) => {
          const s = useS(T.s2, 25 + i * 30, { damping: 9, stiffness: 65 });
          return (
            <div key={i} style={{
              width: 465, background: "rgba(255,255,255,0.04)", border: \`1.5px solid \${sp.color}33\`,
              borderRadius: 28, padding: "32px 28px", position: "relative", overflow: "hidden",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: \`translateY(\${interpolate(s, [0, 1], [50, 0])}px) scale(\${interpolate(s, [0, 1], [0.9, 1])})\`,
            }}>
              <Shine delay={T.s2.start + 25 + i * 30 + 15} w={465} h={130} />
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <span style={{ fontSize: 40 }}>{sp.icon}</span>
                <span style={{ fontSize: 26, color: sp.color, fontFamily: F, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2 }}>{sp.label}</span>
              </div>
              <div style={{ fontSize: 44, fontWeight: 900, color: "#fff", fontFamily: M }}>{sp.value}</div>
              <div style={{ fontSize: 24, color: "rgba(255,255,255,0.4)", fontFamily: F, marginTop: 6 }}>{sp.sub}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// S3: BENCHMARKS — So sánh
// ==========================================
const S3: React.FC = () => {
  const lf = useL(T.s3);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
      <div style={{
        textAlign: "center", marginBottom: 40,
        opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 28, color: "#10B981", fontFamily: F, fontWeight: 700, letterSpacing: 5, textTransform: "uppercase", marginBottom: 14 }}>
          ✦ Benchmark ✦
        </div>
        <div style={{ fontSize: 52, color: "#fff", fontFamily: F, fontWeight: 900 }}>Qwen3.6 vs Đối Thủ</div>
        <div style={{ width: 100, height: 4, background: "linear-gradient(90deg, #10B981, #06B6D4)", borderRadius: 2, margin: "18px auto 0" }} />
      </div>

      <div style={{ width: 860, marginTop: 10 }}>
        <div style={{ fontSize: 32, color: "#F59E0B", fontFamily: F, fontWeight: 700, marginBottom: 16, opacity: interpolate(lf, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          GPQA Diamond
        </div>
        <Bar label="GPT-5 mini" val={71.5} max={100} color="#6B7280" delay={T.s3.start + 30} />
        <Bar label="Claude Sonnet" val={68.4} max={100} color="#6B7280" delay={T.s3.start + 40} />
        <Bar label="Qwen3.6 (9B)" val={81.7} max={100} color="#10B981" delay={T.s3.start + 50} highlight />

        <div style={{ height: 30 }} />

        <div style={{ fontSize: 32, color: "#F59E0B", fontFamily: F, fontWeight: 700, marginBottom: 16, opacity: interpolate(lf, [160, 175], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          HMMT Feb 2025
        </div>
        <Bar label="GPT-OSS-120B" val={76.7} max={100} color="#6B7280" delay={T.s3.start + 170} />
        <Bar label="Llama 4 Scout" val={73.2} max={100} color="#6B7280" delay={T.s3.start + 180} />
        <Bar label="Qwen3.6 (9B)" val={83.2} max={100} color="#10B981" delay={T.s3.start + 190} highlight />

        <div style={{ height: 30 }} />

        <div style={{ fontSize: 32, color: "#F59E0B", fontFamily: F, fontWeight: 700, marginBottom: 16, opacity: interpolate(lf, [310, 325], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          BFCL-V4 (Coding)
        </div>
        <Bar label="GPT-5 mini" val={55.5} max={100} color="#6B7280" delay={T.s3.start + 320} />
        <Bar label="DeepSeek V3.1" val={64.8} max={100} color="#6B7280" delay={T.s3.start + 330} />
        <Bar label="Qwen3.5 (122B)" val={72.2} max={100} color="#10B981" delay={T.s3.start + 340} highlight />
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// S4: VERDICT — Đánh giá
// ==========================================
const S4: React.FC = () => {
  const lf = useL(T.s4);
  const { fps } = useVideoConfig();
  const scoreSp = spring({ frame: lf - 10, fps, config: { damping: 6, stiffness: 60, mass: 1.2 } });
  const scoreVal = interpolate(scoreSp, [0, 1], [0, 9.2]);
  const pros = ["Top 1 open-source trong phân khúc", "Context 256K — dài nhất hiện tại", "201 ngôn ngữ — đa dạng nhất", "Coding benchmark vượt GPT-5 mini"];
  const cons = ["Model lớn — cần infra mạnh", "Preview — chưa ổn định hoàn toàn"];

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
      {/* Score */}
      <div style={{
        transform: \`scale(\${interpolate(scoreSp, [0, 1], [0.3, 1])})\`,
        textAlign: "center", marginBottom: 40,
      }}>
        <div style={{
          width: 200, height: 200, borderRadius: "50%",
          border: "5px solid #10B981", display: "flex", justifyContent: "center", alignItems: "center",
          flexDirection: "column", boxShadow: "0 0 50px rgba(16,185,129,0.3)",
          margin: "0 auto",
        }}>
          <div style={{ fontSize: 88, fontWeight: 900, color: "#10B981", fontFamily: F, lineHeight: 1 }}>{scoreVal.toFixed(1)}</div>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.5)", fontFamily: F, fontWeight: 600 }}>/ 10</div>
        </div>
        <div style={{ fontSize: 38, color: "#fff", fontFamily: F, fontWeight: 800, marginTop: 20, letterSpacing: 3, textTransform: "uppercase" }}>Verdict</div>
      </div>

      <div style={{ width: 920 }}>
        <div style={{ fontSize: 32, color: "#10B981", fontFamily: F, fontWeight: 700, marginBottom: 16, letterSpacing: 2, opacity: interpolate(lf, [60, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>PROS</div>
        {pros.map((p, i) => {
          const s = useS(T.s4, 65 + i * 25);
          return (
            <div key={i} style={{
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: \`translateX(\${interpolate(s, [0, 1], [-50, 0])}px)\`,
              display: "flex", alignItems: "center", gap: 18, marginBottom: 14,
            }}>
              <div style={{ fontSize: 30, color: "#10B981", flexShrink: 0 }}>✓</div>
              <span style={{ fontSize: 32, color: "#fff", fontFamily: F, fontWeight: 600 }}>{p}</span>
            </div>
          );
        })}

        <div style={{ fontSize: 32, color: "#EF4444", fontFamily: F, fontWeight: 700, marginTop: 32, marginBottom: 16, letterSpacing: 2, opacity: interpolate(lf, [240, 260], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>CONS</div>
        {cons.map((c, i) => {
          const s = useS(T.s4, 250 + i * 25);
          return (
            <div key={i} style={{
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: \`translateX(\${interpolate(s, [0, 1], [-50, 0])}px)\`,
              display: "flex", alignItems: "center", gap: 18, marginBottom: 14,
            }}>
              <div style={{ fontSize: 30, color: "#EF4444", flexShrink: 0 }}>✗</div>
              <span style={{ fontSize: 30, color: "rgba(255,255,255,0.55)", fontFamily: F, fontWeight: 500 }}>{c}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// S5: CTA — Website + Follow + Tạm biệt
// ==========================================
const S5: React.FC = () => {
  const lf = useL(T.s5);
  const s1 = useS(T.s5, 5, { damping: 5, stiffness: 40 });
  const s2 = useS(T.s5, 30, { damping: 8, stiffness: 60 });
  const s3 = useS(T.s5, 70, { damping: 10, stiffness: 70 });
  const s4 = useS(T.s5, 110, { damping: 10, stiffness: 80 });
  const pulse = Math.sin(lf * 0.06) * 0.03;

  // Sparkle dots around
  const sparkles = Array.from({ length: 12 }, (_, i) => ({
    angle: (i * 30) * Math.PI / 180,
    dist: 320 + Math.sin(lf * 0.04 + i) * 40,
    size: 4 + (i % 4) * 2,
    opacity: 0.15 + Math.sin(lf * 0.07 + i * 0.8) * 0.12,
    color: i % 3 === 0 ? "#F97316" : i % 3 === 1 ? "#8B5CF6" : "#06B6D4",
  }));

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Expanding rings */}
      {[0.6, 0.9, 1.2, 1.6].map((base, i) => (
        <div key={i} style={{
          position: "absolute", top: "42%", left: "50%",
          width: 350 * (base + lf * 0.0008), height: 350 * (base + lf * 0.0008),
          borderRadius: "50%", border: \`\${i === 0 ? 2 : 1}px solid rgba(249,115,22,\${0.15 - i * 0.03})\`,
          transform: "translate(-50%, -50%)",
        }} />
      ))}

      {/* Sparkles */}
      {sparkles.map((sp, i) => (
        <div key={i} style={{
          position: "absolute",
          left: 540 + Math.cos(sp.angle + lf * 0.008) * sp.dist,
          top: 760 + Math.sin(sp.angle + lf * 0.008) * sp.dist,
          width: sp.size, height: sp.size, borderRadius: "50%",
          background: sp.color, opacity: sp.opacity,
          boxShadow: \`0 0 \${sp.size * 3}px \${sp.color}55\`,
        }} />
      ))}

      {/* "Cảm ơn" text */}
      <div style={{
        position: "absolute", top: 280, textAlign: "center", zIndex: 1,
        opacity: interpolate(s1, [0, 1], [0, 1]),
        transform: \`translateY(\${interpolate(s1, [0, 1], [40, 0])}px)\`,
      }}>
        <div style={{ fontSize: 42, color: "rgba(255,255,255,0.5)", fontFamily: F, fontWeight: 500 }}>
          Cảm ơn đã theo dõi ❤️
        </div>
      </div>

      {/* Website card */}
      <div style={{
        zIndex: 1, textAlign: "center",
        opacity: interpolate(s2, [0, 1], [0, 1]),
        transform: \`translateY(\${interpolate(s2, [0, 1], [50, 0])}px) scale(\${interpolate(s2, [0, 1], [0.85, 1])})\`,
      }}>
        <div style={{ fontSize: 32, color: "rgba(255,255,255,0.5)", fontFamily: F, marginBottom: 20 }}>
          Xem chi tiết tại
        </div>
        <div style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(139,92,246,0.12))",
          border: "2px solid rgba(249,115,22,0.35)",
          borderRadius: 28, padding: "28px 56px",
          boxShadow: "0 12px 40px rgba(249,115,22,0.15)",
          position: "relative", overflow: "hidden",
        }}>
          <Shine delay={T.s5.start + 40} w={500} h={90} />
          <div style={{ fontSize: 46, fontWeight: 800, fontFamily: F, letterSpacing: 1 }}>
            <span style={{ color: "#F97316" }}>tintucai</span><span style={{ color: "rgba(255,255,255,0.4)" }}>.</span><span style={{ color: "#8B5CF6" }}>vn</span>
          </div>
        </div>
      </div>

      {/* Follow button */}
      <div style={{
        position: "absolute", bottom: 480, zIndex: 1,
        opacity: interpolate(s3, [0, 1], [0, 1]),
        transform: \`scale(\${interpolate(s3, [0, 1], [0.7, 1]) + pulse})\`,
      }}>
        <div style={{
          background: "linear-gradient(135deg, #F97316, #EF4444)",
          borderRadius: 60, padding: "24px 64px",
          boxShadow: "0 16px 50px rgba(249,115,22,0.4)",
          position: "relative", overflow: "hidden",
        }}>
          <Shine delay={T.s5.start + 80} w={380} h={70} />
          <span style={{ fontSize: 36, fontWeight: 800, color: "#fff", fontFamily: F }}>
            Follow kênh ngay ✨
          </span>
        </div>
      </div>

      {/* Goodbye text */}
      <div style={{
        position: "absolute", bottom: 370, zIndex: 1,
        opacity: interpolate(s4, [0, 1], [0, 1]),
        transform: \`translateY(\${interpolate(s4, [0, 1], [20, 0])}px)\`,
      }}>
        <span style={{ fontSize: 26, color: "rgba(255,255,255,0.35)", fontFamily: F }}>
          Hẹn gặp lại 👋
        </span>
      </div>
    </AbsoluteFill>
  );
};

// === MAIN ===
export const TikTokVideo: React.FC = () => {
  const f = useCurrentFrame();
  const bgHue = interpolate(f, [0, 2000], [20, 280], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{
      background: \`linear-gradient(160deg, hsl(\${bgHue}, 25%, 5%) 0%, hsl(\${bgHue + 20}, 20%, 7%) 50%, hsl(\${bgHue - 10}, 15%, 4%) 100%)\`,
      overflow: "hidden",
    }}>
      <Audio src={staticFile("voiceover.mp3")} />
      <Orb x={-80} y={100} s={500} c="rgba(249,115,22,0.08)" sp={0.018} />
      <Orb x={700} y={500} s={450} c="rgba(139,92,246,0.06)" sp={0.025} />
      <Orb x={0} y={1100} s={400} c="rgba(16,185,129,0.06)" sp={0.012} />
      <div style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "80px 80px", pointerEvents: "none",
      }} />
      <Sc t={T.s1}><S1 /></Sc>
      <Sc t={T.s2}><S2 /></Sc>
      <Sc t={T.s3}><S3 /></Sc>
      <Sc t={T.s4}><S4 /></Sc>
      <Sc t={T.s5}><S5 /></Sc>

      {/* Watermark — luôn hiện dưới mọi scene */}
      <div style={{
        position: "absolute", bottom: 60, left: 0, right: 0,
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 10, zIndex: 100, pointerEvents: "none",
      }}>
        <div style={{
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)",
          borderRadius: 30, padding: "10px 28px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", fontFamily: F, fontWeight: 600, letterSpacing: 1 }}>
            tintucai.vn
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

const VOICE_SCRIPTS = [
  { id: "scene1_hook", text: "Qwen 3 chấm 6 Plus Preview vừa ra mắt. Model mã nguồn mở mới nhất từ Alibaba, và nó đánh bại GPT-5 mini tới 30 phần trăm trên benchmark coding. Cùng mình đánh giá chi tiết.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "scene2_specs", text: "Thông số rất ấn tượng. 397 tỷ tham số tổng, nhưng kiến trúc Mixture of Experts chỉ kích hoạt 17 tỷ mỗi lần, nên vừa mạnh vừa nhanh. Context window lên tới 256 nghìn tokens, dài gấp đôi GPT-4. Và hỗ trợ tới 201 ngôn ngữ, đa dạng nhất hiện nay.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "scene3_bench", text: "Nhìn vào benchmark. GPQA Diamond đạt 81 chấm 7, trong khi GPT-5 mini chỉ 71 chấm 5. HMMT đạt 83 chấm 2, vượt xa GPT-OSS. Coding BFCL-V4 đạt 72 chấm 2, cao hơn GPT-5 mini tới 30 phần trăm. Tất cả chỉ với model 9 tỷ tham số.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "scene4_verdict", text: "Đánh giá của mình, 9 chấm 2 trên 10. Ưu điểm là top 1 open-source, context 256K dài nhất, 201 ngôn ngữ, và coding cực mạnh. Nhược điểm là model lớn cần hạ tầng mạnh, và vẫn đang ở bản preview.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "scene5_cta", text: "Xem đánh giá chi tiết hơn, tại website, tin tức ai chấm vn. Follow kênh, để cập nhật tin tức AI mới nhất. Hẹn gặp lại các bạn.", voice: "vi-VN-NamMinhNeural", rate: "-2%", pitch: "-5Hz", engine: "edge" as const },
];

async function main() {
  console.log("=== QWEN 3.6 REVIEW — Premium TikTok ===\n");
  const result = await renderVideo({ code: REMOTION_CODE, voice_scripts: VOICE_SCRIPTS });
  console.log(`\n🎬 ${result.video_path}\n   ${result.duration_seconds.toFixed(0)}s | ${(result.file_size_bytes / 1024 / 1024).toFixed(1)}MB`);
  const { execSync } = await import("child_process");
  execSync(`start explorer "${result.video_path.split("\\").slice(0, -1).join("\\")}"`);}

main().catch(console.error);
