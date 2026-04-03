/**
 * Hub API Routes
 */
import { Hono } from "hono";
import { prisma } from "../core/db.js";
import { registerApp, getAllCapabilities, checkAllHealth } from "../core/registry.js";
import { executeCapability, pollJobStatus } from "../core/gateway.js";
import { runWorkflow } from "../core/workflow-engine.js";
import { getSystemStatus } from "../core/monitor.js";
import { trackTokenUsage, getTokenStats } from "../core/token-tracker.js";
import { chatWithHub } from "../core/natural-chat.js";
import { setAdminZalo, generateDailyReport } from "../core/notifier.js";
import { runContentPipeline } from "../core/content-pipeline.js";

const api = new Hono();

// ==========================================
// APP MANAGEMENT
// ==========================================

// Đăng ký app con mới
api.post("/apps/register", async (c) => {
  const { base_url } = await c.req.json();
  if (!base_url) return c.json({ success: false, error: "base_url required" }, 400);

  const result = await registerApp(base_url);
  return c.json(result, result.success ? 200 : 400);
});

// Danh sách app con
api.get("/apps", async (c) => {
  const apps = await prisma.app.findMany({
    include: { capabilities: true, _count: { select: { activity_logs: true } } },
    orderBy: { registered_at: "desc" },
  });
  return c.json({ success: true, data: apps });
});

// Chi tiết 1 app
api.get("/apps/:id", async (c) => {
  const app = await prisma.app.findUnique({
    where: { app_id: c.req.param("id") },
    include: { capabilities: true },
  });
  if (!app) return c.json({ success: false, error: "App not found" }, 404);
  return c.json({ success: true, data: app });
});

// Gỡ app con
api.delete("/apps/:id", async (c) => {
  const app = await prisma.app.findUnique({ where: { app_id: c.req.param("id") } });
  if (!app) return c.json({ success: false, error: "App not found" }, 404);
  await prisma.app.delete({ where: { id: app.id } });
  return c.json({ success: true });
});

// Force health check
api.post("/apps/health-check", async (c) => {
  await checkAllHealth();
  const apps = await prisma.app.findMany({ select: { app_id: true, name: true, status: true, last_health: true } });
  return c.json({ success: true, data: apps });
});

// ==========================================
// CAPABILITIES
// ==========================================

// Tất cả capabilities từ mọi app active
api.get("/capabilities", async (c) => {
  const caps = await getAllCapabilities();
  return c.json({
    success: true,
    data: caps.map((cap) => ({
      app_id: cap.app.app_id,
      app_name: cap.app.name,
      app_status: cap.app.status,
      capability_id: cap.capability_id,
      name: cap.name,
      description: cap.description,
      category: cap.category,
      is_async: cap.is_async,
    })),
  });
});

// ==========================================
// EXECUTE — Gọi capability qua Gateway
// ==========================================

api.post("/execute", async (c) => {
  const body = await c.req.json();
  const { app_id, capability_id, input, timeout } = body;

  if (!app_id || !capability_id) {
    return c.json({ success: false, error: "app_id and capability_id required" }, 400);
  }

  const result = await executeCapability({ app_id, capability_id, input: input || {}, timeout });

  return c.json(result, result.success ? 200 : 500);
});

// ==========================================
// WEBHOOK — Nhận tin nhắn Zalo realtime
// ==========================================

const pendingMessages: Array<{
  sender_id: string;
  sender_name: string;
  content: string;
  msg_id: string;
  is_group: boolean;
  timestamp: string;
}> = [];

