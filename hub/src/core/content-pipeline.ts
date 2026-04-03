/**
 * CONTENT PIPELINE — Full flow: crawl → viết → ảnh → video → đăng
 * Mỗi bước lưu DB, trace được toàn bộ
 */
import OpenAI from "openai";
import { prisma } from "./db.js";
import { trackTokenUsage } from "./token-tracker.js";

const API_KEYS = [
  "00c7a2db-4cf0-4770-8f5b-fbbd0b62223d",
  "cd7b976d-853b-4f48-b1b7-7802584a2f10",
  "402a4732-45b8-4e84-930d-7c8e38aa7c49",
];
let keyIdx = 0;
const MODELS = ["kimi-k2.5", "kimi-k2-250905", "deepseek-v3-2-251201"];

async function callAI(system: string, user: string, maxTokens = 2048): Promise<{ text: string; tokens: number }> {
  const client = new OpenAI({ apiKey: API_KEYS[keyIdx], baseURL: "https://ark.ap-southeast.bytepluses.com/api/v3" });

  for (const model of MODELS) {
    try {
      const r = await client.chat.completions.create({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: maxTokens,
        temperature: 0.7,
      });
      const tokens = r.usage?.total_tokens || 0;
      await trackTokenUsage({ app_id: "hub", model, input_tokens: r.usage?.prompt_tokens || 0, output_tokens: r.usage?.completion_tokens || 0, purpose: "content_pipeline" });
      return { text: r.choices[0]?.message?.content || "", tokens };
    } catch (e: any) {
      if (e.status === 429) { keyIdx = (keyIdx + 1) % API_KEYS.length; continue; }
      if (e.status === 404) continue;
      throw e;
    }
  }
  throw new Error("All AI models failed");
}

/**
 * Step 1: COLLECT — Thu thập trending từ GitHub/HuggingFace/X
 */
async function stepCollect(projectId: string, stepId: string): Promise<any> {
  await updateStep(stepId, "running");

  // Crawl GitHub trending
  let trendingData: any[] = [];
  try {
    const resp = await fetch("https://api.github.com/search/repositories?q=stars:>500+pushed:>" +
      new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) + "&sort=stars&order=desc&per_page=5");
    const data = await resp.json();
    trendingData = (data.items || []).map((r: any) => ({
      name: r.full_name,
      url: r.html_url,
      stars: r.stargazers_count,
      description: r.description,
      language: r.language,
      topics: r.topics?.slice(0, 5),
    }));
  } catch (e: any) {
    console.log("[Pipeline] GitHub API error:", e.message);
  }

  // HuggingFace trending (simple fetch)
  let hfTrending: any[] = [];
  try {
    const resp = await fetch("https://huggingface.co/api/trending");
    const data = await resp.json();
    hfTrending = (data.recentlyTrending || []).slice(0, 5).map((m: any) => ({
      name: m.repoData?.id || m.id,
      type: m.repoType,
      likes: m.repoData?.likes,
    }));
  } catch (e: any) {
    console.log("[Pipeline] HuggingFace API error:", e.message);
  }

  const output = { github: trendingData, huggingface: hfTrending, collected_at: new Date().toISOString() };
  await completeStep(stepId, output);
  return output;
}

/**
 * Step 2: ANALYZE — AI phân tích, chọn topic hay nhất
 */
async function stepAnalyze(projectId: string, stepId: string, collectData: any): Promise<any> {
  await updateStep(stepId, "running");

  const { text, tokens } = await callAI(
    "Bạn là chuyên gia phân tích xu hướng công nghệ. Trả lời bằng JSON.",
    `Phân tích danh sách trending dưới đây, chọn 1 topic HAY NHẤT để làm content (video TikTok + bài viết).

DATA:
${JSON.stringify(collectData, null, 2)}

Trả về JSON (không markdown):
{
  "chosen_topic": "tên topic",
  "source_url": "link gốc",
  "source_type": "github/huggingface",
  "why": "lý do chọn",
  "hook": "câu hook gây chú ý cho video",
  "key_points": ["điểm 1", "điểm 2", "điểm 3"],
  "target_audience": "ai nên xem",
  "trending_score": 8
}`
  );

  let output: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    output = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
  } catch {
    output = { raw: text };
  }
  output.ai_tokens = tokens;

  // Update project title
  if (output.chosen_topic) {
    await prisma.contentProject.update({
      where: { id: projectId },
      data: { title: output.chosen_topic, source_url: output.source_url, source_type: output.source_type },
    });
  }

  await completeStep(stepId, output);
  return output;
}

/**
 * Step 3: WRITE ARTICLE — Viết bài chi tiết
 */
