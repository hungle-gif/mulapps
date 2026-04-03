import React from "react";
import {
  AbsoluteFill, Audio, interpolate, useCurrentFrame,
  useVideoConfig, spring, staticFile,
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
    background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
    opacity: (Math.sin(f * sp) * 0.3 + 0.7) * 0.2, filter: `blur(${s * 0.3}px)`, pointerEvents: "none",
  }} />;
};

const Shine: React.FC<{ delay: number; w: number; h: number }> = ({ delay, w, h }) => {
  const f = useCurrentFrame();
  const p = interpolate(f - delay, [0, 45], [-0.3, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (p > -0.2 && p < 1.2) ? (
    <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h, overflow: "hidden", pointerEvents: "none", borderRadius: 28 }}>
      <div style={{ position: "absolute", top: 0, left: `${p * 100}%`, width: 100, height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)", transform: "skewX(-20deg)" }} />
    </div>
  ) : null;
};

const Bar: React.FC<{ label: string; val: number; max: number; color: string; delay: number; highlight?: boolean }> = ({ label, val, max, color, delay, highlight }) => {
  const s = useS({ start: 0 }, delay, { damping: 14, stiffness: 80 });
  const w = interpolate(s, [0, 1], [0, (val / max) * 800]);
  const v = (val * interpolate(s, [0, 1], [0, 1])).toFixed(0);
  return (
    <div style={{ opacity: interpolate(s, [0, 1], [0, 1]), marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "0 6px" }}>
        <span style={{ fontSize: 34, color: highlight ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: F, fontWeight: highlight ? 700 : 500 }}>{label}</span>
        <span style={{ fontSize: 34, color: highlight ? color : "rgba(255,255,255,0.55)", fontFamily: M, fontWeight: 700 }}>{v}%</span>
      </div>
      <div style={{ width: 860, height: 34, borderRadius: 17, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          width: w, height: "100%", borderRadius: 17,
          background: highlight ? `linear-gradient(90deg, ${color}, ${color}cc)` : `${color}55`,
          boxShadow: highlight ? `0 0 25px ${color}44` : "none",
        }} />
      </div>
    </div>
  );
};

// S1: HOOK
const S1: React.FC = () => {
  const lf = useL(T.s1);
  const s1 = useS(T.s1, 5, { damping: 5, stiffness: 120, mass: 0.6 });
  const s2 = useS(T.s1, 30);
  const s3 = useS(T.s1, 60);
  const lineW = interpolate(lf, [35, 65], [0, 400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = lf > 75 && lf < 90 ? Math.sin(lf * 3) * 4 : 0;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{
        position: "absolute", top: 300,
        opacity: interpolate(s1, [0, 1], [0, 1]),
        transform: `scale(${interpolate(s1, [0, 1], [0.4, 1])})`,
      }}>
        <div style={{
          background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
          borderRadius: 40, padding: "16px 48px",
          boxShadow: "0 12px 40px rgba(124,58,237,0.4)",
        }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#fff", fontFamily: F, letterSpacing: 4, textTransform: "uppercase" }}>
            🔥 Đang gây bão
          </span>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "0 60px" }}>
        <div style={{
          fontSize: 100, fontWeight: 900, fontFamily: F, lineHeight: 1.1,
          opacity: interpolate(s2, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(s2, [0, 1], [40, 0])}px)`,
        }}>
          <span style={{ color: "#fff" }}>Open</span><span style={{
            background: "linear-gradient(90deg, #7C3AED, #06B6D4)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Code</span>
        </div>
        <div style={{
          fontSize: 50, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: F,
          opacity: interpolate(s2, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(s2, [0, 1], [30, 0])}px)`,
          marginTop: 8,
        }}>Fork Claude Code cho mọi LLM</div>

        <div style={{ width: lineW, height: 5, borderRadius: 3, background: "linear-gradient(90deg, #7C3AED, #06B6D4)", margin: "28px auto", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }} />

        <div style={{
          fontSize: 38, color: "rgba(255,255,255,0.5)", fontFamily: F, fontWeight: 500,
          opacity: interpolate(s3, [0, 1], [0, 1]),
          transform: `translateX(${shake}px)`,
        }}>
          <span style={{ color: "#EF4444", fontWeight: 700 }}>15K</span> likes · <span style={{ color: "#F97316", fontWeight: 700 }}>1M</span> views · 12 giờ
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S2: LLM được hỗ trợ
const S2: React.FC = () => {
  const lf = useL(T.s2);
  const specs = [
    { label: "GPT", value: "OpenAI", sub: "GPT-4o, GPT-5 mini", icon: "🤖", color: "#10B981" },
    { label: "DeepSeek", value: "V3.2", sub: "Reasoning mạnh nhất", icon: "🔬", color: "#8B5CF6" },
    { label: "Gemini", value: "Google", sub: "2.5 Pro / Flash", icon: "💎", color: "#06B6D4" },
    { label: "Llama", value: "Meta", sub: "Open-weight 405B", icon: "🦙", color: "#F59E0B" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 220 }}>
      <div style={{
        textAlign: "center", marginBottom: 50,
        opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 28, color: "#7C3AED", fontFamily: F, fontWeight: 700, letterSpacing: 5, textTransform: "uppercase", marginBottom: 14 }}>
          ✦ Hỗ trợ đa nền tảng ✦
        </div>
        <div style={{ fontSize: 58, color: "#fff", fontFamily: F, fontWeight: 900 }}>Mọi LLM Đều Chạy Được</div>
        <div style={{ width: 100, height: 4, background: "linear-gradient(90deg, #7C3AED, #06B6D4)", borderRadius: 2, margin: "18px auto 0" }} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, width: 980, justifyContent: "center" }}>
        {specs.map((sp, i) => {
          const s = useS(T.s2, 25 + i * 30, { damping: 9, stiffness: 65 });
          return (
            <div key={i} style={{
              width: 465, background: "rgba(255,255,255,0.04)", border: `1.5px solid ${sp.color}33`,
              borderRadius: 28, padding: "32px 28px", position: "relative", overflow: "hidden",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
            }}>
              <Shine delay={T.s2.start + 25 + i * 30 + 15} w={465} h={140} />
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <span style={{ fontSize: 44 }}>{sp.icon}</span>
                <span style={{ fontSize: 28, color: sp.color, fontFamily: F, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2 }}>{sp.label}</span>
              </div>
              <div style={{ fontSize: 46, fontWeight: 900, color: "#fff", fontFamily: M }}>{sp.value}</div>
              <div style={{ fontSize: 26, color: "rgba(255,255,255,0.4)", fontFamily: F, marginTop: 6 }}>{sp.sub}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// S3: Tại sao quan trọng
const S3: React.FC = () => {
  const lf = useL(T.s3);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
      <div style={{
        textAlign: "center", marginBottom: 40,
        opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 28, color: "#10B981", fontFamily: F, fontWeight: 700, letterSpacing: 5, textTransform: "uppercase", marginBottom: 14 }}>
          ✦ Phân tích ✦
        </div>
        <div style={{ fontSize: 54, color: "#fff", fontFamily: F, fontWeight: 900 }}>Tại Sao Đây Là Tin Lớn</div>
        <div style={{ width: 100, height: 4, background: "linear-gradient(90deg, #10B981, #06B6D4)", borderRadius: 2, margin: "18px auto 0" }} />
      </div>

      <div style={{ width: 920, marginTop: 10 }}>
        <div style={{ fontSize: 34, color: "#F59E0B", fontFamily: F, fontWeight: 700, marginBottom: 16, opacity: interpolate(lf, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          🎯 Mức độ ảnh hưởng
        </div>
        <Bar label="Phá vỡ Vendor Lock-in" val={95} max={100} color="#10B981" delay={T.s3.start + 30} highlight />
        <Bar label="Tiết kiệm chi phí" val={85} max={100} color="#06B6D4" delay={T.s3.start + 50} />
        <Bar label="Cộng đồng Open-source" val={92} max={100} color="#8B5CF6" delay={T.s3.start + 70} highlight />

        <div style={{ height: 30 }} />

        <div style={{ fontSize: 34, color: "#F59E0B", fontFamily: F, fontWeight: 700, marginBottom: 16, opacity: interpolate(lf, [160, 175], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          📊 Phản hồi cộng đồng
        </div>
        <Bar label="15,000 Likes" val={75} max={100} color="#EF4444" delay={T.s3.start + 170} highlight />
        <Bar label="1,400 Retweets" val={70} max={100} color="#F97316" delay={T.s3.start + 190} />
        <Bar label="1,000,000 Views" val={95} max={100} color="#EC4899" delay={T.s3.start + 210} highlight />
      </div>
    </AbsoluteFill>
  );
};

// S4: Cơ hội cho Dev Việt Nam
const S4: React.FC = () => {
  const lf = useL(T.s4);
  const pros = [
    "Dùng LLM rẻ nhất mà vẫn mạnh",
    "Không bị khóa với 1 nhà cung cấp",
    "Cộng đồng Việt Nam đóng góp được",
    "Chạy local hoặc cloud tùy ý",
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 220 }}>
      <div style={{
        textAlign: "center", marginBottom: 40,
        opacity: interpolate(lf, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 80 }}>🇻🇳</div>
        <div style={{ fontSize: 54, color: "#fff", fontFamily: F, fontWeight: 900, marginTop: 16 }}>Cơ Hội Cho Dev Việt Nam</div>
        <div style={{ width: 100, height: 4, background: "linear-gradient(90deg, #F59E0B, #EF4444)", borderRadius: 2, margin: "18px auto 0" }} />
      </div>

      <div style={{ width: 920 }}>
        {pros.map((p, i) => {
          const s = useS(T.s4, 30 + i * 25);
          return (
            <div key={i} style={{
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(s, [0, 1], [-50, 0])}px)`,
              display: "flex", alignItems: "center", gap: 18, marginBottom: 18,
            }}>
              <div style={{ width: 46, height: 46, borderRadius: 23, background: "#10B981", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 26, color: "#fff", fontWeight: 700, fontFamily: F, flexShrink: 0 }}>✓</div>
              <span style={{ fontSize: 38, color: "#fff", fontFamily: F, fontWeight: 500 }}>{p}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// S5: CTA
const S5: React.FC = () => {
  const s1 = useS(T.s5, 5);
  const s2 = useS(T.s5, 30, { damping: 6, stiffness: 60 });
  const s3 = useS(T.s5, 55);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 50, color: "#fff", fontFamily: F, fontWeight: 700,
          opacity: interpolate(s1, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(s1, [0, 1], [30, 0])}px)`,
        }}>Trên đây là đánh giá chi tiết</div>

        <div style={{
          fontSize: 40, color: "rgba(255,255,255,0.6)", fontFamily: F,
          opacity: interpolate(s1, [0, 1], [0, 1]),
          marginTop: 16,
        }}>Ghé website để xem thêm nhé</div>

        <div style={{
          marginTop: 50,
          transform: `scale(${interpolate(s2, [0, 1], [0.3, 1])})`,
        }}>
          <div style={{
            background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
            borderRadius: 60, padding: "24px 64px", display: "inline-block",
            boxShadow: "0 12px 50px rgba(124,58,237,0.5)",
          }}>
            <span style={{ fontSize: 56, fontWeight: 900, color: "#fff", fontFamily: F }}>tintucai.vn</span>
          </div>
        </div>

        <div style={{
          fontSize: 38, color: "rgba(255,255,255,0.5)", fontFamily: F,
          opacity: interpolate(s3, [0, 1], [0, 1]),
          marginTop: 40,
        }}>Follow kênh để cập nhật tin tức AI mới nhất 🔔</div>
      </div>
    </AbsoluteFill>
  );
};

// MAIN
export const TikTokVideo = () => {
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0a0a1a 0%, #111827 100%)" }}>
      <Audio src={staticFile("voiceover.mp3")} />
      <Orb x={150} y={300} s={500} c="#7C3AED" />
      <Orb x={800} y={200} s={400} c="#06B6D4" sp={0.015} />
      <Orb x={500} y={1300} s={600} c="#10B981" sp={0.01} />

      <Sc t={T.s1}><S1 /></Sc>
      <Sc t={T.s2}><S2 /></Sc>
      <Sc t={T.s3}><S3 /></Sc>
      <Sc t={T.s4}><S4 /></Sc>
      <Sc t={T.s5}><S5 /></Sc>

      <div style={{ position: "absolute", bottom: 50, left: 0, right: 0, textAlign: "center", fontSize: 28, color: "rgba(255,255,255,0.3)", fontFamily: "'Segoe UI', sans-serif", letterSpacing: 2 }}>tintucai.vn</div>
    </AbsoluteFill>
  );
};
