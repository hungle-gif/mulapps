import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { encrypt } from "../lib/crypto.js";
import { scanGroupByLink } from "../lib/zalo/scanner.js";
import { sendMessage, pickTemplateVariant, replaceTemplateVars } from "../lib/zalo/messenger.js";
import { discoverGroups } from "../lib/zalo/discoverer.js";
import { broadcast } from "../lib/ws.js";
import { getConversationStats, scoreConversation } from "../lib/conversation-engine.js";
import { testAI, generateAIReply } from "../lib/ai-brain.js";
import {
  paginationSchema,
  createCampaignSchema,
  createTemplateSchema,
  updateTemplateSchema,
  updateContactSchema,
  scanGroupsSchema,
  sendMessageSchema,
} from "../lib/validations.js";

const api = new Hono();

// ==========================================
// AUTH — Đăng nhập Zalo
// ==========================================

/**
 * POST /api/auth/credentials
 * Đăng nhập bằng Cookie + IMEI + User-Agent lấy từ Zalo Web.
 * Cách lấy:
 *   1. Đăng nhập chat.zalo.me trên browser
 *   2. Cài extension ZaloDataExtractor (hoặc F12 → Application → Cookies)
 *   3. Copy: Cookie string, IMEI (localStorage z_uuid), User-Agent
 */
api.post("/auth/credentials", async (c) => {
  const body = await c.req.json();
  const { cookie, imei, user_agent, name } = body;

  if (!cookie || !imei || !user_agent) {
    return c.json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Cần cookie, imei, user_agent",
        details: [
          ...(!cookie ? [{ field: "cookie", message: "Required" }] : []),
          ...(!imei ? [{ field: "imei", message: "Required" }] : []),
          ...(!user_agent ? [{ field: "user_agent", message: "Required" }] : []),
        ],
      },
    }, 400);
  }

  try {
    // Test connection with zca-js
    const { Zalo } = await import("zca-js");
    const zalo = new Zalo();
    const api = await zalo.login({ cookie, imei, userAgent: user_agent });
    const ownId = api.getOwnId();

    // Encrypt sensitive data before storing
    const encryptedCookie = encrypt(cookie);
    const encryptedImei = encrypt(imei);

    // Upsert account
    const account = await prisma.zaloAccount.upsert({
      where: { zalo_id: String(ownId) },
      update: {
        cookie: encryptedCookie,
        imei: encryptedImei,
        user_agent,
        name: name || `Zalo ${String(ownId).slice(-4)}`,
        status: "active",
        last_active_at: new Date(),
      },
      create: {
        zalo_id: String(ownId),
        cookie: encryptedCookie,
        imei: encryptedImei,
        user_agent,
        name: name || `Zalo ${String(ownId).slice(-4)}`,
        status: "active",
        is_default: true,
        last_active_at: new Date(),
      },
    });

    return c.json({
      success: true,
      data: {
        account_id: account.id,
        zalo_id: account.zalo_id,
        name: account.name,
        status: "active",
        message: "Đăng nhập Zalo thành công!",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Login failed";
    return c.json({
      success: false,
      error: {
        code: "AUTH_FAILED",
        message: `Đăng nhập thất bại: ${errMsg}`,
      },
    }, 401);
  }
});

/**
 * POST /api/auth/qr
 * Đăng nhập bằng QR Code (interactive — chạy trong terminal)
 */
api.post("/auth/qr", async (c) => {
  try {
    const { Zalo } = await import("zca-js");
    const zalo = new Zalo();

    // This will display QR in terminal and wait for scan
    const zaloApi = await zalo.loginQR();
    const ownId = zaloApi.getOwnId();

    // We need the raw credentials to store — this is a limitation
    // For now, return success and the user should use /auth/credentials instead
    return c.json({
      success: true,
      data: {
        zalo_id: String(ownId),
        message: "QR Login thành công! Tuy nhiên, để lưu session lâu dài, hãy dùng /api/auth/credentials với Cookie + IMEI + UA.",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "QR Login failed";
    return c.json({
      success: false,
      error: { code: "AUTH_FAILED", message: errMsg },
    }, 401);
  }
});

// ==========================================
// ACCOUNTS
// ==========================================
api.get("/accounts", async (c) => {
  const accounts = await prisma.zaloAccount.findMany({
    select: {
      id: true,
      zalo_id: true,
      name: true,
      phone: true,
      avatar: true,
      status: true,
      is_default: true,
      last_active_at: true,
      created_at: true,
    },
  });
  return c.json({ success: true, data: accounts });
});

api.get("/accounts/:id", async (c) => {
  const account = await prisma.zaloAccount.findUnique({
    where: { id: c.req.param("id") },
    select: {
      id: true,
      zalo_id: true,
      name: true,
      phone: true,
      avatar: true,
      status: true,
      is_default: true,
      last_active_at: true,
      created_at: true,
      _count: { select: { campaigns: true, sent_messages: true } },
    },
  });
  if (!account) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Account not found" } }, 404);
  return c.json({ success: true, data: account });
});

api.delete("/accounts/:id", async (c) => {
  await prisma.zaloAccount.delete({ where: { id: c.req.param("id") } });
  return c.json({ success: true });
});

// ==========================================
// DISCOVER — Tìm nhóm Zalo theo keyword
// ==========================================
api.post("/discover", async (c) => {
  const body = await c.req.json();
  const { keyword, sources, max_results, validate, account_id } = body;

  if (!keyword || typeof keyword !== "string" || keyword.trim().length < 2) {
    return c.json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "keyword is required (min 2 characters)",
      },
    }, 400);
  }

  try {
    const result = await discoverGroups(keyword.trim(), {
      accountId: account_id,
      sources: sources || ["google", "websites", "cache"],
      maxResults: max_results || 20,
      validateLinks: validate !== false,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: (error as Error).message,
      },
    }, 500);
  }
});

