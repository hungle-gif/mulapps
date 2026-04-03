/**
 * TOKEN TRACKER — Track LLM token usage + cost
 * Mỗi app con gọi API này để report token usage
 */
import { prisma } from "./db.js";

// Bảng giá BytePlus (USD per 1M tokens)
const PRICING: Record<string, { input: number; output: number; cached: number }> = {
  "deepseek-v3-2-251201": { input: 0.27, output: 1.10, cached: 0.07 },
  "deepseek-v3": { input: 0.27, output: 1.10, cached: 0.07 },
  "kimi-k2-250905": { input: 0.60, output: 2.50, cached: 0.12 },
  "kimi-k2.5": { input: 0.60, output: 2.50, cached: 0.12 },
  "kimi-k2-thinking-251104": { input: 0.60, output: 2.50, cached: 0.12 },
  default: { input: 1.00, output: 3.00, cached: 0.20 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): number {
  const price = PRICING[model] || PRICING.default;
  const regularInput = inputTokens - cachedTokens;
  return (
    (regularInput / 1_000_000) * price.input +
    (cachedTokens / 1_000_000) * price.cached +
    (outputTokens / 1_000_000) * price.output
  );
}

/**
 * Log token usage from any app
 */
export async function trackTokenUsage(params: {
  app_id?: string;
  model: string;
  provider?: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens?: number;
  purpose?: string;
  conversation_id?: string;
}): Promise<{ cost_usd: number; total_tokens: number }> {
  const totalTokens = params.input_tokens + params.output_tokens;
  const costUsd = calculateCost(
    params.model,
    params.input_tokens,
    params.output_tokens,
    params.cached_tokens || 0
  );

  await prisma.tokenUsage.create({
    data: {
      app_id: params.app_id || null,
      model: params.model,
      provider: params.provider || "byteplus",
      input_tokens: params.input_tokens,
      output_tokens: params.output_tokens,
      total_tokens: totalTokens,
      cached_tokens: params.cached_tokens || 0,
      cost_usd: costUsd,
      purpose: params.purpose || null,
      conversation_id: params.conversation_id || null,
    },
  });

  // Update daily summary
  const today = new Date().toISOString().slice(0, 10);
  await prisma.tokenDailySummary.upsert({
    where: {
      date_app_id_model: {
        date: today,
        app_id: params.app_id || "hub",
        model: params.model,
      },
    },
    update: {
      total_requests: { increment: 1 },
      total_input: { increment: params.input_tokens },
      total_output: { increment: params.output_tokens },
      total_tokens: { increment: totalTokens },
      total_cost_usd: { increment: costUsd },
    },
    create: {
      date: today,
      app_id: params.app_id || "hub",
      model: params.model,
      total_requests: 1,
      total_input: params.input_tokens,
      total_output: params.output_tokens,
      total_tokens: totalTokens,
      total_cost_usd: costUsd,
    },
  });

  return { cost_usd: costUsd, total_tokens: totalTokens };
}

/**
 * Get token usage stats
 */
export async function getTokenStats(days: number = 7): Promise<{
  today: { requests: number; tokens: number; cost_usd: number };
  last_n_days: { date: string; tokens: number; cost_usd: number }[];
  by_app: { app_id: string; tokens: number; cost_usd: number }[];
  by_model: { model: string; tokens: number; cost_usd: number }[];
  total_all_time: { requests: number; tokens: number; cost_usd: number };
}> {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().slice(0, 10);

  // Today
  const todayData = await prisma.tokenDailySummary.findMany({
    where: { date: today },
  });
  const todayStats = {
    requests: todayData.reduce((s, d) => s + d.total_requests, 0),
    tokens: todayData.reduce((s, d) => s + d.total_tokens, 0),
    cost_usd: todayData.reduce((s, d) => s + d.total_cost_usd, 0),
  };

  // Last N days
  const dailyData = await prisma.tokenDailySummary.findMany({
    where: { date: { gte: startDateStr } },
  });

  const byDate: Record<string, { tokens: number; cost_usd: number }> = {};
  for (const d of dailyData) {
    if (!byDate[d.date]) byDate[d.date] = { tokens: 0, cost_usd: 0 };
    byDate[d.date].tokens += d.total_tokens;
    byDate[d.date].cost_usd += d.total_cost_usd;
  }

  // By app
  const byApp: Record<string, { tokens: number; cost_usd: number }> = {};
  for (const d of dailyData) {
    const key = d.app_id || "hub";
    if (!byApp[key]) byApp[key] = { tokens: 0, cost_usd: 0 };
    byApp[key].tokens += d.total_tokens;
    byApp[key].cost_usd += d.total_cost_usd;
  }

  // By model
  const byModel: Record<string, { tokens: number; cost_usd: number }> = {};
  for (const d of dailyData) {
    const key = d.model || "unknown";
    if (!byModel[key]) byModel[key] = { tokens: 0, cost_usd: 0 };
    byModel[key].tokens += d.total_tokens;
    byModel[key].cost_usd += d.total_cost_usd;
  }

  // All time
  const allTime = await prisma.tokenUsage.aggregate({
    _sum: { total_tokens: true, cost_usd: true },
    _count: true,
  });

  return {
    today: todayStats,
    last_n_days: Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data })),
    by_app: Object.entries(byApp).map(([app_id, data]) => ({ app_id, ...data })),
    by_model: Object.entries(byModel).map(([model, data]) => ({ model, ...data })),
    total_all_time: {
      requests: allTime._count,
      tokens: allTime._sum.total_tokens || 0,
      cost_usd: allTime._sum.cost_usd || 0,
    },
  };
}
