import { Hono } from "hono";
import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "../lib/db.js";
import { getActiveClientCount } from "../lib/zalo/client.js";
import { getConnectedCount } from "../lib/ws.js";
import { executeSchema } from "../lib/validations.js";
import { scanGroupByLink } from "../lib/zalo/scanner.js";
import { sendMessage } from "../lib/zalo/messenger.js";
import { discoverGroups } from "../lib/zalo/discoverer.js";
import { nanoid } from "nanoid";
import type { PluginResponse, AsyncJobResponse } from "../types/index.js";

const protocol = new Hono();

const startTime = Date.now();

// ==========================================
// GET /health
// ==========================================
protocol.get("/health", async (c) => {
  let dbStatus: "healthy" | "unhealthy" = "unhealthy";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "healthy";
  } catch {
    dbStatus = "unhealthy";
  }

  const zaloStatus =
    getActiveClientCount() > 0 ? "healthy" : "unhealthy";

  const overallStatus =
    dbStatus === "healthy"
      ? zaloStatus === "healthy"
        ? "healthy"
        : "degraded"
      : "unhealthy";

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return c.json(
    {
      status: overallStatus,
      version: "1.0.0",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: dbStatus,
        zalo_connection: zaloStatus,
        websocket_clients: getConnectedCount(),
      },
    },
    statusCode
  );
});