// ==========================================
// GROUPS
// ==========================================
api.get("/groups", async (c) => {
  const query = paginationSchema.parse(c.req.query());
  const where: Record<string, unknown> = { deleted_at: null };
  if (query.search) {
    where.name = { contains: query.search };
  }

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { [query.sort || "created_at"]: query.order },
    }),
    prisma.group.count({ where }),
  ]);

  return c.json({
    success: true,
    data: groups,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.ceil(total / query.limit),
    },
  });
});

api.get("/groups/:id", async (c) => {
  const group = await prisma.group.findUnique({
    where: { id: c.req.param("id") },
    include: {
      _count: { select: { contact_groups: true, campaigns: true, scan_jobs: true } },
    },
  });
  if (!group) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Group not found" } }, 404);
  return c.json({ success: true, data: group });
});

api.get("/groups/:id/members", async (c) => {
  const query = paginationSchema.parse(c.req.query());
  const groupId = c.req.param("id");

  const [members, total] = await Promise.all([
    prisma.contactGroup.findMany({
      where: { group_id: groupId },
      include: { contact: true },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.contactGroup.count({ where: { group_id: groupId } }),
  ]);

  return c.json({
    success: true,
    data: members.map((m) => ({
      ...m.contact,
      role: m.role,
      scanned_at: m.scanned_at,
    })),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.ceil(total / query.limit),
    },
  });
});

api.delete("/groups/:id", async (c) => {
  await prisma.group.update({
    where: { id: c.req.param("id") },
    data: { deleted_at: new Date() },
  });
  return c.json({ success: true });
});

// ==========================================
// SCAN
// ==========================================
api.post("/scan", async (c) => {
  const body = await c.req.json();
  const parsed = scanGroupsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
    }, 400);
  }

  const { group_links, account_id } = parsed.data;
  const results = [];

  for (const link of group_links) {
    // Create scan job
    const job = await prisma.scanJob.create({
      data: {
        account_id: account_id || "default",
        group_link: link,
        status: "scanning",
        started_at: new Date(),
      },
    });

    try {
      const result = await scanGroupByLink(link, account_id, (progress) => {
        broadcast({
          type: "scan:progress",
          payload: { job_id: job.id, link, ...progress },
          timestamp: new Date().toISOString(),
        });
      });

      await prisma.scanJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          group_id: result.groupId,
          members_found: result.membersExtracted,
          new_members: result.newMembers,
          duplicate_members: result.duplicateMembers,
          progress: 100,
          completed_at: new Date(),
        },
      });

      results.push({ link, ...result, status: "completed" });

      broadcast({
        type: "zalo:group-scanned",
        payload: { job_id: job.id, link, ...result },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      await prisma.scanJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          error_message: errMsg,
          completed_at: new Date(),
        },
      });
      results.push({ link, status: "failed", error: errMsg });
    }
  }

  return c.json({
    success: true,
    data: {
      groups_scanned: results.filter((r) => r.status === "completed").length,
      total_results: results.length,
      results,
    },
  });
});

