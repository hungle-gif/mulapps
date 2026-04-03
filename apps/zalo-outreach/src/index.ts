import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import protocol from "./routes/protocol.js";
import api from "./routes/api.js";
import { initWebSocket } from "./lib/ws.js";
import { startMessageListener } from "./lib/zalo/listener.js";
import { prisma } from "./lib/db.js";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Error handler
app.onError((err, c) => {
  console.error("[Error]", err.message);
  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
      },
    },
    500
  );
});

// Plugin Protocol routes (root level)
app.route("/", protocol);

// Internal API routes
app.route("/api", api);

// Root info
app.get("/", (c) => {
  return c.json({
    name: "Zalo Outreach",
    version: "1.0.0",
    description: "Headless Zalo outreach service",
    protocol: "Plugin Protocol v1.0",
    endpoints: {
      health: "GET /health",
      manifest: "GET /manifest",
      execute: "POST /execute",
      jobs: "GET /jobs/:id",
      api: "/api/*",
      websocket: "WS /ws",
    },
  });
});

// Start server
const PORT = parseInt(process.env.PORT || "3010", 10);

const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    // Attach WebSocket to the underlying HTTP server
    initWebSocket(server);

    console.log(`
╔══════════════════════════════════════════════╗
║          ZALO OUTREACH SERVICE               ║
╠══════════════════════════════════════════════╣
║  Status:    RUNNING                          ║
║  Port:      ${String(info.port).padEnd(34)}║
║  Protocol:  Plugin Protocol v1.0             ║
║                                              ║
║  Endpoints:                                  ║
║  GET  /health        Health check            ║
║  GET  /manifest      App manifest            ║
║  POST /execute       Execute capability      ║
║  GET  /jobs/:id      Job status              ║
║  GET  /api/*         Internal API            ║
║  WS   /ws            WebSocket               ║
╚══════════════════════════════════════════════╝
    `);

    // Auto-start listener for all active accounts
    prisma.zaloAccount
      .findMany({ where: { status: "active" } })
      .then(async (accounts) => {
        for (const account of accounts) {
          try {
            await startMessageListener(account.id);
            console.log(`[Listener] ✅ Started for ${account.name} (${account.zalo_id})`);
          } catch (err: any) {
            console.error(`[Listener] ❌ Failed for ${account.name}:`, err.message);
          }
        }
        if (accounts.length === 0) {
          console.log("[Listener] No active accounts — login via QR first");
        }
      });
  }
);

export default app;
