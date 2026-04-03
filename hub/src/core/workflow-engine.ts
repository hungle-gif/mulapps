/**
 * WORKFLOW ENGINE
 * Chain nhiều app con: output step A → input step B
 * Hỗ trợ: sequential, parallel, conditional, retry
 */
import { prisma } from "./db.js";
import { executeCapability } from "./gateway.js";

export interface WorkflowStep {
  id: string;
  app_id: string;
  capability_id: string;
  name: string;
  input_template: Record<string, any>; // Có thể dùng {{prev.field}} để reference output step trước
  on_error?: "stop" | "skip" | "retry";
  retry_count?: number;
  depends_on?: string[]; // Step IDs phải hoàn thành trước
  condition?: string; // JS expression: "prev.lead_status === 'hot'"
}

interface StepResult {
  step_id: string;
  status: "success" | "failed" | "skipped";
  output: any;
  error?: string;
  duration_ms: number;
  started_at: string;
  completed_at: string;
}

/**
 * Run a workflow by ID
 */
export async function runWorkflow(
  workflowId: string,
  trigger: string = "manual",
  initialInput?: Record<string, any>
): Promise<{ run_id: string; status: string; results: StepResult[] }> {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow || !workflow.is_active) {
    throw new Error(`Workflow ${workflowId} not found or inactive`);
  }

  const steps: WorkflowStep[] = JSON.parse(workflow.steps);

  // Create run record
  const run = await prisma.workflowRun.create({
    data: {
      workflow_id: workflowId,
      status: "running",
      trigger,
      total_steps: steps.length,
      current_step: 0,
    },
  });

  const results: StepResult[] = [];
  const stepOutputs: Record<string, any> = {};

  // Initial input available as "input" in templates
  if (initialInput) {
    stepOutputs["input"] = initialInput;
  }

  let overallStatus = "completed";

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const startTime = Date.now();

    // Update progress
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { current_step: i + 1 },
    });

    // Check condition
    if (step.condition) {
      try {
        const prev = i > 0 ? stepOutputs[steps[i - 1].id] : {};
        const conditionFn = new Function("prev", "outputs", `return ${step.condition}`);
        if (!conditionFn(prev, stepOutputs)) {
          results.push({
            step_id: step.id,
            status: "skipped",
            output: null,
            error: `Condition not met: ${step.condition}`,
            duration_ms: 0,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });
          continue;
        }
      } catch {
        // If condition eval fails, run the step anyway
      }
    }

    // Check dependencies
    if (step.depends_on?.length) {
      const allDepsOk = step.depends_on.every((depId) => {
        const depResult = results.find((r) => r.step_id === depId);
        return depResult && depResult.status === "success";
      });
      if (!allDepsOk) {
        results.push({
          step_id: step.id,
          status: "skipped",
          output: null,
          error: "Dependencies not met",
          duration_ms: 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
        continue;
      }
    }

    // Resolve input template — replace {{prev.xxx}} and {{outputs.stepId.xxx}}
    const resolvedInput = resolveTemplate(step.input_template, stepOutputs, i > 0 ? steps[i - 1].id : null);

    // Execute step
    const errorStrategy = step.on_error || workflow.on_error || "stop";
    const maxRetries = step.retry_count || workflow.max_retries || 3;
    let lastError = "";
    let stepOutput: any = null;
    let stepStatus: "success" | "failed" | "skipped" = "failed";

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Workflow] Step ${i + 1}/${steps.length}: ${step.name} (${step.app_id}/${step.capability_id})`);

        const result = await executeCapability(step.app_id, step.capability_id, resolvedInput);

        if (result.success) {
          stepOutput = result.data;
          stepOutputs[step.id] = stepOutput;
          stepStatus = "success";
          break;
        } else {
          lastError = result.error?.message || "Unknown error";
          if (attempt < maxRetries && errorStrategy === "retry") {
            console.log(`[Workflow] Retry ${attempt + 1}/${maxRetries} for ${step.name}`);
            await sleep(2000 * (attempt + 1)); // Exponential backoff
            continue;
          }
        }
      } catch (err: any) {
        lastError = err.message;
        if (attempt < maxRetries && errorStrategy === "retry") {
          await sleep(2000 * (attempt + 1));
          continue;
        }
      }
    }

    const duration = Date.now() - startTime;

    results.push({
      step_id: step.id,
      status: stepStatus,
      output: stepOutput,
      error: stepStatus === "failed" ? lastError : undefined,
      duration_ms: duration,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Handle failure
    if (stepStatus === "failed") {
      if (errorStrategy === "stop") {
        overallStatus = "failed";

        // Create alert
        await prisma.monitorAlert.create({
          data: {
            severity: "error",
            source: step.app_id,
            title: `Workflow step failed: ${step.name}`,
            message: lastError,
            details: JSON.stringify({ workflow_id: workflowId, run_id: run.id, step }),
          },
        });

        break;
      }
      // "skip" → continue to next step
    }
  }

  // Update run record
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);
  await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status: overallStatus,
      step_results: JSON.stringify(results),
      completed_at: new Date(),
      duration_ms: totalDuration,
      ...(overallStatus === "failed" && {
        error_message: results.find((r) => r.status === "failed")?.error,
        error_step_id: results.find((r) => r.status === "failed")?.step_id,
      }),
    },
  });

  // Update workflow stats
  await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      total_runs: { increment: 1 },
      ...(overallStatus === "completed" ? { success_runs: { increment: 1 } } : { failed_runs: { increment: 1 } }),
      last_run_at: new Date(),
      avg_duration_ms: totalDuration,
    },
  });

  console.log(`[Workflow] ${workflow.name}: ${overallStatus} (${totalDuration}ms, ${results.length} steps)`);

  return { run_id: run.id, status: overallStatus, results };
}

/**
 * Resolve {{prev.xxx}} and {{outputs.stepId.xxx}} in input template
 */
function resolveTemplate(
  template: Record<string, any>,
  outputs: Record<string, any>,
  prevStepId: string | null
): Record<string, any> {
  const json = JSON.stringify(template);

  const resolved = json.replace(/\{\{(.*?)\}\}/g, (match, expr) => {
    try {
      const prev = prevStepId ? outputs[prevStepId] : {};
      const fn = new Function("prev", "outputs", `return ${expr}`);
      const value = fn(prev, outputs);
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch {
      return match; // Leave unresolved
    }
  });

  return JSON.parse(resolved);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
