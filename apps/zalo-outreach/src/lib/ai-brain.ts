import OpenAI from "openai";
import { prisma } from "./db.js";

// ============================================
// KNOWLEDGE CACHE — Sync từ Hub, cache local
// ============================================
const HUB_URL = process.env.HUB_URL || "http://localhost:3000";
const APP_ID = "zalo-outreach";

interface KnowledgeDoc {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string | null;
  keywords: string | null;
  priority: number;
  is_active: boolean;
  version: number;
}

let knowledgeCache: KnowledgeDoc[] = [];
let lastSyncVersion = 0;
let lastSyncTime = 0;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 phút

async function syncKnowledgeFromHub(): Promise<void> {
  try {
    const resp = await fetch(
      `${HUB_URL}/api/knowledge/sync?app_id=${APP_ID}&since_version=${lastSyncVersion}`
    );
    if (!resp.ok) throw new Error(`Hub returned ${resp.status}`);
    const data = await resp.json();

    if (data.success && data.data.docs_count > 0) {
      // Update/add docs in cache
      for (const doc of data.data.docs) {
        const idx = knowledgeCache.findIndex((d) => d.id === doc.id);
        if (idx >= 0) {
          if (doc.is_active) {
            knowledgeCache[idx] = doc;
          } else {
            knowledgeCache.splice(idx, 1); // Remove deactivated
          }
        } else if (doc.is_active) {
          knowledgeCache.push(doc);
        }
      }
      lastSyncVersion = data.data.current_version;
      console.log(`[Knowledge] Synced ${data.data.docs_count} docs from Hub (v${lastSyncVersion})`);
    }
    lastSyncTime = Date.now();
  } catch (err: any) {
    console.error("[Knowledge] Sync failed:", err.message);
    // Fallback: load from local DB if Hub is down
    if (knowledgeCache.length === 0) {
      const localDocs = await prisma.knowledgeDoc.findMany({ where: { is_active: true } });
      knowledgeCache = localDocs.map((d) => ({
        id: d.id,
        category: d.category,
        title: d.title,
        content: d.content,
        tags: d.tags,
        keywords: d.keywords,
        priority: d.priority,
        is_active: d.is_active,
        version: 0,
      }));
      console.log(`[Knowledge] Loaded ${knowledgeCache.length} docs from local fallback`);
    }
  }
}

async function ensureKnowledge(): Promise<void> {
  if (Date.now() - lastSyncTime > SYNC_INTERVAL || knowledgeCache.length === 0) {
    await syncKnowledgeFromHub();
  }
}

async function getKnowledgeForReply(
  message: string,
  leadStatus: string,
  outboundCount: number
): Promise<KnowledgeDoc[]> {
  await ensureKnowledge();

  const result: KnowledgeDoc[] = [];
  const msg = message.toLowerCase();

  // 1. Always load priority 1 (identity, policy, hard-stop rules)
  result.push(...knowledgeCache.filter((d) => d.priority === 1));

  // 2. Match keywords from message
  const keywordDocs = knowledgeCache.filter((d) => {
    if (!d.keywords || d.priority === 1) return false;
    return d.keywords.split(",").some((kw) => kw.trim() && msg.includes(kw.trim().toLowerCase()));
  });
  result.push(...keywordDocs);

  // 3. Load sales script based on lead status
  let scriptKeyword = "mở đầu";
  if (leadStatus === "hot") scriptKeyword = "chốt deal";
  else if (leadStatus === "cold" || leadStatus === "dead") scriptKeyword = "từ chối";
  else if (outboundCount > 2) scriptKeyword = "follow-up";

  const script = knowledgeCache.find(
    (d) => d.category === "sales_script" && d.title.toLowerCase().includes(scriptKeyword)
  );
  if (script && !result.find((r) => r.id === script.id)) {
    result.push(script);
  }

  // Deduplicate
  const seen = new Set<string>();
  return result.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

// ============================================
// AI BRAIN — Kimi K2.5 / DeepSeek V3 via BytePlus
// Auto-reply tin nhắn Zalo thông minh
// ============================================

const API_KEYS = [
  "00c7a2db-4cf0-4770-8f5b-fbbd0b62223d",
  "cd7b976d-853b-4f48-b1b7-7802584a2f10",
  "402a4732-45b8-4e84-930d-7c8e38aa7c49",
];

let currentKeyIndex = 0;

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: API_KEYS[currentKeyIndex],
    baseURL: "https://ark.ap-southeast.bytepluses.com/api/v3",
  });
}

