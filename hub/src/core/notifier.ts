/**
 * NOTIFIER — Hub tự nhắn tin cho admin khi có sự kiện quan trọng
 *
 * Channels: Zalo (qua zalo-outreach), Telegram (sau này)
 * Events: HOT lead, system error, daily report, workflow complete
 */
import { prisma } from "./db.js";

const ZALO_OUTREACH_URL = process.env.ZALO_OUTREACH_URL || "http://localhost:3010";

// Admin Zalo ID (cập nhật sau khi biết)
let adminZaloId: string | null = null;
let adminContactId: string | null = null;

/**
 * Set admin Zalo contact for notifications
 */
export function setAdminZalo(zaloId: string, contactId: string): void {
  adminZaloId = zaloId;
  adminContactId = contactId;
  console.log(`[Notifier] Admin Zalo set: ${zaloId}`);
}

/**
 * Send notification to admin via Zalo
 */
async function sendZaloNotification(message: string): Promise<boolean> {
  if (!adminContactId) {
    console.log("[Notifier] No admin Zalo set, skipping:", message.slice(0, 50));
    return false;
  }

  try {
    const resp = await fetch(`${ZALO_OUTREACH_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capability_id: "send-outreach-message",
        input: { contact_id: adminContactId, message },
      }),
    });

    const data = await resp.json();
    return data.success === true;
  } catch (err: any) {
    console.error("[Notifier] Zalo send failed:", err.message);
    return false;
  }
}

/**
 * Notify: HOT lead detected
 */
export async function notifyHotLead(contactName: string, signals: string[], conversationId: string): Promise<void> {
  const msg = `🔥 KHÁCH HOT: ${contactName}\nTín hiệu: ${signals.join(", ")}\nCần chốt deal ngay!`;
  await sendZaloNotification(msg);

  await prisma.activityLog.create({
    data: {
      type: "notification_sent",
      details: JSON.stringify({ channel: "zalo", event: "hot_lead", contact: contactName }),
    },
  });
}

/**
 * Notify: System error
 */
export async function notifySystemError(appName: string, error: string): Promise<void> {
  const msg = `⚠️ LỖI HỆ THỐNG\nApp: ${appName}\nLỗi: ${error}\nHub đang kiểm tra...`;
  await sendZaloNotification(msg);
}

/**
 * Notify: Daily report
 */
export async function notifyDailyReport(report: {
  zalo_messages: number;
  hot_leads: number;
  deals_closed: number;
  videos_created: number;
  posts_published: number;
  token_cost: number;
}): Promise<void> {
  const msg = `📊 BÁO CÁO NGÀY ${new Date().toLocaleDateString("vi-VN")}

💬 Zalo: ${report.zalo_messages} tin nhắn
🔥 HOT leads: ${report.hot_leads}
✅ Chốt đơn: ${report.deals_closed}
🎬 Video: ${report.videos_created}
📝 Bài đăng: ${report.posts_published}
💰 Chi phí AI: $${report.token_cost.toFixed(2)}

Xem chi tiết tại dashboard.`;

  await sendZaloNotification(msg);
}

/**
 * Notify: Workflow completed
 */
export async function notifyWorkflowComplete(
  workflowName: string,
  status: string,
  duration: number
): Promise<void> {
  const emoji = status === "completed" ? "✅" : "❌";
  const msg = `${emoji} Workflow: ${workflowName}\nTrạng thái: ${status}\nThời gian: ${Math.round(duration / 1000)}s`;
  await sendZaloNotification(msg);
}

/**
 * Generate and send daily report
 */
export async function generateDailyReport(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Collect data from app cons
    const [zaloScoring, tokenStats] = await Promise.all([
      fetch(`${ZALO_OUTREACH_URL}/api/scoring/stats`).then((r) => r.json()).catch(() => ({ data: {} })),
      getTokenStatsForReport(),
    ]);

    const report = {
      zalo_messages: zaloScoring.data?.total || 0,
      hot_leads: zaloScoring.data?.by_status?.hot || 0,
      deals_closed: zaloScoring.data?.by_status?.converted || 0,
      videos_created: 0, // TODO: from video-creator
      posts_published: 0, // TODO: from social-manager
      token_cost: tokenStats.cost,
      by_status: zaloScoring.data?.by_status || {},
      avg_interest: zaloScoring.data?.avg_interest_score || 0,
    };

    // Save to DB
    await prisma.dailyReport.upsert({
      where: { report_date: today },
      update: { data: JSON.stringify(report) },
      create: { report_date: today, data: JSON.stringify(report) },
    });

    // Notify admin
    await notifyDailyReport(report);

    console.log(`[Reporter] Daily report generated for ${today}`);
  } catch (err: any) {
    console.error("[Reporter] Failed to generate daily report:", err.message);
  }
}

async function getTokenStatsForReport(): Promise<{ cost: number; tokens: number }> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const summaries = await prisma.tokenDailySummary.findMany({ where: { date: today } });
    return {
      cost: summaries.reduce((s, d) => s + d.total_cost_usd, 0),
      tokens: summaries.reduce((s, d) => s + d.total_tokens, 0),
    };
  } catch {
    return { cost: 0, tokens: 0 };
  }
}