api.get("/scan/history", async (c) => {
  const query = paginationSchema.parse(c.req.query());
  const [jobs, total] = await Promise.all([
    prisma.scanJob.findMany({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { created_at: "desc" },
      include: { group: { select: { name: true } } },
    }),
    prisma.scanJob.count(),
  ]);

  return c.json({
    success: true,
    data: jobs,
    meta: { page: query.page, limit: query.limit, total, total_pages: Math.ceil(total / query.limit) },
  });
});

// ==========================================
// CONTACTS
// ==========================================
api.get("/contacts", async (c) => {
  const query = paginationSchema.parse(c.req.query());
  const status = c.req.query("status");
  const groupId = c.req.query("group_id");

  const where: Record<string, unknown> = { deleted_at: null };
  if (query.search) {
    where.OR = [
      { display_name: { contains: query.search } },
      { zalo_name: { contains: query.search } },
    ];
  }
  if (status) where.outreach_status = status;
  if (groupId) {
    where.contact_groups = { some: { group_id: groupId } };
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { [query.sort || "created_at"]: query.order },
      include: {
        contact_groups: { include: { group: { select: { id: true, name: true } } } },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return c.json({
    success: true,
    data: contacts,
    meta: { page: query.page, limit: query.limit, total, total_pages: Math.ceil(total / query.limit) },
  });
});

api.get("/contacts/:id", async (c) => {
  const contact = await prisma.contact.findUnique({
    where: { id: c.req.param("id") },
    include: {
      contact_groups: { include: { group: true } },
      campaign_contacts: { include: { campaign: { select: { id: true, name: true, status: true } } } },
      conversations: { select: { id: true, total_messages: true, last_message_at: true } },
    },
  });
  if (!contact) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Contact not found" } }, 404);
  return c.json({ success: true, data: contact });
});

api.put("/contacts/:id", async (c) => {
  const body = await c.req.json();
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, 400);
  }

  const contact = await prisma.contact.update({
    where: { id: c.req.param("id") },
    data: parsed.data,
  });
  return c.json({ success: true, data: contact });
});

api.delete("/contacts/:id", async (c) => {
  await prisma.contact.update({
    where: { id: c.req.param("id") },
    data: { deleted_at: new Date() },
  });
  return c.json({ success: true });
});

// ==========================================
// CAMPAIGNS
// ==========================================
api.get("/campaigns", async (c) => {
  const query = paginationSchema.parse(c.req.query());
  const status = c.req.query("status");
  const where: Record<string, unknown> = { deleted_at: null };
  if (status) where.status = status;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { created_at: "desc" },
      include: { template: { select: { name: true } } },
    }),
    prisma.campaign.count({ where }),
  ]);

  return c.json({
    success: true,
    data: campaigns,
    meta: { page: query.page, limit: query.limit, total, total_pages: Math.ceil(total / query.limit) },
  });
});