api.post("/webhook/zalo-message", async (c) => {
  const msg = await c.req.json();
  pendingMessages.push(msg);
  if (pendingMessages.length > 100) pendingMessages.shift();

  console.log(`[Hub] 📩 Zalo from ${msg.sender_name}: "${String(msg.content).slice(0, 80)}"`);

  // Log
  await prisma.activityLog.create({
    data: { type: "zalo_message_received", details: JSON.stringify(msg) },
  });

  // === AUTO REPLY — Hub AI Brain suy nghĩ và trả lời ===
  const content = String(msg.content).trim();
  if (!content || msg.is_group) {
    return c.json({ success: true, queued: true, auto_reply: false });
  }

  // Hub AI soạn reply dựa trên context
  const reply = generateReply(msg.sender_name, content);
  console.log(`[Hub] 🤖 Auto reply: "${reply.slice(0, 80)}..."`);

  // Gọi zalo-outreach gửi reply
  try {
    const sendResult = await executeCapability({
      app_id: "zalo-outreach",
      capability_id: "send-outreach-message",
      input: {
        contact_id: msg.sender_id, // Sẽ cần xử lý mapping
        message: reply,
      },
    });

    // Nếu send qua capability không được (cần zalo_id, không phải contact_id)
    // Gọi trực tiếp API zalo-outreach
    if (!sendResult.success) {
      const directResult = await fetch("http://localhost:3010/api/conversations/direct-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zalo_id: msg.sender_id,
          message: reply,
        }),
      });
      const directData = await directResult.json();
      console.log(`[Hub] 📤 Direct reply result:`, directData.success ? "✅" : "❌");
    }

    await prisma.activityLog.create({
      data: { type: "auto_reply_sent", details: JSON.stringify({ to: msg.sender_name, reply: reply.slice(0, 200) }) },
    });
  } catch (err) {
    console.error(`[Hub] Reply failed:`, (err as Error).message);
  }

  return c.json({ success: true, queued: true, auto_reply: true, reply });
});

/**
 * Hub AI Brain — Soạn reply dựa trên nội dung tin nhắn
 * Sau này thay bằng LLM call thật (Claude API)
 */
function generateReply(senderName: string, content: string): string {
  const lower = content.toLowerCase();
  const name = senderName.split(" ").pop() || "bạn";

  // Greeting
  if (lower.match(/xin chào|hello|hi |chào/)) {
    return `Chào ${name}! 👋 Mình là trợ lý AI của tintucai.vn. Mình có thể giúp gì cho bạn?`;
  }

  // Price / product inquiry
  if (lower.match(/giá|bao nhiêu|mua|đặt|order/)) {
    return `Cảm ơn ${name} đã quan tâm! Để mình gửi thông tin chi tiết cho bạn nhé. Bạn đang quan tâm đến sản phẩm/dịch vụ nào?`;
  }

  // Need to talk / general
  if (lower.match(/nói chuyện|tư vấn|hỏi|cần|muốn|giúp/)) {
    return `Chào ${name}! Mình sẵn sàng hỗ trợ bạn. Bạn cần tư vấn về vấn đề gì ạ? 😊`;
  }

  // Thanks
  if (lower.match(/cảm ơn|thank|cám ơn/)) {
    return `Không có gì ${name} ạ! Nếu cần thêm thông tin gì cứ nhắn mình nhé 😊`;
  }

  // Default — friendly response
  return `Cảm ơn ${name} đã nhắn tin! Mình đã nhận được tin nhắn của bạn. Mình sẽ phản hồi chi tiết sớm nhất có thể nhé 😊`;
}

// Xem tin nhắn chưa xử lý
api.get("/messages/pending", (c) => {
  return c.json({ success: true, data: pendingMessages, count: pendingMessages.length });
});

// Poll job status
api.get("/jobs/:app_id/:job_id", async (c) => {
  const result = await pollJobStatus(c.req.param("app_id"), c.req.param("job_id"));
  return c.json({ success: true, data: result });
});

// ==========================================
// DASHBOARD
// ==========================================

api.get("/dashboard", async (c) => {
  const [apps, capabilities, recentLogs] = await Promise.all([
    prisma.app.findMany({ select: { app_id: true, name: true, status: true, last_health: true } }),
    prisma.appCapability.count(),
    prisma.activityLog.findMany({ orderBy: { created_at: "desc" }, take: 20 }),
  ]);

  return c.json({
    success: true,
    data: {
      apps_total: apps.length,
      apps_active: apps.filter((a) => a.status === "active").length,
      apps_offline: apps.filter((a) => a.status === "offline").length,
      capabilities_total: capabilities,
      apps,
      recent_activity: recentLogs,
    },
  });
});

// ==========================================
// ACTIVITY LOG
// ==========================================