function rotateKey(): void {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(`[AI] Rotated to key #${currentKeyIndex + 1}`);
}

// Model priority: try kimi-k2.5 first, fallback to deepseek
const MODELS = [
  "kimi-k2.5",
  "kimi-k2-250905",
  "deepseek-v3-2-251201",
  "deepseek-v3",
];

async function callAI(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 256
): Promise<string> {
  const client = getClient();

  for (const model of MODELS) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const reply = response.choices[0]?.message?.content?.trim();
      if (reply) {
        console.log(`[AI] Model: ${model}, tokens: ${response.usage?.total_tokens}`);
        return reply;
      }
    } catch (error: any) {
      if (error.status === 429) {
        // Rate limited — rotate key
        rotateKey();
        continue;
      }
      if (error.status === 404) {
        // Model not activated — try next
        continue;
      }
      console.error(`[AI] Error with ${model}:`, error.message);
      continue;
    }
  }

  // All models failed — return fallback
  console.warn("[AI] All models failed, using fallback reply");
  return "Cảm ơn bạn đã nhắn tin. Mình sẽ phản hồi sớm nhất có thể nhé!";
}

/**
 * Generate AI reply for a Zalo conversation.
 * Loads conversation history + contact context + business config.
 */
export async function generateAIReply(
  conversationId: string,
  contactId: string,
  latestMessage: string
): Promise<string> {
  // Load conversation history (last 15 messages for context)
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { created_at: "asc" },
        take: 15,
      },
      contact: true,
      score: true,
    },
  });

  if (!conversation) {
    return await callAI(
      "Trả lời ngắn gọn, thân thiện.",
      [{ role: "user", content: latestMessage }]
    );
  }

  // ---- Load Knowledge Base from Hub (with local cache) ----
  const knowledgeDocs = await getKnowledgeForReply(latestMessage, conversation.score?.lead_status || "new", conversation.outbound_count);

  const leadStatus = conversation.score?.lead_status || "new";
  const buyingSignals = conversation.score?.buying_signals
    ? JSON.parse(conversation.score.buying_signals)
    : [];

  const knowledgeContext = knowledgeDocs
    .map((d: any) => `[${d.category.toUpperCase()}] ${d.title}:\n${d.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `${knowledgeContext}

---

THÔNG TIN KHÁCH HÀNG ĐANG CHAT:
- Tên: ${conversation.contact.display_name}
- Trạng thái: ${leadStatus}
${buyingSignals.length > 0 ? `- Tín hiệu mua: ${buyingSignals.join(", ")}` : ""}
${leadStatus === "hot" ? "- KHÁCH ĐANG RẤT QUAN TÂM — tập trung chốt deal, đưa ra CTA rõ ràng" : ""}
${leadStatus === "cold" ? "- Khách ít quan tâm — nhẹ nhàng, không push quá" : ""}
${leadStatus === "dead" ? "- Khách không muốn bị làm phiền — trả lời ngắn, xin lỗi, DỪNG" : ""}

Dựa trên knowledge base và kịch bản ở trên, hãy trả lời khách hàng.`;

  // Build message history for AI
  const chatHistory: { role: "user" | "assistant"; content: string }[] =
    conversation.messages.map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

  // Add latest message if not already in history
  const lastMsg = chatHistory[chatHistory.length - 1];
  if (!lastMsg || lastMsg.content !== latestMessage) {
    chatHistory.push({ role: "user", content: latestMessage });
  }

  return await callAI(systemPrompt, chatHistory);
}

/**
 * Test AI connection
 */
export async function testAI(): Promise<{
  success: boolean;
  model: string;
  reply: string;
}> {
  try {
    const client = getClient();
    for (const model of MODELS) {
      try {
        const r = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: "Xin chào" }],
          max_tokens: 50,
        });
        return {
          success: true,
          model,
          reply: r.choices[0]?.message?.content || "",
        };
      } catch {
        continue;
      }
    }
    return { success: false, model: "none", reply: "All models failed" };
  } catch (error: any) {
    return { success: false, model: "error", reply: error.message };
  }
}
