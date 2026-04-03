/**
 * Hub gọi video-creator qua API — ĐÚNG nguyên tắc Plugin Protocol
 * Hub KHÔNG can thiệp vào app con
 * Hub chỉ: soạn code + voice → gọi /execute → nhận kết quả → lưu DB
 */

const VIDEO_CREATOR_URL = "http://localhost:3020";

const code = `
import React from "react";
import {
  AbsoluteFill, Audio, interpolate, useCurrentFrame,
  useVideoConfig, spring, staticFile, Easing,
} from "remotion";

const T = {
  s1: { start: 0, end: 300 },
  s2: { start: 300, end: 700 },
  s3: { start: 700, end: 1100 },
  s4: { start: 1100, end: 1450 },
  s5: { start: 1450, end: 1750 },
};
const FADE = 15;
const F = "'Segoe UI', sans-serif";
const M = "'Cascadia Code', 'Consolas', monospace";

const useL = (t: { start: number }) => useCurrentFrame() - t.start;
const useS = (t: { start: number }, d: number, c?: object) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return spring({ frame: f - t.start - d, fps, config: { damping: 12, stiffness: 100, ...c } });
};

// Scene wrapper with smooth fade
const Sc: React.FC<{ children: React.ReactNode; t: { start: number; end: number } }> = ({ children, t }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [t.start, t.start + FADE, t.end - FADE, t.end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return o > 0 ? <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill> : null;
};

// Floating orb with radial gradient
const Orb: React.FC<{ x: number; y: number; s: number; c: string; sp?: number }> = ({ x, y, s, c, sp = 0.02 }) => {
  const f = useCurrentFrame();
  return <div style={{
    position: "absolute", left: x + Math.sin(f * 0.008 + x) * 45, top: y + Math.cos(f * 0.006 + y) * 35,
    width: s, height: s, borderRadius: "50%",
    background: \`radial-gradient(circle, \${c} 0%, transparent 70%)\`,
    opacity: (Math.sin(f * sp) * 0.3 + 0.7) * 0.25, filter: \`blur(\${s * 0.3}px)\`, pointerEvents: "none",
  }} />;
};

// Shine sweep effect on cards
const Shine: React.FC<{ delay: number; w: number; h: number }> = ({ delay, w, h }) => {
  const f = useCurrentFrame();
  const p = interpolate(f - delay, [0, 45], [-0.3, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (p > -0.2 && p < 1.2) ? (
    <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h, overflow: "hidden", pointerEvents: "none", borderRadius: 28 }}>
      <div style={{ position: "absolute", top: 0, left: \`\${p * 100}%\`, width: 120, height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", transform: "skewX(-20deg)" }} />
    </div>
  ) : null;
};

// Animated bar
const Bar: React.FC<{ label: string; val: number; max: number; color: string; delay: number; highlight?: boolean }> = ({ label, val, max, color, delay, highlight }) => {
  const s = useS({ start: 0 }, delay, { damping: 14, stiffness: 80 });
  const w = interpolate(s, [0, 1], [0, (val / max) * 800]);
  const v = (val * interpolate(s, [0, 1], [0, 1])).toFixed(0);
  return (
    <div style={{ opacity: interpolate(s, [0, 1], [0, 1]), marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "0 6px" }}>
        <span style={{ fontSize: 34, color: highlight ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: F, fontWeight: highlight ? 700 : 500 }}>{label}</span>
        <span style={{ fontSize: 34, color: highlight ? color : "rgba(255,255,255,0.55)", fontFamily: M, fontWeight: 700 }}>{v}%</span>
      </div>
      <div style={{ width: 860, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          width: w, height: "100%", borderRadius: 18,
          background: highlight ? \`linear-gradient(90deg, \${color}, \${color}cc)\` : \`\${color}55\`,
          boxShadow: highlight ? \`0 0 30px \${color}55, 0 0 60px \${color}22\` : "none",
        }} />
      </div>
    </div>
  );
};

// Floating particles
const Particles: React.FC<{ count: number; color: string }> = ({ count, color }) => {
  const f = useCurrentFrame();
  return <>{Array.from({ length: count }).map((_, i) => {
    const x = (Math.sin(i * 2.4 + f * 0.01) * 0.5 + 0.5) * 1080;
    const y = (Math.cos(i * 1.8 + f * 0.008) * 0.5 + 0.5) * 1920;
    const size = 3 + Math.sin(i * 3.1 + f * 0.03) * 2;
    const opacity = 0.2 + Math.sin(i * 2.7 + f * 0.02) * 0.15;
    return <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: "50%", background: color, opacity, pointerEvents: "none" }} />;
  })}</>;
};

// Pulsing ring
const PulseRing: React.FC<{ x: number; y: number; color: string; delay: number }> = ({ x, y, color, delay }) => {
  const f = useCurrentFrame();
  const lf = f - delay;
  if (lf < 0) return null;
  const cycle = lf % 60;
  const scale = interpolate(cycle, [0, 60], [0.5, 2.5]);
  const opacity = interpolate(cycle, [0, 60], [0.4, 0]);
  return <div style={{ position: "absolute", left: x - 50, top: y - 50, width: 100, height: 100, borderRadius: "50%", border: \`3px solid \${color}\`, transform: \`scale(\${scale})\`, opacity, pointerEvents: "none" }} />;
};

// ==========================================
// S1: HOOK — Đang gây bão
// ==========================================
const S1: React.FC = () => {
  const lf = useL(T.s1);
  const s1 = useS(T.s1, 5, { damping: 5, stiffness: 120, mass: 0.6 });
  const s2 = useS(T.s1, 25);
  const s3 = useS(T.s1, 50);
  const s4 = useS(T.s1, 75);
  const lineW = interpolate(lf, [30, 60], [0, 450], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = lf > 85 && lf < 100 ? Math.sin(lf * 3) * 5 : 0;
  const emojiScale = 1 + Math.sin(lf * 0.1) * 0.1;
  const glowPulse = 0.7 + Math.sin(lf * 0.08) * 0.3;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <PulseRing x={540} y={700} color="#7C3AED" delay={T.s1.start + 20} />
      <PulseRing x={540} y={700} color="#06B6D4" delay={T.s1.start + 40} />

      <div style={{
        position: "absolute", top: 280,
        opacity: interpolate(s1, [0, 1], [0, 1]),
        transform: \`scale(\${interpolate(s1, [0, 1], [0.3, 1])}) rotate(\${interpolate(s1, [0, 1], [-10, 0])}deg)\`,
      }}>
        <div style={{
          background: "linear-gradient(135deg, #7C3AED, #EC4899, #06B6D4)",
          borderRadius: 50, padding: "18px 52px",
          boxShadow: \`0 12px 50px rgba(124,58,237,\${glowPulse * 0.5})\`,
        }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: "#fff", fontFamily: F, letterSpacing: 4, textTransform: "uppercase" }}>
            🔥 Đang gây bão
          </span>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "0 50px" }}>
        <div style={{
          opacity: interpolate(s2, [0, 1], [0, 1]),
          transform: \`scale(\${emojiScale})\`,
          fontSize: 100, marginBottom: 10,
        }}>⚡</div>

        <div style={{
          fontSize: 100, fontWeight: 900, fontFamily: F, lineHeight: 1.05,
          opacity: interpolate(s2, [0, 1], [0, 1]),
          transform: \`translateY(\${interpolate(s2, [0, 1], [50, 0])}px)\`,
        }}>
          <span style={{ color: "#fff", textShadow: "0 0 40px rgba(255,255,255,0.3)" }}>Open</span><span style={{
            background: "linear-gradient(90deg, #7C3AED, #EC4899, #06B6D4)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: \`drop-shadow(0 0 20px rgba(124,58,237,\${glowPulse}))\`,
          }}>Code</span>
        </div>
        <div style={{
          fontSize: 52, fontWeight: 700, color: "rgba(255,255,255,0.75)", fontFamily: F,
          opacity: interpolate(s2, [0, 1], [0, 1]),
          transform: \`translateY(\${interpolate(s2, [0, 1], [30, 0])}px)\`,
          marginTop: 12,
        }}>Fork Claude Code cho mọi LLM</div>

        <div style={{ width: lineW, height: 6, borderRadius: 3, background: "linear-gradient(90deg, #7C3AED, #EC4899, #06B6D4)", margin: "30px auto", boxShadow: "0 0 25px rgba(124,58,237,0.5)" }} />

        <div style={{
          display: "flex", justifyContent: "center", gap: 28, marginTop: 10,
          opacity: interpolate(s3, [0, 1], [0, 1]),
        }}>
          {[
            { val: "15K", label: "Likes", color: "#EF4444", icon: "❤️" },
            { val: "1.4K", label: "Retweets", color: "#F97316", icon: "🔄" },
            { val: "1M", label: "Views", color: "#10B981", icon: "👁️" },
          ].map((s, i) => {
            const cardS = useS(T.s1, 55 + i * 10, { damping: 8, stiffness: 90 });
            return (
              <div key={i} style={{
                background: "rgba(255,255,255,0.06)", borderRadius: 24, padding: "20px 28px",
                border: \`1.5px solid \${s.color}44\`, textAlign: "center", minWidth: 160,
                transform: \`scale(\${interpolate(cardS, [0, 1], [0.5, 1])}) translateY(\${interpolate(cardS, [0, 1], [30, 0])}px)\`,
                boxShadow: \`0 4px 20px \${s.color}22\`,
              }}>
                <div style={{ fontSize: 32 }}>{s.icon}</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: s.color, fontFamily: M, marginTop: 4 }}>{s.val}</div>
                <div style={{ fontSize: 24, color: "rgba(255,255,255,0.5)", fontFamily: F, marginTop: 2 }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        <div style={{
          fontSize: 36, color: "rgba(255,255,255,0.45)", fontFamily: F, fontWeight: 500,
          opacity: interpolate(s4, [0, 1], [0, 1]),
          transform: \`translateX(\${shake}px)\`,
          marginTop: 30,
        }}>
          Chỉ trong <span style={{ color: "#F97316", fontWeight: 700 }}>12 giờ</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// S2: LLM được hỗ trợ
// ==========================================
const S2: React.FC = () => {
  const lf = useL(T.s2);
  const specs = [
    { label: "GPT", value: "OpenAI", sub: "GPT-4o, GPT-5 mini", icon: "🤖", color: "#10B981", gradient: "linear-gradient(135deg, #10B981, #059669)" },
    { label: "DeepSeek", value: "V3.2", sub: "Reasoning mạnh nhất", icon: "🔬", color: "#8B5CF6", gradient: "linear-gradient(135deg, #8B5CF6, #7C3AED)" },
    { label: "Gemini", value: "Google", sub: "2.5 Pro/Flash", icon: "💎", color: "#06B6D4", gradient: "linear-gradient(135deg, #06B6D4, #0891B2)" },
    { label: "Llama", value: "Meta", sub: "Open-weight 405B", icon: "🦙", color: "#F59E0B", gradient: "linear-gradient(135deg, #F59E0B, #D97706)" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
      <Particles count={15} color="#7C3AED" />

      <div style={{
        textAlign: "center", marginBottom: 44,
        opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 30, color: "#EC4899", fontFamily: F, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 14 }}>
          ✦ Hỗ trợ đa nền tảng ✦
        </div>
        <div style={{ fontSize: 62, color: "#fff", fontFamily: F, fontWeight: 900, textShadow: "0 0 30px rgba(124,58,237,0.4)" }}>Mọi LLM Đều Chạy Được</div>
        <div style={{ width: 120, height: 5, background: "linear-gradient(90deg, #7C3AED, #EC4899, #06B6D4)", borderRadius: 3, margin: "20px auto 0" }} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 26, width: 1000, justifyContent: "center" }}>
        {specs.map((sp, i) => {
          const s = useS(T.s2, 20 + i * 25, { damping: 9, stiffness: 65 });
          return (
            <div key={i} style={{
              width: 475, background: "rgba(255,255,255,0.04)", border: \`2px solid \${sp.color}40\`,
              borderRadius: 28, padding: "36px 32px", position: "relative", overflow: "hidden",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: \`translateY(\${interpolate(s, [0, 1], [60, 0])}px) scale(\${interpolate(s, [0, 1], [0.85, 1])})\`,
              boxShadow: \`0 8px 30px \${sp.color}15\`,
            }}>
              <Shine delay={T.s2.start + 20 + i * 25 + 15} w={475} h={150} />
              <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: sp.gradient, opacity: 0.15, borderRadius: "0 28px 0 80px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 48, filter: \`drop-shadow(0 0 10px \${sp.color}66)\` }}>{sp.icon}</div>
                <span style={{ fontSize: 30, color: sp.color, fontFamily: F, fontWeight: 700, textTransform: "uppercase", letterSpacing: 3 }}>{sp.label}</span>
              </div>
              <div style={{ fontSize: 48, fontWeight: 900, color: "#fff", fontFamily: F }}>{sp.value}</div>
              <div style={{ fontSize: 28, color: "rgba(255,255,255,0.45)", fontFamily: F, marginTop: 8 }}>{sp.sub}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// S3: Tại sao quan trọng — Benchmark bars
// ==========================================
const S3: React.FC = () => {
  const lf = useL(T.s3);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 180 }}>
      <div style={{
        textAlign: "center", marginBottom: 40,
        opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 30, color: "#10B981", fontFamily: F, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 14 }}>
          ✦ Phân tích ✦
        </div>
        <div style={{ fontSize: 58, color: "#fff", fontFamily: F, fontWeight: 900, textShadow: "0 0 30px rgba(16,185,129,0.4)" }}>Tại Sao Đây Là Tin Lớn</div>
        <div style={{ width: 120, height: 5, background: "linear-gradient(90deg, #10B981, #06B6D4)", borderRadius: 3, margin: "20px auto 0" }} />
      </div>

      <div style={{ width: 920, marginTop: 10 }}>
        <div style={{ fontSize: 36, color: "#F59E0B", fontFamily: F, fontWeight: 700, marginBottom: 18, opacity: interpolate(lf, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          🎯 Mức độ ảnh hưởng
        </div>
        <Bar label="Phá vỡ Vendor Lock-in" val={95} max={100} color="#10B981" delay={T.s3.start + 30} highlight />
        <Bar label="Tiết kiệm chi phí" val={85} max={100} color="#06B6D4" delay={T.s3.start + 50} />
        <Bar label="Open-source mạnh mẽ" val={92} max={100} color="#8B5CF6" delay={T.s3.start + 70} highlight />

        <div style={{ height: 36 }} />

        <div style={{ fontSize: 36, color: "#F59E0B", fontFamily: F, fontWeight: 700, marginBottom: 18, opacity: interpolate(lf, [160, 175], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          📊 Phản hồi cộng đồng
        </div>
        <Bar label="15,000 Likes" val={75} max={100} color="#EF4444" delay={T.s3.start + 170} highlight />
        <Bar label="1,400 Retweets" val={70} max={100} color="#F97316" delay={T.s3.start + 190} />
        <Bar label="1,000,000 Views" val={95} max={100} color="#EC4899" delay={T.s3.start + 210} highlight />
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// S4: Cơ hội cho Dev Việt Nam
// ==========================================
const S4: React.FC = () => {
  const lf = useL(T.s4);
  const pros = [
    { text: "Dùng LLM rẻ nhất mà vẫn mạnh", icon: "💰", color: "#10B981" },
    { text: "Không bị khóa với 1 nhà cung cấp", icon: "🔓", color: "#8B5CF6" },
    { text: "Cộng đồng Việt Nam đóng góp được", icon: "🇻🇳", color: "#EF4444" },
    { text: "Chạy local hoặc cloud tùy ý", icon: "☁️", color: "#06B6D4" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
      <Particles count={10} color="#F59E0B" />

      <div style={{
        textAlign: "center", marginBottom: 44,
        opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 90, filter: "drop-shadow(0 0 20px rgba(245,158,11,0.5))" }}>🇻🇳</div>
        <div style={{ fontSize: 58, color: "#fff", fontFamily: F, fontWeight: 900, marginTop: 16, textShadow: "0 0 30px rgba(245,158,11,0.4)" }}>Cơ Hội Cho Dev Việt Nam</div>
        <div style={{ width: 120, height: 5, background: "linear-gradient(90deg, #F59E0B, #EF4444)", borderRadius: 3, margin: "20px auto 0" }} />
      </div>

      <div style={{ width: 940 }}>
        {pros.map((p, i) => {
          const s = useS(T.s4, 25 + i * 22);
          return (
            <div key={i} style={{
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: \`translateX(\${interpolate(s, [0, 1], [-80, 0])}px)\`,
              display: "flex", alignItems: "center", gap: 22, marginBottom: 22,
              background: "rgba(255,255,255,0.03)", borderRadius: 22, padding: "22px 28px",
              border: \`1.5px solid \${p.color}30\`,
              boxShadow: \`0 4px 20px \${p.color}10\`,
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, background: \`\${p.color}20\`, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 34, flexShrink: 0 }}>{p.icon}</div>
              <span style={{ fontSize: 38, color: "#fff", fontFamily: F, fontWeight: 600 }}>{p.text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// S5: CTA — tintucai.vn
// ==========================================
const S5: React.FC = () => {
  const lf = useL(T.s5);
  const s1 = useS(T.s5, 5);
  const s2 = useS(T.s5, 30, { damping: 6, stiffness: 60 });
  const s3 = useS(T.s5, 55);
  const pulse = 1 + Math.sin(lf * 0.08) * 0.03;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <PulseRing x={540} y={960} color="#7C3AED" delay={T.s5.start + 10} />
      <PulseRing x={540} y={960} color="#06B6D4" delay={T.s5.start + 30} />
      <PulseRing x={540} y={960} color="#EC4899" delay={T.s5.start + 50} />

      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 52, color: "#fff", fontFamily: F, fontWeight: 700,
          opacity: interpolate(s1, [0, 1], [0, 1]),
          transform: \`translateY(\${interpolate(s1, [0, 1], [40, 0])}px)\`,
        }}>Trên đây là đánh giá chi tiết</div>

        <div style={{
          fontSize: 42, color: "rgba(255,255,255,0.6)", fontFamily: F,
          opacity: interpolate(s1, [0, 1], [0, 1]),
          marginTop: 16,
        }}>Ghé website để xem thêm nhé</div>

        <div style={{
          marginTop: 55,
          transform: \`scale(\${interpolate(s2, [0, 1], [0.2, 1]) * pulse})\`,
        }}>
          <div style={{
            background: "linear-gradient(135deg, #7C3AED, #EC4899, #06B6D4)",
            borderRadius: 60, padding: "28px 72px", display: "inline-block",
            boxShadow: "0 12px 60px rgba(124,58,237,0.5), 0 0 100px rgba(236,72,153,0.2)",
          }}>
            <span style={{ fontSize: 60, fontWeight: 900, color: "#fff", fontFamily: F, letterSpacing: 2 }}>tintucai.vn</span>
          </div>
        </div>

        <div style={{
          fontSize: 40, color: "rgba(255,255,255,0.55)", fontFamily: F,
          opacity: interpolate(s3, [0, 1], [0, 1]),
          transform: \`translateY(\${interpolate(s3, [0, 1], [20, 0])}px)\`,
          marginTop: 45,
        }}>Follow kênh để cập nhật tin tức AI mới nhất 🔔</div>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// MAIN
// ==========================================
export const TikTokVideo = () => {
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #080818 0%, #0f172a 50%, #111827 100%)" }}>
      <Audio src={staticFile("voiceover.mp3")} />
      <Orb x={100} y={250} s={550} c="#7C3AED" />
      <Orb x={850} y={180} s={450} c="#06B6D4" sp={0.015} />
      <Orb x={500} y={1200} s={650} c="#10B981" sp={0.01} />
      <Orb x={200} y={1500} s={350} c="#EC4899" sp={0.018} />
      <Orb x={800} y={900} s={400} c="#F59E0B" sp={0.012} />

      <Sc t={T.s1}><S1 /></Sc>
      <Sc t={T.s2}><S2 /></Sc>
      <Sc t={T.s3}><S3 /></Sc>
      <Sc t={T.s4}><S4 /></Sc>
      <Sc t={T.s5}><S5 /></Sc>

      <div style={{ position: "absolute", bottom: 45, left: 0, right: 0, textAlign: "center", fontSize: 28, color: "rgba(255,255,255,0.25)", fontFamily: "'Segoe UI', sans-serif", letterSpacing: 3 }}>tintucai.vn</div>
    </AbsoluteFill>
  );
};
`;

