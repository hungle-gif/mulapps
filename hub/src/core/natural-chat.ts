/**
 * NATURAL CHAT — Hub hiểu tiếng Việt, tự dịch thành action
 *
 * User: "tìm tin AI mới nhất rồi viết bài đăng lên FB"
 * Hub: phân tích → gọi social crawl → viết bài → gọi social post
 *
 * User: "báo cáo hôm nay"
 * Hub: gọi tất cả app con → tổng hợp → trả lời
 */
import OpenAI from "openai";
import { prisma } from "./db.js";
import { executeCapability } from "./gateway.js";
import { runWorkflow } from "./workflow-engine.js";
import { getTokenStats, trackTokenUsage } from "./token-tracker.js";
import { getSystemStatus } from "./monitor.js";

const API_KEYS = [
  "00c7a2db-4cf0-4770-8f5b-fbbd0b62223d",
  "cd7b976d-853b-4f48-b1b7-7802584a2f10",
  "402a4732-45b8-4e84-930d-7c8e38aa7c49",
];
let keyIndex = 0;

const MODELS = ["kimi-k2.5", "kimi-k2-250905", "deepseek-v3-2-251201"];

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: API_KEYS[keyIndex],
    baseURL: "https://ark.ap-southeast.bytepluses.com/api/v3",
  });
}

