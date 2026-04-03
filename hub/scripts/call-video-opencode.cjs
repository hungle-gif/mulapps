/**
 * Hub gọi video-creator — OpenCode Review
 * Dùng http module (fetch lỗi trên Windows với payload lớn)
 */
const fs = require("fs");
const http = require("http");
const path = require("path");

// Đọc code TSX từ file riêng (Hub soạn nội dung, không can thiệp app con)
const code = fs.readFileSync(path.join(__dirname, "opencode-video.tsx"), "utf8");

const voice_scripts = [
  { id: "scene1_hook", text: "Một dự án mới, vừa gây bão cộng đồng AI toàn cầu. Mười lăm nghìn likes... và một triệu lượt xem. Chỉ trong, mười hai giờ đồng hồ. Đó chính là, OpenCode.", voice: "vi-VN-NamMinhNeural", rate: "+7%", pitch: "-10Hz", engine: "edge" },
  { id: "scene2_specs", text: "OpenCode, là phiên bản mã nguồn mở, của Claude Code. Nhưng khác biệt lớn nhất... là nó hoạt động được, với bất kỳ mô hình AI nào. GPT, DeepSeek, Gemini, Llama, hay MiniMax... tất cả, đều chạy được.", voice: "vi-VN-NamMinhNeural", rate: "+7%", pitch: "-10Hz", engine: "edge" },
  { id: "scene3_bench", text: "Đây là tin lớn, vì ba lý do. Thứ nhất... phá vỡ hoàn toàn vendor lock-in, bạn không còn bị phụ thuộc, vào một nhà cung cấp. Thứ hai, tiết kiệm chi phí đáng kể. Và thứ ba, mã nguồn mở... cộng đồng phát triển, rất nhanh.", voice: "vi-VN-NamMinhNeural", rate: "+7%", pitch: "-10Hz", engine: "edge" },
  { id: "scene4_verdict", text: "Với developer Việt Nam... đây là cơ hội lớn. Bạn có thể dùng mô hình AI rẻ nhất, mà vẫn mạnh. Không bị khóa với một nhà cung cấp. Và cộng đồng Việt Nam, hoàn toàn có thể đóng góp.", voice: "vi-VN-NamMinhNeural", rate: "+7%", pitch: "-10Hz", engine: "edge" },
  { id: "scene5_cta", text: "Trên đây là đánh giá chi tiết, về OpenCode. Để xem thêm... các bạn có thể ghé website, tintucai.vn nhé. Follow kênh, để cập nhật tin tức AI, mới nhất.", voice: "vi-VN-NamMinhNeural", rate: "-2%", pitch: "-10Hz", engine: "edge" }
];

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const output_name = `OpenCode_Review_${today}`;

const data = JSON.stringify({
  capability_id: "render-video",
  input: { code, voice_scripts, output_name }
});

console.log("=== Hub → video-creator ===");
console.log("Output:", output_name);
console.log("Payload:", (data.length / 1024).toFixed(1) + "KB");

const req = http.request({
  hostname: "127.0.0.1", port: 3020, path: "/execute", method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
}, (res) => {
  let body = "";
  res.on("data", d => body += d);
  res.on("end", () => {
    const j = JSON.parse(body);
    console.log("Job:", j.job_id);
    const poll = () => {
      setTimeout(() => {
        http.get("http://127.0.0.1:3020/jobs/" + j.job_id, (r) => {
          let b = "";
          r.on("data", d => b += d);
          r.on("end", () => {
            const p = JSON.parse(b);
            console.log("Status:", p.status);
            if (p.status === "completed") {
              console.log("\n✅ Video:", p.result.video_path);
              console.log("Duration:", p.result.duration_seconds + "s");
              console.log("Size:", (p.result.file_size_bytes / 1024 / 1024).toFixed(1) + "MB");
            } else if (p.status === "failed") {
              console.log("❌ Error:", p.error);
            } else { poll(); }
          });
        });
      }, 5000);
    };
    poll();
  });
});
req.write(data);
req.end();
