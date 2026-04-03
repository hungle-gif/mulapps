import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import api from "./routes/api.js";
import { checkAllHealth } from "./core/registry.js";
import { prisma } from "./core/db.js";
import { startScheduler } from "./core/scheduler.js";
import { startMonitor } from "./core/monitor.js";

const app = new Hono();
app.use("*", cors());
app.use("*", logger());

app.onError((err, c) => {
  console.error("[Hub Error]", err.message);
  return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } }, 500);
});

// API routes
app.route("/api", api);

// Root
app.get("/", async (c) => {
  const apps = await prisma.app.findMany({ select: { app_id: true, name: true, status: true } });
  return c.json({
    name: "Hub Trung Tâm",
    version: "1.0.0",
    description: "Bộ não AI điều phối các app con",
    apps_connected: apps,
    endpoints: {
      dashboard: "GET /api/dashboard",
      apps: "GET /api/apps",
      register: "POST /api/apps/register { base_url }",
      capabilities: "GET /api/capabilities",
      execute: "POST /api/execute { app_id, capability_id, input }",
      jobs: "GET /api/jobs/:app_id/:job_id",
    },
  });
});

// Start server
const PORT = parseInt(process.env.PORT || "3000", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`
╔══════════════════════════════════════════════╗
║            HUB TRUNG TÂM                    ║
╠══════════════════════════════════════════════╣
║  Port:      ${String(info.port).padEnd(34)}║
║  Bộ não AI điều phối các app con             ║
║                                              ║
║  POST /api/apps/register  Đăng ký app con    ║
║  GET  /api/capabilities   Xem tất cả skills  ║
║  POST /api/execute        Gọi capability     ║
║  GET  /api/dashboard      Tổng quan          ║
╚══════════════════════════════════════════════╝
  `);

  // Start Monitor (health check mỗi 30s + alerts)
  startMonitor();

  // Start Scheduler (check cron mỗi 60s)
  startScheduler();
});

export default app;