api.get("/activity", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50");
  const logs = await prisma.activityLog.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
    include: { app: { select: { app_id: true, name: true } } },
  });
  return c.json({ success: true, data: logs });
});

// ==========================================
// KNOWLEDGE BASE — Kho kiến thức trung tâm
// ==========================================

// Xem tất cả docs (Hub UI dùng)
api.get("/knowledge", async (c) => {
  const category = c.req.query("category");
  const scope = c.req.query("scope"); // null=all, "zalo-outreach"...
  const where: any = { is_active: true };
  if (category) where.category = category;
  if (scope) where.OR = [{ scope: null }, { scope }];

  const docs = await prisma.knowledgeDoc.findMany({
    where,
    orderBy: [{ priority: "asc" }, { category: "asc" }],
  });

  return c.json({
    success: true,
    data: {
      total: docs.length,
      categories: [...new Set(docs.map((d) => d.category))],
      docs: docs.map((d) => ({
        id: d.id,
        category: d.category,
        title: d.title,
        content: d.content,
        tags: d.tags ? JSON.parse(d.tags) : [],
        keywords: d.keywords,
        priority: d.priority,
        scope: d.scope,
        version: d.version,
        updated_at: d.updated_at,
      })),
    },
  });
});

// Thêm doc mới
api.post("/knowledge", async (c) => {
  const body = await c.req.json();
  if (!body.title || !body.content) {
    return c.json({ success: false, error: "title and content required" }, 400);
  }

  const doc = await prisma.knowledgeDoc.create({
    data: {
      category: body.category || "other",
      title: body.title,
      content: body.content,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      keywords: body.keywords || null,
      priority: body.priority || 5,
      scope: body.scope || null,
      version: 1,
    },
  });

  return c.json({ success: true, data: doc });
});

// Sửa doc
api.put("/knowledge/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!existing) return c.json({ success: false, error: "Not found" }, 404);

  const doc = await prisma.knowledgeDoc.update({
    where: { id },
    data: {
      ...(body.category && { category: body.category }),
      ...(body.title && { title: body.title }),
      ...(body.content && { content: body.content }),
      ...(body.tags && { tags: JSON.stringify(body.tags) }),
      ...(body.keywords !== undefined && { keywords: body.keywords }),
      ...(body.priority && { priority: body.priority }),
      ...(body.scope !== undefined && { scope: body.scope }),
      version: existing.version + 1, // Bump version → app con biết cần sync
    },
  });

  return c.json({ success: true, data: doc });
});

// Xóa doc (soft delete)
api.delete("/knowledge/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!existing) return c.json({ success: false, error: "Not found" }, 404);

  await prisma.knowledgeDoc.update({
    where: { id },
    data: { is_active: false, version: existing.version + 1 },
  });
  return c.json({ success: true });
});

// ==========================================
// SYNC ENDPOINT — App con gọi để lấy knowledge mới
// ==========================================

/**
 * GET /api/knowledge/sync?app_id=zalo-outreach&since_version=5
 * App con gọi endpoint này mỗi 5 phút để lấy docs mới/sửa
 * Trả về chỉ docs có version > since_version
 */
api.get("/knowledge/sync", async (c) => {
  const appId = c.req.query("app_id");
  const sinceVersion = parseInt(c.req.query("since_version") || "0");

  if (!appId) return c.json({ success: false, error: "app_id required" }, 400);

  // Get docs updated since last sync (scope = all or this app)
  const docs = await prisma.knowledgeDoc.findMany({
    where: {
      version: { gt: sinceVersion },
      OR: [{ scope: null }, { scope: appId }],
    },
    orderBy: { version: "asc" },
  });

  // Get max version for this sync
  const maxVersion = docs.length > 0
    ? Math.max(...docs.map((d) => d.version))
    : sinceVersion;

  // Update sync tracker
  await prisma.knowledgeSync.upsert({
    where: { app_id: appId },
    update: { last_version: maxVersion, synced_at: new Date() },
    create: { app_id: appId, last_version: maxVersion },
  });

  return c.json({
    success: true,
    data: {
      app_id: appId,
      since_version: sinceVersion,
      current_version: maxVersion,
      docs_count: docs.length,
      docs: docs.map((d) => ({
        id: d.id,
        category: d.category,
        title: d.title,
        content: d.content,
        tags: d.tags,
        keywords: d.keywords,
        priority: d.priority,
        scope: d.scope,
        version: d.version,
        is_active: d.is_active,
        updated_at: d.updated_at,
      })),
    },
  });
});

