import { renderVideo } from "../src/lib/render.js";

const code = `
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig, Sequence, Easing } from "remotion";
import React from "react";

const BRAND = "tintucai.vn";

// === ANIMATED COMPONENTS ===

// Glow orb with breathing animation
const Glow = ({ color, x, y, size, speed = 20 }: any) => {
  const frame = useCurrentFrame();
  const s = size + Math.sin(frame / speed) * 50;
  const moveX = Math.sin(frame / 40) * 30;
  const moveY = Math.cos(frame / 35) * 20;
  return <div style={{ position: "absolute", left: x - s/2 + moveX, top: y - s/2 + moveY, width: s, height: s,
    borderRadius: "50%", background: color, filter: "blur(90px)", opacity: 0.35 + Math.sin(frame / 25) * 0.1 }} />;
};

// Animated progress bar with spring
const AnimBar = ({ width, color, delay = 0 }: any) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80 } }) * width;
  return (
    <div style={{ height: 16, borderRadius: 8, background: "rgba(255,255,255,0.08)", marginTop: 14, overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 8, background: \`linear-gradient(90deg, \${color}, \${color}88)\`, width: w + "%",
        boxShadow: \`0 0 20px \${color}66\` }} />
    </div>
  );
};

// Text that fades in and slides up
const FadeUp = ({ children, delay = 0, style = {} }: any) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 100 } });
  const y = interpolate(progress, [0, 1], [60, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  return <div style={{ transform: \`translateY(\${y}px)\`, opacity, ...style }}>{children}</div>;
};

// Scale in animation
const ScaleIn = ({ children, delay = 0, style = {} }: any) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: frame - delay, fps, config: { damping: 10, stiffness: 120 } });
  const opacity = interpolate(scale, [0, 0.5, 1], [0, 0.8, 1]);
  return <div style={{ transform: \`scale(\${scale})\`, opacity, ...style }}>{children}</div>;
};

// Shine sweep effect on cards
const ShineCard = ({ children, delay = 0, style = {} }: any) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 15 } });
  const shineX = interpolate(frame - delay - 15, [0, 30], [-100, 200], { extrapolateRight: "clamp" });
  return (
    <div style={{ opacity: enter, transform: \`translateX(\${(1 - enter) * 80}px)\`, position: "relative", overflow: "hidden", ...style }}>
      {children}
      <div style={{ position: "absolute", top: 0, left: shineX + "%", width: "30%", height: "100%",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
        pointerEvents: "none" }} />
    </div>
  );
};

// Counter animation
const AnimCounter = ({ value, delay = 0, suffix = "" }: any) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 20 } });
  const num = Math.round(progress * value);
  return <span>{num.toLocaleString()}{suffix}</span>;
};

// Scene wrapper with fade transition
const Scene = ({ from, dur, bg, children }: any) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [from, from + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Sequence from={from} durationInFrames={dur}>
      <AbsoluteFill style={{ background: bg, padding: 60, overflow: "hidden", opacity: fadeIn }}>
        {children}
        <div style={{ position: "absolute", bottom: 50, left: 0, right: 0, textAlign: "center",
          fontSize: 30, color: "rgba(255,255,255,0.4)", fontFamily: "Arial", letterSpacing: 2 }}>{BRAND}</div>
      </AbsoluteFill>
    </Sequence>
  );
};

// === MAIN VIDEO ===
export const TikTokVideo: React.FC<{ timings?: any }> = ({ timings: T = { s1: 180, s2: 480, s3: 750, s4: 960, s5: 1200 } }) => {
  return (
    <AbsoluteFill style={{ background: "#0a0a1a" }}>

      {/* ===== SCENE 1: HOOK ===== */}
      <Scene from={0} dur={T.s1} bg="linear-gradient(135deg, #0f0c29, #302b63, #24243e)">
        <Glow color="#7c3aed" x={200} y={350} size={350} />
        <Glow color="#06b6d4" x={850} y={250} size={280} speed={25} />
        <Glow color="#ec4899" x={500} y={800} size={200} speed={30} />
        <div style={{ marginTop: 280, textAlign: "center" }}>
          <ScaleIn delay={5}>
            <div style={{ fontSize: 130, marginBottom: 20 }}>🔥</div>
          </ScaleIn>
          <FadeUp delay={12}>
            <div style={{ fontSize: 80, fontWeight: 900, color: "#fff", fontFamily: "Arial",
              textShadow: "0 0 60px rgba(124,58,237,0.9), 0 0 120px rgba(124,58,237,0.4)",
              letterSpacing: -2 }}>OpenCode</div>
          </FadeUp>
          <FadeUp delay={20}>
            <div style={{ fontSize: 44, color: "#c4b5fd", marginTop: 16, fontFamily: "Arial", fontWeight: 300 }}>
              Bão AI Mới — 1 Triệu Views
            </div>
          </FadeUp>
          <FadeUp delay={30} style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 50 }}>
            {["15K ❤️", "1.4K 🔄", "1M 👁️"].map((s, i) => (
              <ScaleIn key={i} delay={35 + i * 5}>
                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 18, padding: "18px 30px",
                  fontSize: 38, color: "#fff", fontFamily: "Arial", border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)" }}>{s}</div>
              </ScaleIn>
            ))}
          </FadeUp>
        </div>
      </Scene>

      {/* ===== SCENE 2: WHAT IS OPENCODE ===== */}
      <Scene from={T.s1} dur={T.s2 - T.s1} bg="linear-gradient(135deg, #0a192f, #172a45)">
        <Glow color="#06b6d4" x={540} y={500} size={450} />
        <Glow color="#7c3aed" x={200} y={800} size={200} speed={18} />
        <div style={{ marginTop: 200 }}>
          <FadeUp delay={5}>
            <div style={{ fontSize: 60, fontWeight: 900, color: "#fff", textAlign: "center", fontFamily: "Arial",
              textShadow: "0 0 30px rgba(6,182,212,0.5)" }}>OpenCode là gì?</div>
          </FadeUp>
          <ShineCard delay={15} style={{ marginTop: 50, background: "rgba(255,255,255,0.04)", borderRadius: 28,
            padding: 44, border: "1px solid rgba(255,255,255,0.08)" }}>
            <FadeUp delay={20}>
              <div style={{ fontSize: 40, color: "#e2e8f0", lineHeight: 1.7, fontFamily: "Arial" }}>
                Fork mã nguồn mở từ <span style={{ color: "#7c3aed", fontWeight: 700 }}>Claude Code</span>
              </div>
            </FadeUp>
            <FadeUp delay={28}>
              <div style={{ fontSize: 40, color: "#22d3ee", marginTop: 24, fontFamily: "Arial", fontWeight: 600 }}>
                → Hoạt động với BẤT KỲ LLM nào
              </div>
            </FadeUp>
          </ShineCard>
          <FadeUp delay={38} style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 44, justifyContent: "center" }}>
            {["GPT", "DeepSeek", "Gemini", "Llama", "MiniMax"].map((m, i) => (
              <ScaleIn key={i} delay={40 + i * 4}>
                <div style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)", borderRadius: 50,
                  padding: "16px 36px", fontSize: 36, color: "#fff", fontWeight: 700, fontFamily: "Arial",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>{m}</div>
              </ScaleIn>
            ))}
          </FadeUp>
        </div>
      </Scene>

      {/* ===== SCENE 3: WHY IT MATTERS ===== */}
      <Scene from={T.s2} dur={T.s3 - T.s2} bg="linear-gradient(135deg, #0d1b2a, #1b2838)">
        <Glow color="#10b981" x={300} y={400} size={350} />
        <Glow color="#3b82f6" x={800} y={700} size={250} speed={22} />
        <div style={{ marginTop: 200 }}>
          <FadeUp delay={5}>
            <div style={{ fontSize: 56, fontWeight: 900, color: "#fff", textAlign: "center", fontFamily: "Arial",
              textShadow: "0 0 30px rgba(16,185,129,0.5)" }}>Tại sao đây là tin lớn?</div>
          </FadeUp>
          {[
            { icon: "🔓", text: "Phá vỡ vendor lock-in", sub: "Không phụ thuộc 1 nhà cung cấp AI", pct: 95, color: "#10b981" },
            { icon: "💰", text: "Tiết kiệm chi phí", sub: "Dùng LLM rẻ nhất mà vẫn hiệu quả", pct: 85, color: "#06b6d4" },
            { icon: "🚀", text: "Mã nguồn mở hoàn toàn", sub: "Cộng đồng đóng góp, phát triển nhanh", pct: 90, color: "#8b5cf6" }
          ].map((item, i) => (
            <ShineCard key={i} delay={15 + i * 12} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 22,
              padding: "30px 36px", marginTop: 26, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <span style={{ fontSize: 48 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 38, fontWeight: 700, color: "#fff", fontFamily: "Arial" }}>{item.text}</div>
                  <div style={{ fontSize: 28, color: "#94a3b8", fontFamily: "Arial", marginTop: 4 }}>{item.sub}</div>
                  <AnimBar width={item.pct} color={item.color} delay={20 + i * 12} />
                </div>
              </div>
            </ShineCard>
          ))}
        </div>
      </Scene>

      {/* ===== SCENE 4: FOR VN DEVS ===== */}
      <Scene from={T.s3} dur={T.s4 - T.s3} bg="linear-gradient(135deg, #1a0a2e, #2d1b69)">
        <Glow color="#f59e0b" x={540} y={400} size={400} />
        <Glow color="#ec4899" x={200} y={700} size={250} speed={28} />
        <div style={{ marginTop: 260, textAlign: "center" }}>
          <ScaleIn delay={5}>
            <div style={{ fontSize: 90 }}>🇻🇳</div>
          </ScaleIn>
          <FadeUp delay={12}>
            <div style={{ fontSize: 58, fontWeight: 900, color: "#fff", marginTop: 24, fontFamily: "Arial",
              textShadow: "0 0 30px rgba(245,158,11,0.5)" }}>Cơ hội cho Developer Việt Nam</div>
          </FadeUp>
          <ShineCard delay={22} style={{ background: "rgba(245,158,11,0.1)", borderRadius: 28, padding: 44,
            marginTop: 44, border: "1px solid rgba(245,158,11,0.25)" }}>
            <FadeUp delay={26}>
              <div style={{ fontSize: 40, color: "#fbbf24", lineHeight: 1.6, fontFamily: "Arial", fontWeight: 600 }}>
                Tiếp cận công cụ AI coding hàng đầu thế giới
              </div>
            </FadeUp>
            <FadeUp delay={34}>
              <div style={{ fontSize: 36, color: "#e2e8f0", marginTop: 20, fontFamily: "Arial" }}>
                Không cần trả phí cao cho từng nền tảng
              </div>
            </FadeUp>
          </ShineCard>
        </div>
      </Scene>

      {/* ===== SCENE 5: CTA ===== */}
      <Scene from={T.s4} dur={T.s5 - T.s4} bg="linear-gradient(135deg, #0f0c29, #302b63, #24243e)">
        <Glow color="#7c3aed" x={540} y={500} size={500} />
        <Glow color="#06b6d4" x={300} y={700} size={300} speed={20} />
        <div style={{ marginTop: 300, textAlign: "center" }}>
          <FadeUp delay={5}>
            <div style={{ fontSize: 54, fontWeight: 900, color: "#fff", fontFamily: "Arial" }}>
              Trên đây là đánh giá chi tiết
            </div>
          </FadeUp>
          <FadeUp delay={15}>
            <div style={{ fontSize: 42, color: "#c4b5fd", marginTop: 28, fontFamily: "Arial" }}>
              Ghé website để xem thêm nhé
            </div>
          </FadeUp>
          <ScaleIn delay={25}>
            <div style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)", borderRadius: 60,
              padding: "26px 64px", fontSize: 52, color: "#fff", fontWeight: 900, display: "inline-block",
              marginTop: 50, fontFamily: "Arial", boxShadow: "0 8px 40px rgba(124,58,237,0.5)" }}>
              tintucai.vn
            </div>
          </ScaleIn>
          <FadeUp delay={35}>
            <div style={{ fontSize: 38, color: "#94a3b8", marginTop: 44, fontFamily: "Arial" }}>
              Follow kênh để cập nhật tin tức AI mới nhất 🔔
            </div>
          </FadeUp>
        </div>
      </Scene>
    </AbsoluteFill>
  );
};
`;