// ==========================================
// GET /manifest
// ==========================================
protocol.get("/manifest", (c) => {
  try {
    const manifestPath = resolve(process.cwd(), "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    return c.json(manifest);
  } catch {
    return c.json({ error: "manifest.json not found" }, 500);
  }
});

// ==========================================
// POST /execute — Execute a capability
// ==========================================
protocol.post("/execute", async (c) => {
  const body = await c.req.json();
  const parsed = executeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json<PluginResponse>(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
      },
      400
    );
  }

  const { capability_id, input } = parsed.data;
  const requestId = c.req.header("X-Request-ID") || nanoid();
  const startMs = Date.now();

  try {
    switch (capability_id) {
      // --- discover-groups (sync) ---
      case "discover-groups": {
        const keyword = input.keyword as string;
        const sources = input.sources as string[] | undefined;
        const maxResults = input.max_results as number | undefined;
        const accountId = input.account_id as string | undefined;

        if (!keyword) {
          return c.json<PluginResponse>(
            {
              success: false,
              error: { code: "VALIDATION_ERROR", message: "keyword is required" },
            },
            400
          );
        }

        const result = await discoverGroups(keyword, {
          accountId,
          sources: sources as any,
          maxResults: maxResults || 20,
          validateLinks: true,
        });

        return c.json<PluginResponse>({
          success: true,
          data: result,
          meta: { duration_ms: Date.now() - startMs },
        });
      }

      // --- scan-group-members (async) ---
      case "scan-group-members": {
        const groupLinks = input.group_links as string[];
        const accountId = input.account_id as string | undefined;

        if (!groupLinks?.length) {
          return c.json<PluginResponse>(
            {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "group_links is required",
              },
            },
            400
          );
        }

        // Create scan jobs
        const jobIds: string[] = [];
        for (const link of groupLinks) {
          const job = await prisma.scanJob.create({
            data: {
              account_id: accountId || "default",
              group_link: link,
              status: "queued",
            },
          });
          jobIds.push(job.id);
        }

        const batchId = jobIds[0]; // Use first job ID as batch reference

        return c.json<AsyncJobResponse>(
          {
            success: true,
            request_id: requestId,
            job_id: batchId,
            status: "queued",
            poll_url: `/jobs/${batchId}`,
            cancel_url: `/jobs/${batchId}/cancel`,
          },
          202
        );
      }

      // --- send-outreach-message (sync) ---
      case "send-outreach-message": {
        const contactId = input.contact_id as string;
        const message = input.message as string;
        const accountId = input.account_id as string | undefined;

        const result = await sendMessage(contactId, message, accountId);

        return c.json<PluginResponse>({
          success: result.success,
          data: {
            sent: result.success,
            message_id: result.messageId,
            sent_at: result.sentAt.toISOString(),
          },
          meta: { duration_ms: Date.now() - startMs },
          ...(result.error && {
            error: {
              code: "SEND_FAILED",
              message: result.error,
            },
          }),
        });
      }

      // --- run-campaign (async) ---
      case "run-campaign": {
        const name = input.campaign_name as string;
        const contactIds = input.contact_ids as string[];
        const templateId = input.template_id as string;
        const settings = (input.settings as Record<string, unknown>) || {};

        // Verify template exists
        const template = await prisma.template.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return c.json<PluginResponse>(
            {
              success: false,
              error: {
                code: "NOT_FOUND",
                message: `Template ${templateId} not found`,
              },
            },
            404
          );
        }

        // Create campaign
        const campaign = await prisma.campaign.create({
          data: {
            name,
            account_id: (settings.account_id as string) || "default",
            template_id: templateId,
            delay_min_seconds: (settings.delay_min_seconds as number) || 30,
            delay_max_seconds: (settings.delay_max_seconds as number) || 120,
            max_per_day: (settings.max_per_day as number) || 50,
            active_hours_start:
              (settings.active_hours_start as string) || "08:00",
            active_hours_end:
              (settings.active_hours_end as string) || "21:00",
            status: "queued",
            total_contacts: contactIds.length,
          },
        });

        // Create campaign_contacts
        for (const cid of contactIds) {
          await prisma.campaignContact.create({
            data: {
              campaign_id: campaign.id,
              contact_id: cid,
              status: "pending",
            },
          });
        }

        return c.json<AsyncJobResponse>(
          {
            success: true,
            request_id: requestId,
            job_id: campaign.id,
            status: "queued",
            poll_url: `/jobs/${campaign.id}`,
            cancel_url: `/jobs/${campaign.id}/cancel`,
          },
          202
        );
      }

      // --- get-campaign-stats (sync) ---
      case "get-campaign-stats": {
        const campaignId = input.campaign_id as string;
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
        });

        if (!campaign) {
          return c.json<PluginResponse>(
            {
              success: false,
              error: {
                code: "NOT_FOUND",
                message: `Campaign ${campaignId} not found`,
              },
            },
            404
          );
        }

        const stats = await prisma.campaignContact.groupBy({
          by: ["status"],
          where: { campaign_id: campaignId },
          _count: true,
        });

        const statusMap: Record<string, number> = {};
        for (const s of stats) {
          statusMap[s.status] = s._count;
        }

        return c.json<PluginResponse>({
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
          meta: { duration_ms: Date.now() - startMs },
        });
      }

      // --- export-contacts (sync) ---
      case "export-contacts": {
        const format = (input.format as string) || "json";
        const filters = (input.filters as Record<string, unknown>) || {};

        const where: Record<string, unknown> = { deleted_at: null };
        if (filters.statuses && Array.isArray(filters.statuses)) {
          where.outreach_status = { in: filters.statuses };
        }
        if (filters.tags && Array.isArray(filters.tags)) {
          // Tags stored as JSON string — filter in app layer
        }

        const contacts = await prisma.contact.findMany({
          where,
          include: {
            contact_groups: { include: { group: true } },
          },
        });

        const exported = contacts.map((c) => ({
          id: c.id,
          zalo_id: c.zalo_id,
          display_name: c.display_name,
          zalo_name: c.zalo_name,
          outreach_status: c.outreach_status,
          interest_score: c.interest_score,
          tags: c.tags,
          groups: c.contact_groups.map((cg) => cg.group.name),
          last_contacted_at: c.last_contacted_at,
          last_replied_at: c.last_replied_at,
        }));

        if (format === "csv") {
          const headers = Object.keys(exported[0] || {}).join(",");
          const rows = exported.map((r) =>
            Object.values(r)
              .map((v) =>
                Array.isArray(v)
                  ? `"${v.join("; ")}"`
                  : v === null
                    ? ""
                    : `"${String(v)}"`
              )
              .join(",")
          );
          const csv = [headers, ...rows].join("\n");

          return c.json<PluginResponse>({
            success: true,
            data: {
              content: csv,
              total_exported: exported.length,
              format: "csv",
            },
            meta: { duration_ms: Date.now() - startMs },
          });
        }

        return c.json<PluginResponse>({
          success: true,
          data: {
            contacts: exported,
            total_exported: exported.length,
            format: "json",
          },
          meta: { duration_ms: Date.now() - startMs },
        });
      }

      default:
        return c.json<PluginResponse>(
          {
            success: false,
            error: {
              code: "INVALID_CAPABILITY",
              message: `Unknown capability: ${capability_id}`,
            },
          },
          400
        );
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Execute] ${capability_id} error:`, errMsg);

    return c.json<PluginResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: errMsg,
        },
      },
      500
    );
  }
});

// ==========================================
// GET /jobs/:id — Job status
// ==========================================
protocol.get("/jobs/:id", async (c) => {
  const jobId = c.req.param("id");

  // Check scan jobs first
  const scanJob = await prisma.scanJob.findUnique({
    where: { id: jobId },
  });

  if (scanJob) {
    return c.json<AsyncJobResponse>({
      success: true,
      request_id: jobId,
      job_id: scanJob.id,
      status: scanJob.status as AsyncJobResponse["status"],
      progress: scanJob.progress,
      poll_url: `/jobs/${scanJob.id}`,
      cancel_url: `/jobs/${scanJob.id}/cancel`,
      started_at: scanJob.started_at?.toISOString(),
      completed_at: scanJob.completed_at?.toISOString(),
      ...(scanJob.status === "completed" && {
        result: {
          members_found: scanJob.members_found,
          new_members: scanJob.new_members,
          duplicate_members: scanJob.duplicate_members,
        },
      }),
      ...(scanJob.error_message && { error: scanJob.error_message }),
    });
  }

  // Check campaigns
  const campaign = await prisma.campaign.findUnique({
    where: { id: jobId },
  });

  if (campaign) {
    const progress =
      campaign.total_contacts > 0
        ? Math.round((campaign.sent_count / campaign.total_contacts) * 100)
        : 0;

    return c.json<AsyncJobResponse>({
      success: true,
      request_id: jobId,
      job_id: campaign.id,
      status: campaign.status as AsyncJobResponse["status"],
      progress,
      poll_url: `/jobs/${campaign.id}`,
      cancel_url: `/jobs/${campaign.id}/cancel`,
      started_at: campaign.started_at?.toISOString(),
      completed_at: campaign.completed_at?.toISOString(),
      result: {
        total: campaign.total_contacts,
        sent: campaign.sent_count,
        replied: campaign.replied_count,
        interested: campaign.interested_count,
      },
    });
  }

  return c.json<PluginResponse>(
    {
      success: false,
      error: { code: "NOT_FOUND", message: `Job ${jobId} not found` },
    },
    404
  );
});

// ==========================================
// DELETE /jobs/:id/cancel
// ==========================================
protocol.delete("/jobs/:id/cancel", async (c) => {
  const jobId = c.req.param("id");

  const scanJob = await prisma.scanJob.findUnique({
    where: { id: jobId },
  });

  if (scanJob) {
    await prisma.scanJob.update({
      where: { id: jobId },
      data: { status: "cancelled" },
    });
    return c.json({ success: true, job_id: jobId, status: "cancelled" });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: jobId },
  });

  if (campaign) {
    await prisma.campaign.update({
      where: { id: jobId },
      data: { status: "cancelled" },
    });
    return c.json({ success: true, job_id: jobId, status: "cancelled" });
  }

  return c.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: `Job ${jobId} not found` },
    },
    404
  );
});

// ==========================================
// GET /settings — Settings schema
// ==========================================
protocol.get("/settings", async (c) => {
  const settings = await prisma.setting.findMany();
  const obj: Record<string, string> = {};
  for (const s of settings) {
    obj[s.key] = s.value;
  }
  return c.json({ success: true, data: obj });
});

// ==========================================
// PUT /settings — Update settings
// ==========================================
protocol.put("/settings", async (c) => {
  const body = await c.req.json();

  for (const [key, value] of Object.entries(body)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  const settings = await prisma.setting.findMany();
  const obj: Record<string, string> = {};
  for (const s of settings) {
    obj[s.key] = s.value;
  }
  return c.json({ success: true, data: obj });
});

// ==========================================
// POST /webhooks/events — Receive Hub events
// ==========================================
protocol.post("/webhooks/events", async (c) => {
  const body = await c.req.json();
  console.log("[Webhook] Received event:", body.event_type);
  // Handle hub events here in the future
  return c.json({ success: true });
});

export default protocol;