// ==========================================
// WORKFLOW — Quản lý + chạy workflows
// ==========================================

// Danh sách workflows
api.get("/workflows", async (c) => {
  const workflows = await prisma.workflow.findMany({
    orderBy: { created_at: "desc" },
    include: { _count: { select: { runs: true } } },
  });
  return c.json({
    success: true,
    data: workflows.map((w) => ({
      ...w,
      steps: JSON.parse(w.steps),
      total_runs: w._count.runs,
    })),
  });
});

// Tạo workflow
api.post("/workflows", async (c) => {
  const body = await c.req.json();
  const workflow = await prisma.workflow.create({
    data: {
      name: body.name,
      description: body.description,
      trigger_type: body.trigger_type || "manual",
      trigger_config: body.trigger_config,
      steps: JSON.stringify(body.steps),
      on_error: body.on_error || "stop",
    },
  });

  // Auto-create schedule if trigger is cron
  if (body.trigger_type === "cron" && body.trigger_config) {
    await prisma.schedule.create({
      data: {
        name: `Auto: ${body.name}`,
        workflow_id: workflow.id,
        cron_expression: body.trigger_config,
      },
    });
  }

  return c.json({ success: true, data: { ...workflow, steps: JSON.parse(workflow.steps) } });
});

// Chạy workflow thủ công
api.post("/workflows/:id/run", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const result = await runWorkflow(id, "manual", body.input);
  return c.json({ success: true, data: result });
});

// Xem lịch sử chạy
api.get("/workflows/:id/runs", async (c) => {
  const id = c.req.param("id");
  const runs = await prisma.workflowRun.findMany({
    where: { workflow_id: id },
    orderBy: { started_at: "desc" },
    take: 20,
  });
  return c.json({
    success: true,
    data: runs.map((r) => ({
      ...r,
      step_results: r.step_results ? JSON.parse(r.step_results) : [],
    })),
  });
});

// ==========================================
// MONITOR — Giám sát hệ thống
// ==========================================

// System status overview
api.get("/monitor/status", async (c) => {
  const status = await getSystemStatus();
  return c.json({ success: true, data: status });
});

// All alerts
api.get("/monitor/alerts", async (c) => {
  const status = c.req.query("status") || "open";
  const alerts = await prisma.monitorAlert.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { created_at: "desc" },
    take: 50,
  });
  return c.json({ success: true, data: alerts });
});

// Resolve alert
api.post("/monitor/alerts/:id/resolve", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  await prisma.monitorAlert.update({
    where: { id },
    data: {
      status: "resolved",
      resolved_at: new Date(),
      resolved_by: body.by || "user",
      resolution: body.resolution,
    },
  });
  return c.json({ success: true });
});

// Health check history
api.get("/monitor/health/:app_id", async (c) => {
  const appId = c.req.param("app_id");
  const checks = await prisma.healthCheck.findMany({
    where: { app_id: appId },
    orderBy: { checked_at: "desc" },
    take: 100,
  });
  return c.json({ success: true, data: checks });
});

// ==========================================
// SCHEDULER — Lịch trình
// ==========================================

api.get("/schedules", async (c) => {
  const schedules = await prisma.schedule.findMany({
    orderBy: { created_at: "desc" },
    include: { workflow: { select: { name: true } } },
  });
  return c.json({ success: true, data: schedules });
});

api.post("/schedules", async (c) => {
  const body = await c.req.json();
  const schedule = await prisma.schedule.create({
    data: {
      name: body.name,
      workflow_id: body.workflow_id,
      cron_expression: body.cron_expression,
      timezone: body.timezone || "Asia/Ho_Chi_Minh",
    },
  });
  return c.json({ success: true, data: schedule });
});