const voices = [
  { id: "scene1_hook", text: "Một dự án mới vừa gây bão cộng đồng AI toàn cầu. Mười lăm nghìn likes và một triệu lượt xem, chỉ trong mười hai giờ đồng hồ." },
  { id: "scene2_what", text: "OpenCode là phiên bản mã nguồn mở của Claude Code. Nhưng khác biệt lớn nhất, là nó hoạt động được với bất kỳ mô hình AI nào. GPT, DeepSeek, Gemini, Llama, hay MiniMax, tất cả đều chạy được." },
  { id: "scene3_why", text: "Đây là tin lớn vì ba lý do. Thứ nhất, phá vỡ hoàn toàn vendor lock-in, bạn không còn bị phụ thuộc vào một nhà cung cấp. Thứ hai, tiết kiệm chi phí đáng kể. Thứ ba, mã nguồn mở, cộng đồng phát triển rất nhanh." },
  { id: "scene4_vn", text: "Với developer Việt Nam, đây là cơ hội lớn. Tiếp cận công cụ AI coding hàng đầu thế giới, mà không phải trả phí cao cho từng nền tảng riêng." },
  { id: "scene5_cta", text: "Trên đây là đánh giá chi tiết về OpenCode. Để xem thêm, các bạn có thể ghé website tintucai.vn nhé. Follow kênh để cập nhật tin tức AI mới nhất." }
];

async function main() {
  console.log("Rendering OpenCode video (PRO quality)...");
  const result = await renderVideo({ code, voice_scripts: voices });
  console.log("✅ Video:", result.video_path);
  console.log("Duration:", result.duration_seconds + "s | Size:", (result.file_size_bytes / 1024 / 1024).toFixed(1) + "MB");
}
main().catch(e => console.error("Error:", e.message));