async function stepWriteArticle(projectId: string, stepId: string, analyzeData: any): Promise<any> {
  await updateStep(stepId, "running");

  const { text, tokens } = await callAI(
    "Bạn là content writer chuyên viết về công nghệ/AI cho tintucai.vn. Viết bài tiếng Việt, dễ hiểu, hấp dẫn.",
    `Viết bài chi tiết về topic: "${analyzeData.chosen_topic}"

Thông tin:
- Hook: ${analyzeData.hook}
- Key points: ${analyzeData.key_points?.join(", ")}
- Target: ${analyzeData.target_audience}
- Source: ${analyzeData.source_url}

YÊU CẦU:
- Tiêu đề hấp dẫn (SEO friendly)
- Mở bài gây chú ý (2-3 câu)
- Thân bài 3-4 phần, mỗi phần có heading
- Kết bài có CTA
- Độ dài: 500-800 từ
- Thêm: hashtags, SEO keywords, meta description

Trả về JSON:
{
  "title": "...",
  "meta_description": "...",
  "body": "... (full article markdown)",
  "hashtags": ["#ai", "#tech"],
  "seo_keywords": ["keyword1", "keyword2"],
  "excerpt": "... (2 câu tóm tắt)"
}`
  );

  let output: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    output = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
  } catch {
    output = { raw: text };
  }
  output.ai_tokens = tokens;
  await completeStep(stepId, output);
  return output;
}

/**
 * Step 4: WRITE VIDEO SCRIPT — Viết kịch bản video TikTok
 */
async function stepWriteVideoScript(projectId: string, stepId: string, analyzeData: any, articleData: any): Promise<any> {
  await updateStep(stepId, "running");

  const { text, tokens } = await callAI(
    `Bạn là video script writer. Viết kịch bản video TikTok 50-60 giây về công nghệ.
Watermark: tintucai.vn (hiển thị dưới mỗi scene).
Voice: giọng Nam Bắc trầm ấm.`,
    `Viết kịch bản video TikTok cho topic: "${analyzeData.chosen_topic}"

Hook: ${analyzeData.hook}
Key points: ${analyzeData.key_points?.join(", ")}

YÊU CẦU: 5 scenes, mỗi scene có voice_text + visual description. Tổng 50-60 giây.

Trả về JSON:
{
  "video_title": "...",
  "total_duration_target": 55,
  "scenes": [
    {
      "id": "scene1",
      "name": "Hook",
      "duration_target": 8,
      "voice_text": "... (text cho TTS)",
      "visual_description": "... (mô tả hình ảnh/animation)",
      "text_overlay": "... (text hiện trên màn hình)",
      "background_style": "gradient-dark"
    }
  ]
}`
  );

  let output: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    output = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
  } catch {
    output = { raw: text };
  }
  output.ai_tokens = tokens;
  await completeStep(stepId, output);
  return output;
}

/**
 * Step 5: DESIGN IMAGE — Tạo ảnh (gọi video-creator)
 */
async function stepDesignImage(projectId: string, stepId: string, articleData: any, analyzeData: any): Promise<any> {
  await updateStep(stepId, "running");

  // Gọi video-creator tạo ảnh OG + thumbnail
  let output: any = { status: "skipped", reason: "video-creator not available" };
  try {
    const resp = await fetch("http://localhost:3020/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capability_id: "create-image",
        input: {
          type: "og",
          title: articleData.title || analyzeData.chosen_topic,
          subtitle: articleData.excerpt || analyzeData.hook,
          brand: "tintucai.vn",
        },
      }),
    });
    if (resp.ok) {
      output = await resp.json();
    }
  } catch (e: any) {
    output = { status: "skipped", reason: e.message };
  }

  await completeStep(stepId, output);
  return output;
}

/**
 * Step 6: CREATE VIDEO — Gọi video-creator
 */
async function stepCreateVideo(projectId: string, stepId: string, videoScript: any): Promise<any> {
  await updateStep(stepId, "running");

  let output: any = { status: "skipped", reason: "video-creator not available" };
  try {
    const resp = await fetch("http://localhost:3020/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capability_id: "render-video",
        input: { script: videoScript },
      }),
    });
    if (resp.ok) {
      output = await resp.json();
    }
  } catch (e: any) {
    output = { status: "skipped", reason: e.message };
  }

  await completeStep(stepId, output);
  return output;
}

/**
 * Step 7: PUBLISH — Đăng bài (placeholder, cần social-manager)
 */
async function stepPublish(projectId: string, stepId: string, articleData: any, videoData: any): Promise<any> {
  await updateStep(stepId, "running");

  const output = {
    status: "ready_to_publish",
    platforms: {
      tiktok: { video: videoData?.data?.video_url || null, ready: !!videoData?.data?.video_url },
      website: { article: articleData.title, ready: true },
      facebook: { ready: false, reason: "social-manager cần login" },
      x: { ready: false, reason: "social-manager cần login" },
    },
    note: "Content đã sẵn sàng. Cần social-manager login để đăng tự động.",
  };

  await completeStep(stepId, output);
  return output;
}

// ============================================
// Helper functions
// ============================================

async function updateStep(stepId: string, status: string): Promise<void> {
  await prisma.contentStep.update({
    where: { id: stepId },
    data: { status, started_at: new Date() },
  });
}