api.put("/schedules/:id/toggle", async (c) => {
  const id = c.req.param("id");
  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) return c.json({ success: false, error: "Not found" }, 404);
  const updated = await prisma.schedule.update({
    where: { id },
    data: { is_active: !schedule.is_active },
  });
  return c.json({ success: true, data: updated });
});

// ==========================================
// TOKEN USAGE — Tracking
// ==========================================

// Report token usage (app con gọi)
api.post("/tokens/report", async (c) => {
  const body = await c.req.json();
  const result = await trackTokenUsage(body);
  return c.json({ success: true, data: result });
});

// Get token stats
api.get("/tokens/stats", async (c) => {
  const days = parseInt(c.req.query("days") || "7");
  const stats = await getTokenStats(days);
  return c.json({ success: true, data: stats });
});

// ==========================================
// DAILY REPORT
// ==========================================

api.get("/reports/daily", async (c) => {
  const date = c.req.query("date") || new Date().toISOString().slice(0, 10);
  const report = await prisma.dailyReport.findUnique({ where: { report_date: date } });
  if (!report) return c.json({ success: true, data: null });
  return c.json({ success: true, data: { ...report, data: JSON.parse(report.data) } });
});

// ==========================================
// NATURAL CHAT — Nói chuyện tự nhiên với Hub
// ==========================================

/**
 * POST /api/chat
 * Gửi tin nhắn tiếng Việt → Hub hiểu + hành động
 */
api.post("/chat", async (c) => {
  try {
    const { message, history } = await c.req.json();
    if (!message) return c.json({ success: false, error: "message required" }, 400);

    console.log(`[Chat] User: ${message}`);
    const result = await chatWithHub(message, history);
    console.log(`[Chat] Hub: ${result.reply.slice(0, 100)}... (${result.actions.length} actions, ${result.tokens_used} tokens)`);

    return c.json({
      success: true,
      data: {
        reply: result.reply,
        actions: result.actions,
        tokens_used: result.tokens_used,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

// Chat history
api.get("/chat/history", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50");
  const messages = await prisma.chatMessage.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return c.json({ success: true, data: messages.reverse() });
});

// ==========================================
// NOTIFICATION — Cấu hình thông báo
// ==========================================

// Set admin Zalo for notifications
api.post("/notifications/admin", async (c) => {
  const { zalo_id, contact_id } = await c.req.json();
  if (!zalo_id || !contact_id) return c.json({ success: false, error: "zalo_id and contact_id required" }, 400);
  setAdminZalo(zalo_id, contact_id);
  return c.json({ success: true, data: { admin_zalo: zalo_id } });
});

// Trigger daily report manually
api.post("/reports/generate", async (c) => {
  await generateDailyReport();
  return c.json({ success: true, data: { generated: true } });
});

// ==========================================
// CONTENT PIPELINE
// ==========================================

// Chạy full pipeline
api.post("/content/run", async (c) => {
  try {
    const result = await runContentPipeline();
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Xem tất cả content projects
api.get("/content/projects", async (c) => {
  const projects = await prisma.contentProject.findMany({
    orderBy: { created_at: "desc" },
    take: 20,
    include: {
      steps: { orderBy: { step_order: "asc" } },
    },
  });
  return c.json({
    success: true,
    data: projects.map((p) => ({
      ...p,
      steps: p.steps.map((s) => ({
        ...s,
        output_data: s.output_data ? JSON.parse(s.output_data) : null,
        input_data: s.input_data ? JSON.parse(s.input_data) : null,
      })),
    })),
  });
});

// Xem chi tiết 1 project
api.get("/content/projects/:id", async (c) => {
  const id = c.req.param("id");
  const project = await prisma.contentProject.findUnique({
    where: { id },
    include: { steps: { orderBy: { step_order: "asc" } } },
  });
  if (!project) return c.json({ success: false, error: "Not found" }, 404);
  return c.json({
    success: true,
    data: {
      ...project,
      steps: project.steps.map((s) => ({
        ...s,
        output_data: s.output_data ? JSON.parse(s.output_data) : null,
        input_data: s.input_data ? JSON.parse(s.input_data) : null,
      })),
    },
  });
});

export default api;
