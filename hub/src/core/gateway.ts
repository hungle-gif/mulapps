/**
 * Gateway — Gọi capability của app con qua Plugin Protocol
 */
import { prisma } from "./db.js";
import { nanoid } from "nanoid";

export interface ExecuteRequest {
  app_id: string;          // "zalo-outreach"
  capability_id: string;   // "scan-group-members"
  input: Record<string, unknown>;
  timeout?: number;
}

export interface ExecuteResult {
  success: boolean;
  data?: unknown;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string };
  job_id?: string;
  is_async?: boolean;
  duration_ms: number;
}

/**
 * Execute a capability on an app con
 */
export async function executeCapability(req: ExecuteRequest): Promise<ExecuteResult> {
  const startMs = Date.now();
  const requestId = nanoid();

  // Find app
  const app = await prisma.app.findUnique({ where: { app_id: req.app_id } });
  if (!app) {
    return { success: false, error: { code: "APP_NOT_FOUND", message: `App '${req.app_id}' not found` }, duration_ms: Date.now() - startMs };
  }
  if (app.status === "offline" || app.status === "disabled") {
    return { success: false, error: { code: "APP_UNAVAILABLE", message: `App '${req.app_id}' is ${app.status}` }, duration_ms: Date.now() - startMs };
  }

  // Verify capability exists
  const cap = await prisma.appCapability.findFirst({
    where: { app_id: app.id, capability_id: req.capability_id },
  });
  if (!cap) {
    return { success: false, error: { code: "CAPABILITY_NOT_FOUND", message: `Capability '${req.capability_id}' not found on '${req.app_id}'` }, duration_ms: Date.now() - startMs };
  }

  try {
    // Call app con's /execute endpoint
    const response = await fetch(`${app.base_url}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer hub-internal",
        "X-Request-ID": requestId,
        "X-Hub-Origin": "hub",
      },
      body: JSON.stringify({
        capability_id: req.capability_id,
        input: req.input,
      }),
      signal: AbortSignal.timeout(req.timeout || 120000),
    });

    const result = await response.json();
    const durationMs = Date.now() - startMs;

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "capability_called",
        app_id: app.id,
        details: JSON.stringify({
          capability: req.capability_id,
          request_id: requestId,
          status: response.status,
          duration_ms: durationMs,
          success: result.success,
        }),
      },
    });

    // Handle async response (202)
    if (response.status === 202) {
      return {
        success: true,
        data: result,
        is_async: true,
        job_id: result.job_id,
        duration_ms: durationMs,
      };
    }

    return {
      success: result.success !== false,
      data: result.data || result,
      meta: result.meta,
      error: result.error,
      duration_ms: durationMs,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startMs;

    await prisma.activityLog.create({
      data: {
        type: "capability_called",
        app_id: app.id,
        details: JSON.stringify({ capability: req.capability_id, error: msg, duration_ms: durationMs }),
      },
    });

    return { success: false, error: { code: "EXECUTE_FAILED", message: msg }, duration_ms: durationMs };
  }
}

/**
 * Poll job status on an app con
 */
export async function pollJobStatus(appId: string, jobId: string): Promise<unknown> {
  const app = await prisma.app.findUnique({ where: { app_id: appId } });
  if (!app) return { error: "App not found" };

  const res = await fetch(`${app.base_url}/jobs/${jobId}`, { signal: AbortSignal.timeout(10000) });
  return res.json();
}