// Available tools Hub can call
const HUB_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "execute_app",
      description: "Gọi capability của app con. Dùng khi cần thực hiện tác vụ cụ thể: gửi tin nhắn, tạo video, crawl web, đăng bài...",
      parameters: {
        type: "object",
        required: ["app_id", "capability_id", "input"],
        properties: {
          app_id: { type: "string", description: "ID app con: zalo-outreach, video-creator, social-manager" },
          capability_id: { type: "string", description: "ID capability cần gọi" },
          input: { type: "object", description: "Input cho capability" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_zalo_stats",
      description: "Lấy thống kê Zalo: số tin nhắn, leads, scoring. Dùng khi user hỏi báo cáo Zalo.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_token_stats",
      description: "Lấy thống kê token/chi phí AI. Dùng khi user hỏi về chi phí, token usage.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Số ngày", default: 7 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_status",
      description: "Lấy trạng thái hệ thống: app nào đang chạy/chết, alerts. Dùng khi user hỏi tình trạng hệ thống.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_workflow",
      description: "Tạo workflow mới để tự động hóa. Dùng khi user muốn thiết lập quy trình tự động.",
      parameters: {
        type: "object",
        required: ["name", "steps"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          trigger_type: { type: "string", enum: ["manual", "cron"] },
          trigger_config: { type: "string", description: "Cron expression nếu trigger_type=cron" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                app_id: { type: "string" },
                capability_id: { type: "string" },
                name: { type: "string" },
                input_template: { type: "object" },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_workflow",
      description: "Chạy 1 workflow đã tạo. Dùng khi user muốn kích hoạt workflow.",
      parameters: {
        type: "object",
        required: ["workflow_id"],
        properties: {
          workflow_id: { type: "string" },
          input: { type: "object" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_knowledge",
      description: "Thêm/sửa/xem knowledge base. Dùng khi user muốn cập nhật tài liệu, kịch bản, thông tin sản phẩm.",
      parameters: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "add", "update"] },
          category: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          doc_id: { type: "string" },
        },
      },
    },
  },
];

/**
 * Handle a tool call from AI
 */
async function handleToolCall(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "execute_app": {
        const result = await executeCapability(args.app_id, args.capability_id, args.input);
        return JSON.stringify(result);
      }

      case "get_zalo_stats": {
        const [scoring, messages] = await Promise.all([
          fetch("http://localhost:3010/api/scoring/stats").then((r) => r.json()).catch(() => null),
          fetch("http://localhost:3010/api/messages/pending").then((r) => r.json()).catch(() => null),
        ]);
        return JSON.stringify({ scoring: scoring?.data, pending_messages: messages?.count });
      }

      case "get_token_stats": {
        const stats = await getTokenStats(args.days || 7);
        return JSON.stringify(stats);
      }

      case "get_system_status": {
        const status = await getSystemStatus();
        return JSON.stringify(status);
      }

      case "create_workflow": {
        const workflow = await prisma.workflow.create({
          data: {
            name: args.name,
            description: args.description,
            trigger_type: args.trigger_type || "manual",
            trigger_config: args.trigger_config,
            steps: JSON.stringify(args.steps),
          },
        });
        if (args.trigger_type === "cron" && args.trigger_config) {
          await prisma.schedule.create({
            data: { name: `Auto: ${args.name}`, workflow_id: workflow.id, cron_expression: args.trigger_config },
          });
        }
        return JSON.stringify({ created: true, id: workflow.id });
      }

      case "run_workflow": {
        const result = await runWorkflow(args.workflow_id, "chat", args.input);
        return JSON.stringify(result);
      }

      case "manage_knowledge": {
        if (args.action === "list") {
          const docs = await prisma.knowledgeDoc.findMany({
            where: { is_active: true, ...(args.category ? { category: args.category } : {}) },
            orderBy: { priority: "asc" },
          });
          return JSON.stringify(docs.map((d) => ({ id: d.id, category: d.category, title: d.title, content: d.content.slice(0, 200) })));
        }
        if (args.action === "add") {
          const doc = await prisma.knowledgeDoc.create({
            data: { category: args.category || "other", title: args.title, content: args.content, version: 1 },
          });
          return JSON.stringify({ created: true, id: doc.id });
        }
        if (args.action === "update" && args.doc_id) {
          const existing = await prisma.knowledgeDoc.findUnique({ where: { id: args.doc_id } });
          if (!existing) return JSON.stringify({ error: "Doc not found" });
          await prisma.knowledgeDoc.update({
            where: { id: args.doc_id },
            data: {
              ...(args.title && { title: args.title }),
              ...(args.content && { content: args.content }),
              version: existing.version + 1,
            },
          });
          return JSON.stringify({ updated: true });
        }
        return JSON.stringify({ error: "Invalid action" });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

/**
 * Chat with Hub — natural language → actions
 */
export async function chatWithHub(
  userMessage: string,
  conversationHistory?: { role: "user" | "assistant"; content: string }[]
): Promise<{ reply: string; actions: string[]; tokens_used: number }> {
  // Load capabilities for system prompt
  const apps = await prisma.app.findMany({
    include: { capabilities: true },
    where: { status: { not: "disabled" } },
  });

  const capabilitiesList = apps
    .flatMap((app) =>
      app.capabilities.map((c) => `${app.app_id}/${c.capability_id}: ${c.name} — ${c.description || ""}`)
    )
    .join("\n");

  const systemPrompt = `Bạn là Hub AI — bộ não trung tâm điều phối hệ thống.
Bạn có thể gọi các app con để thực hiện tác vụ.

APP CON VÀ CAPABILITIES:
${capabilitiesList || "Chưa có app nào đăng ký"}

QUY TẮC:
- Trả lời tiếng Việt, ngắn gọn, rõ ràng
- Nếu user yêu cầu hành động → dùng tools để thực hiện
- Nếu user hỏi thông tin → dùng tools để lấy data rồi tóm tắt
- Nếu user muốn tự động hóa → tạo workflow
- Luôn báo kết quả sau khi thực hiện
- Không bịa data, chỉ dùng data từ tools`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory || []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const actions: string[] = [];
  let totalTokens = 0;
  const client = getClient();

  // Loop: AI may call tools multiple times
  for (let iteration = 0; iteration < 5; iteration++) {
    let response: any;

    for (const model of MODELS) {
      try {
        response = await client.chat.completions.create({
          model,
          messages,
          tools: HUB_TOOLS,
          tool_choice: "auto",
          max_tokens: 1024,
          temperature: 0.7,
        });

        totalTokens += response.usage?.total_tokens || 0;

        // Track token usage
        await trackTokenUsage({
          app_id: "hub",
          model,
          input_tokens: response.usage?.prompt_tokens || 0,
          output_tokens: response.usage?.completion_tokens || 0,
          purpose: "hub_chat",
        });

        break;
      } catch (err: any) {
        if (err.status === 429) {
          keyIndex = (keyIndex + 1) % API_KEYS.length;
          continue;
        }
        if (err.status === 404) continue;
        throw err;
      }
    }

    if (!response) {
      return { reply: "Xin lỗi, không thể kết nối AI. Thử lại sau nhé.", actions: [], tokens_used: 0 };
    }

    const choice = response.choices[0];

    // If AI wants to call tools
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const actionDesc = `${toolCall.function.name}(${JSON.stringify(args).slice(0, 100)})`;
        actions.push(actionDesc);
        console.log(`[Hub Chat] Tool: ${actionDesc}`);

        const result = await handleToolCall(toolCall.function.name, args);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      continue; // Let AI process tool results
    }

    // AI finished — return text response
    const reply = choice.message.content || "Đã thực hiện xong.";

    // Save chat history
    await prisma.chatMessage.create({
      data: { role: "user", content: userMessage },
    });
    await prisma.chatMessage.create({
      data: {
        role: "assistant",
        content: reply,
        metadata: actions.length > 0 ? JSON.stringify({ actions }) : null,
      },
    });

    return { reply, actions, tokens_used: totalTokens };
  }

  return { reply: "Đã thực hiện nhiều bước. Kiểm tra kết quả nhé.", actions, tokens_used: totalTokens };
}