const voice_scripts = [
  { id: "scene1_hook", text: "Một dự án mới vừa gây bão cộng đồng AI toàn cầu. Mười lăm nghìn likes và một triệu lượt xem, chỉ trong mười hai giờ đồng hồ. Đó chính là OpenCode.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "scene2_what", text: "OpenCode là phiên bản mã nguồn mở của Claude Code. Nhưng khác biệt lớn nhất, là nó hoạt động được với bất kỳ mô hình AI nào. GPT, DeepSeek, Gemini, Llama, hay MiniMax, tất cả đều chạy được.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "scene3_why", text: "Đây là tin lớn vì ba lý do. Thứ nhất, phá vỡ hoàn toàn vendor lock-in, bạn không còn bị phụ thuộc vào một nhà cung cấp. Thứ hai, tiết kiệm chi phí đáng kể. Và thứ ba, mã nguồn mở, cộng đồng phát triển rất nhanh.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "scene4_vn", text: "Với developer Việt Nam, đây là cơ hội lớn. Bạn có thể dùng LLM rẻ nhất mà vẫn mạnh. Không bị khóa với một nhà cung cấp. Và cộng đồng Việt Nam hoàn toàn có thể đóng góp.", voice: "vi-VN-NamMinhNeural", rate: "+10%", pitch: "-5Hz", engine: "edge" as const },
  { id: "scene5_cta", text: "Trên đây là đánh giá chi tiết về OpenCode. Để xem thêm, các bạn có thể ghé website tintucai.vn nhé. Follow kênh để cập nhật tin tức AI mới nhất.", voice: "vi-VN-NamMinhNeural", rate: "-2%", pitch: "-5Hz", engine: "edge" as const }
];

// Tên file: chủ đề + ngày
const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputName = `OpenCode_Review_${today}`;

async function main() {
  console.log("=== Hub → video-creator /execute ===");
  console.log("Output name:", outputName);

  const res = await fetch(VIDEO_CREATOR_URL + "/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capability_id: "render-video",
      input: { code, voice_scripts, output_name: outputName }
    })
  });

  const data = await res.json() as any;
  console.log("Job:", data.job_id);

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const poll = await fetch(VIDEO_CREATOR_URL + "/jobs/" + data.job_id).then(r => r.json()) as any;
    console.log(`[${(i+1)*5}s] ${poll.status}`);
    if (poll.status === "completed") {
      console.log("\n✅ Video:", poll.result.video_path);
      console.log("Duration:", poll.result.duration_seconds + "s");
      console.log("Size:", (poll.result.file_size_bytes / 1024 / 1024).toFixed(1) + "MB");
      return;
    }
    if (poll.status === "failed") {
      console.error("❌ FAILED:", poll.error);
      return;
    }
  }
}

main().catch(e => console.error("Error:", e.message));