api.post("/campaigns", async (c) => {
  const body = await c.req.json();
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
    }, 400);
  }

  const { contact_ids, ...campaignData } = parsed.data;

  const campaign = await prisma.campaign.create({
    data: {
      ...campaignData,
      status: "draft",
      total_contacts: contact_ids.length,
    },
  });

  // Create campaign contacts
  for (const contactId of contact_ids) {
    await prisma.campaignContact.create({
      data: {
        campaign_id: campaign.id,
        contact_id: contactId,
        status: "pending",
      },
    });
  }

  return c.json({ success: true, data: campaign }, 201);
});

api.get("/campaigns/:id", async (c) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: c.req.param("id") },
    include: { template: true },
  });
  if (!campaign) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Campaign not found" } }, 404);
  return c.json({ success: true, data: campaign });
});

api.get("/campaigns/:id/stats", async (c) => {
  const campaignId = c.req.param("id");
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Campaign not found" } }, 404);

  const stats = await prisma.campaignContact.groupBy({
    by: ["status"],
    where: { campaign_id: campaignId },
    _count: true,
  });

  const statusMap: Record<string, number> = {};
  for (const s of stats) statusMap[s.status] = s._count;

  return c.json({
    success: true,
    data: {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status,
      stats: {
        total: campaign.total_contacts,
        pending: statusMap["pending"] || 0,
        sent: statusMap["sent"] || 0,
        replied: statusMap["replied"] || 0,
        interested: statusMap["interested"] || 0,
        not_interested: statusMap["not_interested"] || 0,
        blocked: statusMap["blocked"] || 0,
        failed: statusMap["failed"] || 0,
      },
    },
  });
});

api.get("/campaigns/:id/contacts", async (c) => {
  const query = paginationSchema.parse(c.req.query());
  const campaignId = c.req.param("id");

  const [contacts, total] = await Promise.all([
    prisma.campaignContact.findMany({
      where: { campaign_id: campaignId },
      include: { contact: true },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { created_at: "desc" },
    }),
    prisma.campaignContact.count({ where: { campaign_id: campaignId } }),
  ]);

  return c.json({
    success: true,
    data: contacts,
    meta: { page: query.page, limit: query.limit, total, total_pages: Math.ceil(total / query.limit) },
  });
});

api.post("/campaigns/:id/pause", async (c) => {
  await prisma.campaign.update({
    where: { id: c.req.param("id") },
    data: { status: "paused", paused_at: new Date() },
  });
  return c.json({ success: true });
});

api.post("/campaigns/:id/stop", async (c) => {
  await prisma.campaign.update({
    where: { id: c.req.param("id") },
    data: { status: "cancelled" },
  });
  return c.json({ success: true });
});

api.delete("/campaigns/:id", async (c) => {
  await prisma.campaign.update({
    where: { id: c.req.param("id") },
    data: { deleted_at: new Date() },
  });
  return c.json({ success: true });
});

// ==========================================
// TEMPLATES
// ==========================================
api.get("/templates", async (c) => {
  const category = c.req.query("category");
  const where: Record<string, unknown> = { deleted_at: null };
  if (category) where.category = category;

  const templates = await prisma.template.findMany({ where, orderBy: { created_at: "desc" } });
  return c.json({ success: true, data: templates });
});

api.post("/templates", async (c) => {
  const body = await c.req.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, 400);
  }

  const template = await prisma.template.create({ data: parsed.data });
  return c.json({ success: true, data: template }, 201);
});

api.get("/templates/:id", async (c) => {
  const template = await prisma.template.findUnique({ where: { id: c.req.param("id") } });
  if (!template) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Template not found" } }, 404);
  return c.json({ success: true, data: template });
});

