/**
 * SCHEDULER — Cron-based job scheduler
 * Check mỗi phút, chạy workflow đúng lịch
 */
import { prisma } from "./db.js";
import { runWorkflow } from "./workflow-engine.js";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Parse cron expression và check có nên chạy không
 * Hỗ trợ: "* * * * *" (min hour day month weekday)
 */
function shouldRunNow(cronExpr: string, timezone: string = "Asia/Ho_Chi_Minh"): boolean {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minExpr, hourExpr, dayExpr, monthExpr, weekdayExpr] = parts;
  const min = now.getMinutes();
  const hour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const weekday = now.getDay(); // 0=Sun

  return (
    matchCron(minExpr, min) &&
    matchCron(hourExpr, hour) &&
    matchCron(dayExpr, day) &&
    matchCron(monthExpr, month) &&
    matchCron(weekdayExpr, weekday)
  );
}

function matchCron(expr: string, value: number): boolean {
  if (expr === "*") return true;

  // */N — every N
  if (expr.startsWith("*/")) {
    const interval = parseInt(expr.slice(2));
    return value % interval === 0;
  }

  // Comma-separated: 1,5,10
  if (expr.includes(",")) {
    return expr.split(",").map(Number).includes(value);
  }

  // Range: 1-5
  if (expr.includes("-")) {
    const [start, end] = expr.split("-").map(Number);
    return value >= start && value <= end;
  }

  // Exact match
  return parseInt(expr) === value;
}

/**
 * Check and run due schedules
 */
async function checkSchedules(): Promise<void> {
  const schedules = await prisma.schedule.findMany({
    where: { is_active: true },
  });

  for (const schedule of schedules) {
    if (!shouldRunNow(schedule.cron_expression, schedule.timezone)) continue;

    // Prevent double-run: check if already ran this minute
    if (schedule.last_run_at) {
      const lastRun = new Date(schedule.last_run_at);
      const now = new Date();
      if (
        lastRun.getFullYear() === now.getFullYear() &&
        lastRun.getMonth() === now.getMonth() &&
        lastRun.getDate() === now.getDate() &&
        lastRun.getHours() === now.getHours() &&
        lastRun.getMinutes() === now.getMinutes()
      ) {
        continue; // Already ran this minute
      }
    }

    console.log(`[Scheduler] Running: ${schedule.name} (${schedule.cron_expression})`);

    try {
      if (schedule.workflow_id) {
        await runWorkflow(schedule.workflow_id, `cron:${schedule.cron_expression}`);
      }

      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          last_run_at: new Date(),
          run_count: { increment: 1 },
          consecutive_failures: 0,
          last_error: null,
        },
      });
    } catch (err: any) {
      console.error(`[Scheduler] Failed: ${schedule.name}:`, err.message);

      const failures = schedule.consecutive_failures + 1;
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          consecutive_failures: failures,
          last_error: err.message,
          // Auto-disable after 5 consecutive failures
          ...(failures >= 5 && { is_active: false }),
        },
      });

      // Alert
      await prisma.monitorAlert.create({
        data: {
          severity: failures >= 5 ? "critical" : "warning",
          source: "scheduler",
          title: `Schedule failed: ${schedule.name}`,
          message: `${err.message} (${failures} consecutive failures${failures >= 5 ? " — AUTO DISABLED" : ""})`,
          details: JSON.stringify({ schedule_id: schedule.id, workflow_id: schedule.workflow_id }),
        },
      });
    }
  }
}

/**
 * Start scheduler — check mỗi 60 giây
 */
export function startScheduler(): void {
  if (schedulerInterval) return;
  console.log("[Scheduler] Started — checking every 60s");
  schedulerInterval = setInterval(checkSchedules, 60 * 1000);
  // Run immediately on start
  checkSchedules();
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped");
  }
}