async function completeStep(stepId: string, output: any): Promise<void> {
  const step = await prisma.contentStep.findUnique({ where: { id: stepId } });
  const duration = step?.started_at ? Date.now() - step.started_at.getTime() : 0;

  await prisma.contentStep.update({
    where: { id: stepId },
    data: {
      status: "completed",
      output_data: JSON.stringify(output),
      completed_at: new Date(),
      duration_ms: duration,
    },
  });
}

async function failStep(stepId: string, error: string): Promise<void> {
  await prisma.contentStep.update({
    where: { id: stepId },
    data: { status: "failed", error_message: error, completed_at: new Date() },
  });
}

// ============================================
// MAIN: Run full content pipeline
// ============================================

export async function runContentPipeline(): Promise<{
  project_id: string;
  status: string;
  steps: { step: string; status: string; duration_ms: number }[];
}> {
  console.log("[Pipeline] ========== STARTING CONTENT PIPELINE ==========");

  // Create project
  const project = await prisma.contentProject.create({
    data: { title: "Auto Content — " + new Date().toLocaleString("vi-VN"), status: "collecting" },
  });

  // Create all steps upfront
  const stepDefs = [
    { step_order: 1, step_type: "collect" },
    { step_order: 2, step_type: "analyze" },
    { step_order: 3, step_type: "write_article" },
    { step_order: 4, step_type: "write_video_script" },
    { step_order: 5, step_type: "design_image" },
    { step_order: 6, step_type: "create_video" },
    { step_order: 7, step_type: "publish" },
  ];

  const steps = await Promise.all(
    stepDefs.map((s) =>
      prisma.contentStep.create({
        data: { project_id: project.id, ...s },
      })
    )
  );

  const results: { step: string; status: string; duration_ms: number }[] = [];

  try {
    // Step 1: Collect
    console.log("[Pipeline] Step 1/7: Thu thập trending...");
    await prisma.contentProject.update({ where: { id: project.id }, data: { status: "collecting" } });
    const collectData = await stepCollect(project.id, steps[0].id);
    results.push({ step: "collect", status: "completed", duration_ms: 0 });

    // Step 2: Analyze
    console.log("[Pipeline] Step 2/7: AI phân tích...");
    const analyzeData = await stepAnalyze(project.id, steps[1].id, collectData);
    results.push({ step: "analyze", status: "completed", duration_ms: 0 });

    // Step 3: Write article
    console.log("[Pipeline] Step 3/7: Viết bài...");
    await prisma.contentProject.update({ where: { id: project.id }, data: { status: "writing" } });
    const articleData = await stepWriteArticle(project.id, steps[2].id, analyzeData);
    results.push({ step: "write_article", status: "completed", duration_ms: 0 });

    // Step 4: Video script
    console.log("[Pipeline] Step 4/7: Viết kịch bản video...");
    const videoScriptData = await stepWriteVideoScript(project.id, steps[3].id, analyzeData, articleData);
    results.push({ step: "write_video_script", status: "completed", duration_ms: 0 });

    // Step 5: Design image
    console.log("[Pipeline] Step 5/7: Tạo ảnh...");
    await prisma.contentProject.update({ where: { id: project.id }, data: { status: "designing" } });
    const imageData = await stepDesignImage(project.id, steps[4].id, articleData, analyzeData);
    results.push({ step: "design_image", status: imageData.status === "skipped" ? "skipped" : "completed", duration_ms: 0 });

    // Step 6: Create video
    console.log("[Pipeline] Step 6/7: Tạo video...");
    await prisma.contentProject.update({ where: { id: project.id }, data: { status: "video_creating" } });
    const videoData = await stepCreateVideo(project.id, steps[5].id, videoScriptData);
    results.push({ step: "create_video", status: videoData.status === "skipped" ? "skipped" : "completed", duration_ms: 0 });

    // Step 7: Publish
    console.log("[Pipeline] Step 7/7: Đăng bài...");
    await prisma.contentProject.update({ where: { id: project.id }, data: { status: "publishing" } });
    const publishData = await stepPublish(project.id, steps[6].id, articleData, videoData);
    results.push({ step: "publish", status: "completed", duration_ms: 0 });

    // Done!
    await prisma.contentProject.update({ where: { id: project.id }, data: { status: "completed" } });
    console.log("[Pipeline] ========== PIPELINE COMPLETED ==========");

  } catch (err: any) {
    console.error("[Pipeline] FAILED:", err.message);
    await prisma.contentProject.update({ where: { id: project.id }, data: { status: "failed" } });

    // Find which step was running and fail it
    const runningStep = await prisma.contentStep.findFirst({
      where: { project_id: project.id, status: "running" },
    });
    if (runningStep) {
      await failStep(runningStep.id, err.message);
    }
  }

  // Load final results with durations
  const finalSteps = await prisma.contentStep.findMany({
    where: { project_id: project.id },
    orderBy: { step_order: "asc" },
  });

  return {
    project_id: project.id,
    status: (await prisma.contentProject.findUnique({ where: { id: project.id } }))?.status || "unknown",
    steps: finalSteps.map((s) => ({
      step: s.step_type,
      status: s.status,
      duration_ms: s.duration_ms || 0,
    })),
  };
}
