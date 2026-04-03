/**
 * App Registry — Đăng ký, quản lý, health check app con
 */
import { prisma } from "./db.js";

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  category?: string;
  base_url: string;
  capabilities: Array<{
    id: string;
    name: string;
    description?: string;
    category?: string;
    input_schema?: object;
    output_schema?: object;
    is_async?: boolean;
    estimated_duration?: number;
  }>;
  [key: string]: unknown;
}

/**
 * Đăng ký app con mới — fetch manifest và lưu vào DB
 */
export async function registerApp(baseUrl: string): Promise<{ success: boolean; app_id?: string; error?: string }> {
  try {
    // Fetch manifest
    const res = await fetch(`${baseUrl}/manifest`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { success: false, error: `Manifest fetch failed: ${res.status}` };

    const manifest: AppManifest = await res.json();

    if (!manifest.id || !manifest.name || !manifest.capabilities?.length) {
      return { success: false, error: "Invalid manifest: missing id, name, or capabilities" };
    }

    // Verify health
    const healthRes = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
    const health = await healthRes.json();
    if (health.status === "unhealthy") {
      return { success: false, error: "App is unhealthy" };
    }

    // Upsert app
    const app = await prisma.app.upsert({
      where: { app_id: manifest.id },
      update: {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || null,
        icon: manifest.icon || null,
        category: manifest.category || null,
        base_url: baseUrl,
        status: health.status === "degraded" ? "degraded" : "active",
        health_miss: 0,
        manifest_raw: JSON.stringify(manifest),
        last_health: new Date(),
      },
      create: {
        app_id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || null,
        icon: manifest.icon || null,
        category: manifest.category || null,
        base_url: baseUrl,
        status: "active",
        manifest_raw: JSON.stringify(manifest),
        last_health: new Date(),
      },
    });

    // Upsert capabilities
    // First delete old ones
    await prisma.appCapability.deleteMany({ where: { app_id: app.id } });

    for (const cap of manifest.capabilities) {
      await prisma.appCapability.create({
        data: {
          app_id: app.id,
          capability_id: cap.id,
          name: cap.name,
          description: cap.description || null,
          category: cap.category || null,
          input_schema: cap.input_schema ? JSON.stringify(cap.input_schema) : null,
          output_schema: cap.output_schema ? JSON.stringify(cap.output_schema) : null,
          is_async: cap.is_async || false,
          estimated_ms: cap.estimated_duration || null,
        },
      });
    }

    // Log
    await prisma.activityLog.create({
      data: {
        type: "app_registered",
        app_id: app.id,
        details: JSON.stringify({ app_id: manifest.id, name: manifest.name, capabilities: manifest.capabilities.length }),
      },
    });

    console.log(`[Registry] ✅ Registered: ${manifest.name} (${manifest.id}) — ${manifest.capabilities.length} capabilities`);
    return { success: true, app_id: manifest.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Registry] ❌ Failed to register ${baseUrl}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Health check tất cả app con
 */
export async function checkAllHealth(): Promise<void> {
  const apps = await prisma.app.findMany({ where: { status: { not: "disabled" } } });

  for (const app of apps) {
    try {
      const res = await fetch(`${app.base_url}/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();

      const newStatus = data.status === "healthy" ? "active" : data.status === "degraded" ? "degraded" : "offline";

      await prisma.app.update({
        where: { id: app.id },
        data: {
          status: newStatus,
          health_miss: newStatus === "active" ? 0 : app.health_miss + 1,
          last_health: new Date(),
        },
      });

      // If was offline and now back
      if (app.status === "offline" && newStatus === "active") {
        console.log(`[Health] ${app.name} is back online`);
        // Re-fetch manifest in case capabilities changed
        await registerApp(app.base_url);
      }
    } catch {
      const misses = app.health_miss + 1;
      const newStatus = misses >= 3 ? "offline" : "degraded";

      await prisma.app.update({
        where: { id: app.id },
        data: { status: newStatus, health_miss: misses },
      });

      if (newStatus === "offline" && app.status !== "offline") {
        console.log(`[Health] ⚠ ${app.name} went OFFLINE (3 misses)`);
      }
    }
  }
}

/**
 * Lấy danh sách tất cả capabilities từ mọi app active
 */
export async function getAllCapabilities() {
  return prisma.appCapability.findMany({
    where: { app: { status: { in: ["active", "degraded"] } } },
    include: { app: { select: { app_id: true, name: true, base_url: true, status: true } } },
  });
}