api.put("/templates/:id", async (c) => {
  const body = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, 400);
  }

  const template = await prisma.template.update({
    where: { id: c.req.param("id") },
    data: parsed.data,
  });
  return c.json({ success: true, data: template });
});

api.delete("/templates/:id", async (c) => {
  await prisma.template.update({
    where: { id: c.req.param("id") },
    data: { deleted_at: new Date() },
  });
  return c.json({ success: true });
});

api.post("/templates/preview", async (c) => {
  const body = await c.req.json();
  const { content, variants } = body;

  const { content: picked } = pickTemplateVariant(content, variants);
  const preview = replaceTemplateVars(picked, {
    tên: "Nguyễn Văn A",
    nhóm: "Hội Marketing VN",
    sản_phẩm: "Khóa học SEO",
  });

  return c.json({ success: true, data: { preview, original: picked } });
});

// ==========================================
// DIRECT REPLY — Hub gọi để reply bằng zalo_id
// ==========================================
api.post("/conversations/direct-reply", async (c) => {
  const { zalo_id, message } = await c.req.json();
  if (!zalo_id || !message) {
    return c.json({ success: false, error: "zalo_id and message required" }, 400);
  }

  try {
    const { getZaloClient } = await import("../lib/zalo/client.js");
    const api = await getZaloClient();
    await api.sendMessage(message, zalo_id);
    return c.json({ success: true, sent: true, to: zalo_id });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// ==========================================
// CONVERSATIONS
// ==========================================
api.get("/conversations", async (c) => {
  const query = paginationSchema.parse(c.req.query());

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { last_message_at: "desc" },
      include: {
        contact: { select: { id: true, display_name: true, avatar: true, outreach_status: true } },
      },
    }),
    prisma.conversation.count(),
  ]);

  return c.json({
    success: true,
    data: conversations,
    meta: { page: query.page, limit: query.limit, total, total_pages: Math.ceil(total / query.limit) },
  });
});

api.get("/conversations/:id", async (c) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: c.req.param("id") },
    include: { contact: true },
  });
  if (!conversation) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Conversation not found" } }, 404);
  return c.json({ success: true, data: conversation });
});

api.get("/conversations/:id/messages", async (c) => {
  const query = paginationSchema.parse(c.req.query());
  const conversationId = c.req.param("id");

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversation_id: conversationId },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { created_at: "asc" },
    }),
    prisma.message.count({ where: { conversation_id: conversationId } }),
  ]);

  return c.json({
    success: true,
    data: messages,
    meta: { page: query.page, limit: query.limit, total, total_pages: Math.ceil(total / query.limit) },
  });
});

api.post("/conversations/:id/messages", async (c) => {
  const conversationId = c.req.param("id");
  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, 400);
  }

  const result = await sendMessage(parsed.data.contact_id, parsed.data.message, parsed.data.account_id);
  return c.json({ success: true, data: result });
});

