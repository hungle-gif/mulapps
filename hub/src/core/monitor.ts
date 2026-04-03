/**
 * MONITOR — Health check + Alert system
 * Check app con mỗi 30s, tạo alert khi có sự cố
 */
import { prisma } from "./db.js";

let monitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check health of all registered apps
 */
async function checkAllAppsHealth(): Promise<void> {
  const apps = await prisma.app.findMany({
    where: { status: { not: "disabled" } },
  });

  for (const app of apps) {
    const startTime = Date.now();
    let status = "offline";
    let details: any = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(`${app.base_url}/health`, { signal: controller.signal });
      clearTimeout(timeout);

      const responseMs = Date.now() - startTime;

      if (resp.ok) {
        const data = await resp.json();
        status = data.status || "healthy";
        details = data.checks || data;

        // Check sub-components
        if (data.checks) {
          const unhealthy = Object.entries(data.checks).filter(([, v]) => v === "unhealthy");
          if (unhealthy.length > 0) {
            status = "degraded";
          }
        }
      } else {
        status = "degraded";
        details = { http_status: resp.status };
      }

      // Save health check
      await prisma.healthCheck.create({
        data: {
          app_id: app.app_id,
          status,
          response_ms: responseMs,
          details: JSON.stringify(details),
        },
      });

      // Update app status
      const prevStatus = app.status;
      await prisma.app.update({
        where: { id: app.id },
        data: {
          status,
          health_miss: status === "offline" ? app.health_miss + 1 : 0,
          last_health: new Date(),
        },
      });

      // Alert on status change
      if (prevStatus !== status) {
        if (status === "offline" || status === "degraded") {
          await prisma.monitorAlert.create({
            data: {
              severity: status === "offline" ? "critical" : "warning",
              source: app.app_id,
              title: `${app.name} is ${status}`,
              message: `Status changed from ${prevStatus} to ${status}. Response: ${responseMs}ms`,
              details: JSON.stringify(details),
            },
          });
          console.log(`[Monitor] ⚠️ ${app.name}: ${prevStatus} → ${status}`);
        } else if (prevStatus === "offline" || prevStatus === "degraded") {
          // Recovered!
          await prisma.monitorAlert.create({
            data: {
              severity: "info",
              source: app.app_id,
              title: `${app.name} recovered`,
              message: `Status changed from ${prevStatus} to ${status}`,
              status: "resolved",
              resolved_at: new Date(),
              resolved_by: "auto",
            },
          });
          console.log(`[Monitor] ✅ ${app.name}: ${prevStatus} → ${status} (recovered)`);
        }
      }
    } catch (err: any) {
      const responseMs = Date.now() - startTime;
      status = "offline";

      await prisma.healthCheck.create({
        data: {
          app_id: app.app_id,
          status: "offline",
          response_ms: responseMs,
          details: JSON.stringify({ error: err.message }),
        },
      });

      const newMiss = app.health_miss + 1;
      await prisma.app.update({
        where: { id: app.id },
        data: {
          status: "offline",
          health_miss: newMiss,
          last_health: new Date(),
        },
      });

      // Alert after 3 consecutive misses
      if (newMiss === 3) {
        await prisma.monitorAlert.create({
          data: {
            severity: "critical",
            source: app.app_id,
            title: `${app.name} is DOWN`,
            message: `${newMiss} consecutive health check failures. Error: ${err.message}`,
          },
        });
        console.log(`[Monitor] 🔴 ${app.name} DOWN (${newMiss} misses)`);
      }
    }
  }
}

/**
 * Get current system status
 */
export async function getSystemStatus(): Promise<{
  apps: { id: string; name: string; status: string; last_health: Date | null }[];
  alerts: { id: string; severity: string; title: string; created_at: Date }[];
  health_summary: { healthy: number; degraded: number; offline: number };
}> {
  const apps = await prisma.app.findMany({
    select: { app_id: true, name: true, status: true, last_health: true },
  });

  const openAlerts = await prisma.monitorAlert.findMany({
    where: { status: "open" },
    orderBy: { created_at: "desc" },
    take: 20,
  });

  const healthy = apps.filter((a) => a.status === "healthy" || a.status === "active").length;
  const degraded = apps.filter((a) => a.status === "degraded").length;
  const offline = apps.filter((a) => a.status === "offline").length;

  return {
    apps: apps.map((a) => ({ id: a.app_id, name: a.name, status: a.status, last_health: a.last_health })),
    alerts: openAlerts.map((a) => ({ id: a.id, severity: a.severity, title: a.title, created_at: a.created_at })),
    health_summary: { healthy, degraded, offline },
  };
}

/**
 * Start monitor — check mỗi 30 giây
 */
export function startMonitor(): void {
  if (monitorInterval) return;
  console.log("[Monitor] Started — checking every 30s");
  monitorInterval = setInterval(checkAllAppsHealth, 30 * 1000);
  // First check after 5s (let apps start)
  setTimeout(checkAllAppsHealth, 5000);
}

export function stopMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("[Monitor] Stopped");
  }
}
