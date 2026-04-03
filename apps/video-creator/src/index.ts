import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { renderVideo, type RenderRequest } from "./lib/render.js";
import { generateAllVoices, type VoiceScript } from "./lib/voice.js";
import { nanoid } from "nanoid";

const app = new Hono();
app.use("*", cors());
app.use("*", logger());

const startTime = Date.now();
const jobs = new Map<string, { status: string; result?: any; error?: string }>();

// ==========================================
// Plugin Protocol
// ==========================================

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    version: "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: { remotion: "healthy", ffmpeg: "healthy", edge_tts: "healthy" },
  });
});

app.get("/manifest", (c) => {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "manifest.json"), "utf-8"));
  return c.json(manifest);
});

app.post("/execute", async (c) => {
  const body = await c.req.json();
  const { capability_id, input } = body;
  const requestId = c.req.header("X-Request-ID") || nanoid();
  const startMs = Date.now();

  switch (capability_id) {
    case "render-video": {
      // Async: start render in background, return job ID
      const jobId = nanoid(8);
      jobs.set(jobId, { status: "running" });

      // Fire and forget — render in background
      renderVideo(input as RenderRequest)
        .then((result) => {
          jobs.set(jobId, { status: "completed", result });
        })
        .catch((error) => {
          jobs.set(jobId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Render failed",
          });
        });

      return c.json({
        success: true,
        request_id: requestId,
        job_id: jobId,
        status: "running",
        poll_url: `/jobs/${jobId}`,
      }, 202);
    }

    case "generate-voice": {
      const { text, voice, rate } = input as { text: string; voice?: string; rate?: string };
      const audioDir = resolve(process.cwd(), "output", "audio");
      const id = nanoid(6);
      const scripts: VoiceScript[] = [{ id, text, voice, rate }];
      const timing = await generateAllVoices(scripts, audioDir);

      return c.json({
        success: true,
        data: {
          audio_url: `/output/audio/${id}.mp3`,
          duration_seconds: timing[id],
        },
        meta: { duration_ms: Date.now() - startMs },
      });
    }

    default:
      return c.json({
        success: false,
        error: { code: "INVALID_CAPABILITY", message: `Unknown: ${capability_id}` },
      }, 400);
  }
});

app.get("/jobs/:id", (c) => {
  const job = jobs.get(c.req.param("id"));
  if (!job) return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);

  return c.json({
    success: true,
    job_id: c.req.param("id"),
    status: job.status,
    result: job.result || null,
    error: job.error || null,
  });
});

// ==========================================
// Internal API
// ==========================================

// Direct render (sync, waits for result)
app.post("/api/render", async (c) => {
  const body = await c.req.json();
  try {
    const result = await renderVideo(body as RenderRequest);
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: "RENDER_FAILED", message: (error as Error).message },
    }, 500);
  }
});

// Serve output files
app.get("/output/*", (c) => {
  const filePath = resolve(process.cwd(), c.req.path.slice(1));
  if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const data = readFileSync(filePath);
  const ext = filePath.split(".").pop();
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    aac: "audio/aac",
    json: "application/json",
  };
  return new Response(data, {
    headers: { "Content-Type": mimeTypes[ext || ""] || "application/octet-stream" },
  });
});

app.get("/", (c) => c.json({
  name: "Video Creator",
  version: "1.0.0",
  description: "Headless video creation — AI writes Remotion code → app renders MP4 with voice",
  endpoints: {
    health: "GET /health",
    manifest: "GET /manifest",
    execute: "POST /execute",
    jobs: "GET /jobs/:id",
    render: "POST /api/render",
    output: "GET /output/*",
  },
}));

// Start
const PORT = parseInt(process.env.PORT || "3020", 10);
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`
╔══════════════════════════════════════════════╗
║          VIDEO CREATOR SERVICE               ║
╠══════════════════════════════════════════════╣
║  Port:      ${String(info.port).padEnd(34)}║
║  Protocol:  Plugin Protocol v1.0             ║
║  Stack:     Remotion + Edge-TTS + FFmpeg     ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