// ==========================================
// DASHBOARD
// ==========================================
api.get("/dashboard/stats", async (c) => {
  const [
    totalContacts,
    totalGroups,
    totalCampaigns,
    totalMessages,
    newToday,
    statusCounts,
  ] = await Promise.all([
    prisma.contact.count({ where: { deleted_at: null } }),
    prisma.group.count({ where: { deleted_at: null } }),
    prisma.campaign.count({ where: { deleted_at: null } }),
    prisma.message.count(),
    prisma.contact.count({
      where: {
        created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.contact.groupBy({
      by: ["outreach_status"],
      _count: true,
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const s of statusCounts) statusMap[s.outreach_status] = s._count;

  return c.json({
    success: true,
    data: {
      total_contacts: totalContacts,
      total_groups: totalGroups,
      total_campaigns: totalCampaigns,
      total_messages: totalMessages,
      new_contacts_today: newToday,
      contacts_by_status: statusMap,
    },
  });
});

// ==========================================
// CONVERSATION SCORING — Đánh giá hội thoại
// ==========================================

/**
 * GET /api/scoring/stats
 * Tổng quan scoring — Hub gọi để lấy báo cáo
 */
api.get("/scoring/stats", async (c) => {
  try {
    const stats = await getConversationStats();
    return c.json({ success: true, data: stats });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * GET /api/scoring/leads?status=hot&limit=20
 * Danh sách leads theo trạng thái
 */
api.get("/scoring/leads", async (c) => {
  try {
    const status = c.req.query("status") || "hot";
    const limit = parseInt(c.req.query("limit") || "20");

    const leads = await prisma.conversationScore.findMany({
      where: { lead_status: status },
      include: {
        contact: {
          select: {
            id: true, display_name: true, zalo_id: true,
            phone: true, avatar: true, outreach_status: true,
          },
        },
        conversation: {
          select: {
            id: true, total_messages: true, inbound_count: true,
            outbound_count: true, last_message_at: true,
          },
        },
      },
      orderBy: { interest_score: "desc" },
      take: limit,
    });

    return c.json({
      success: true,
      data: {
        status,
        count: leads.length,
        leads: leads.map(l => ({
          contact: l.contact,
          conversation_id: l.conversation.id,
          scores: {
            interest: l.interest_score,
            intent: l.intent_score,
            engagement: l.engagement_score,
            sentiment: l.sentiment_score,
          },
          lead_status: l.lead_status,
          buying_signals: l.buying_signals ? JSON.parse(l.buying_signals) : [],
          rejection_signals: l.rejection_signals ? JSON.parse(l.rejection_signals) : [],
          avg_reply_time: l.avg_reply_time_seconds,
          total_messages: l.conversation.total_messages,
          next_action: l.ai_next_action,
          last_activity: l.last_activity_at,
        })),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * GET /api/scoring/conversation/:id
 * Chi tiết scoring 1 conversation
 */
api.get("/scoring/conversation/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const score = await prisma.conversationScore.findFirst({
      where: { conversation_id: id },
      include: {
        contact: true,
        conversation: {
          include: {
            messages: {
              orderBy: { created_at: "asc" },
              take: 50,
            },
          },
        },
      },
    });

    if (!score) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Score not found" } }, 404);
    }

    return c.json({
      success: true,
      data: {
        contact: {
          name: score.contact.display_name,
          zalo_id: score.contact.zalo_id,
          phone: score.contact.phone,
        },
        scores: {
          interest: score.interest_score,
          intent: score.intent_score,
          engagement: score.engagement_score,
          sentiment: score.sentiment_score,
        },
        lead_status: score.lead_status,
        buying_signals: score.buying_signals ? JSON.parse(score.buying_signals) : [],
        rejection_signals: score.rejection_signals ? JSON.parse(score.rejection_signals) : [],
        reply_metrics: {
          avg_reply_time_seconds: score.avg_reply_time_seconds,
          reply_rate: score.reply_rate,
          total_words_received: score.total_words_received,
          longest_message: score.longest_message_chars,
        },
        ai: {
          summary: score.ai_summary,
          next_action: score.ai_next_action,
          analyzed_at: score.ai_analyzed_at,
        },
        messages: score.conversation.messages.map(m => ({
          direction: m.direction,
          content: m.content,
          time: m.created_at,
        })),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * GET /api/messages/pending
 * Tin nhắn đến chưa xử lý — Hub poll endpoint
 */
api.get("/messages/pending", async (c) => {
  try {
    const messages = await prisma.message.findMany({
      where: { direction: "inbound" },
      include: {
        contact: { select: { display_name: true, zalo_id: true } },
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    return c.json({
      success: true,
      count: messages.length,
      data: messages.map(m => ({
        id: m.id,
        sender_name: m.contact.display_name,
        sender_id: m.contact.zalo_id,
        content: m.content,
        conversation_id: m.conversation_id,
        timestamp: m.created_at,
      })),
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * GET /api/activity?limit=50
 * Lịch sử hoạt động
 */
api.get("/activity", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const logs = await prisma.activityLog.findMany({
      orderBy: { created_at: "desc" },
      take: limit,
    });

    return c.json({
      success: true,
      data: logs.map(l => ({
        ...l,
        details: l.details ? JSON.parse(l.details) : null,
      })),
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

// ==========================================
// AI — Test & Control
// ==========================================

/**
 * GET /api/ai/test
 * Test AI connection
 */
api.get("/ai/test", async (c) => {
  try {
    const result = await testAI();
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * POST /api/ai/toggle
 * Bật/tắt auto-reply
 */
api.post("/ai/toggle", async (c) => {
  try {
    const { enabled } = await c.req.json();
    await prisma.setting.upsert({
      where: { key: "ai_auto_reply" },
      update: { value: String(enabled) },
      create: { key: "ai_auto_reply", value: String(enabled) },
    });
    return c.json({ success: true, data: { ai_auto_reply: enabled } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * POST /api/ai/config
 * Cập nhật business context + reply style
 */
api.post("/ai/config", async (c) => {
  try {
    const { business_context, reply_style } = await c.req.json();
    if (business_context) {
      await prisma.setting.upsert({
        where: { key: "ai_business_context" },
        update: { value: JSON.stringify(business_context) },
        create: { key: "ai_business_context", value: JSON.stringify(business_context) },
      });
    }
    if (reply_style) {
      await prisma.setting.upsert({
        where: { key: "ai_reply_style" },
        update: { value: JSON.stringify(reply_style) },
        create: { key: "ai_reply_style", value: JSON.stringify(reply_style) },
      });
    }
    return c.json({ success: true, data: { updated: true } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

// ==========================================
// KNOWLEDGE BASE — Quản lý tài liệu
// ==========================================

/**
 * GET /api/knowledge
 * Danh sách tất cả docs
 */
api.get("/knowledge", async (c) => {
  try {
    const category = c.req.query("category");
    const where: any = { is_active: true };
    if (category) where.category = category;

    const docs = await prisma.knowledgeDoc.findMany({
      where,
      orderBy: [{ priority: "asc" }, { category: "asc" }],
    });
    return c.json({
      success: true,
      data: {
        total: docs.length,
        categories: [...new Set(docs.map(d => d.category))],
        docs: docs.map(d => ({
          id: d.id,
          category: d.category,
          title: d.title,
          content: d.content,
          tags: d.tags ? JSON.parse(d.tags) : [],
          keywords: d.keywords,
          priority: d.priority,
        })),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * POST /api/knowledge
 * Thêm doc mới
 */
api.post("/knowledge", async (c) => {
  try {
    const body = await c.req.json();
    const doc = await prisma.knowledgeDoc.create({
      data: {
        category: body.category || "other",
        title: body.title,
        content: body.content,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        keywords: body.keywords || null,
        priority: body.priority || 5,
      },
    });
    return c.json({ success: true, data: doc });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * PUT /api/knowledge/:id
 * Cập nhật doc
 */
api.put("/knowledge/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const doc = await prisma.knowledgeDoc.update({
      where: { id },
      data: {
        ...(body.category && { category: body.category }),
        ...(body.title && { title: body.title }),
        ...(body.content && { content: body.content }),
        ...(body.tags && { tags: JSON.stringify(body.tags) }),
        ...(body.keywords !== undefined && { keywords: body.keywords }),
        ...(body.priority && { priority: body.priority }),
      },
    });
    return c.json({ success: true, data: doc });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

/**
 * DELETE /api/knowledge/:id
 * Xóa doc (soft delete)
 */
api.delete("/knowledge/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await prisma.knowledgeDoc.update({
      where: { id },
      data: { is_active: false },
    });
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } }, 500);
  }
});

export default api;
