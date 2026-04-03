import { getZaloClient } from "./client.js";
import { prisma } from "../db.js";
import { broadcast } from "../ws.js";
import { scoreConversation } from "../conversation-engine.js";
import { generateAIReply } from "../ai-brain.js";
import { sendMessage } from "./messenger.js";

/**
 * Start listening for incoming messages on a Zalo account.
 * When a message arrives, update conversation + contact status.
 */
export async function startMessageListener(accountId: string): Promise<void> {
  const api = await getZaloClient(accountId);

  api.listener.on("connected", () => {
    console.log(`[Listener] WebSocket CONNECTED for ${accountId}`);
  });

  api.listener.on("error", (err: any) => {
    console.error(`[Listener] WebSocket ERROR:`, err);
  });

  api.listener.on("closed", (code: number, reason: string) => {
    console.log(`[Listener] WebSocket CLOSED: ${code} ${reason}`);
  });

  api.listener.on("message", async (message: any) => {
    try {
      console.log("[Listener] RAW MESSAGE:", JSON.stringify(message).slice(0, 500));

      // Skip self messages (outbound)
      if (message.isSelf) {
        console.log("[Listener] Skipping self message");
        return;
      }

      // zca-js UserMessage: { data: { uidFrom, content, msgId, ... }, threadId, isSelf }
      const senderZaloId = message.data?.uidFrom || message.threadId;
      const content = typeof message.data?.content === "string"
        ? message.data.content
        : message.data?.content?.text || message.data?.content || "";
      const msgId = message.data?.msgId || "";

      console.log("[Listener] Parsed: from=", senderZaloId, "content=", String(content).slice(0, 100));

      if (!senderZaloId || !content) return;

      // Find or create contact
      let contact = await prisma.contact.findUnique({
        where: { zalo_id: String(senderZaloId) },
      });

      if (!contact) {
        // Auto-create contact from incoming message
        contact = await prisma.contact.create({
          data: {
            zalo_id: String(senderZaloId),
            display_name: message.data?.dName || `Zalo_${String(senderZaloId).slice(-6)}`,
            outreach_status: "replied",
          },
        });
        console.log(`[Listener] Auto-created contact: ${contact.display_name} (${contact.zalo_id})`);
      }

      // Find or create conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          account_id: accountId,
          contact_id: contact.id,
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            account_id: accountId,
            contact_id: contact.id,
            status: "active",
          },
        });
      }

      // Save inbound message
      await prisma.message.create({
        data: {
          account_id: accountId,
          contact_id: contact.id,
          conversation_id: conversation.id,
          direction: "inbound",
          content: String(content),
          message_type: "text",
          zalo_message_id: String(msgId),
          status: "sent",
        },
      });

      // Update conversation stats
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          total_messages: { increment: 1 },
          inbound_count: { increment: 1 },
          last_message_at: new Date(),
          last_inbound_at: new Date(),
        },
      });

      // Update contact status if they replied
      if (
        contact.outreach_status === "sent" ||
        contact.outreach_status === "pending"
      ) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            outreach_status: "replied",
            last_replied_at: new Date(),
          },
        });
      }

      // Update campaign_contact if relevant
      const campaignContacts = await prisma.campaignContact.findMany({
        where: {
          contact_id: contact.id,
          status: "sent",
        },
      });

      for (const cc of campaignContacts) {
        await prisma.campaignContact.update({
          where: { id: cc.id },
          data: {
            status: "replied",
            replied_at: new Date(),
          },
        });

        // Update campaign stats
        await prisma.campaign.update({
          where: { id: cc.campaign_id },
          data: {
            replied_count: { increment: 1 },
          },
        });
      }

      // Auto-score conversation
      const scoring = await scoreConversation(
        conversation.id,
        contact.id,
        String(content)
      );

      // Broadcast via WebSocket (including score)
      broadcast({
        type: "zalo:reply-received",
        payload: {
          contact_id: contact.id,
          contact_name: contact.display_name,
          message: String(content).substring(0, 200),
          conversation_id: conversation.id,
          scoring,
        },
        timestamp: new Date().toISOString(),
      });

      // ---- AI AUTO-REPLY ----
      // Check if auto-reply is enabled
      const autoReplySetting = await prisma.setting.findUnique({
        where: { key: "ai_auto_reply" },
      });
      const autoReplyEnabled = autoReplySetting?.value === "true";

      // Don't reply to dead leads or if disabled
      if (autoReplyEnabled && scoring.lead_status !== "dead") {
        try {
          // Small delay to feel natural (1-3 seconds)
          const delay = 1000 + Math.random() * 2000;
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Generate AI reply
          const aiReply = await generateAIReply(
            conversation.id,
            contact.id,
            String(content)
          );

          // Send via Zalo — sendMessage(contactId, message, accountId)
          await sendMessage(contact.id, aiReply, accountId);

          // Save outbound message
          await prisma.message.create({
            data: {
              account_id: accountId,
              contact_id: contact.id,
              conversation_id: conversation.id,
              direction: "outbound",
              content: aiReply,
              message_type: "text",
              status: "sent",
              metadata: JSON.stringify({ source: "ai_auto_reply" }),
            },
          });

          // Update conversation stats
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              total_messages: { increment: 1 },
              outbound_count: { increment: 1 },
              last_message_at: new Date(),
              last_outbound_at: new Date(),
            },
          });

          console.log(`[AI Reply] → ${contact.display_name}: ${aiReply.substring(0, 80)}...`);

          broadcast({
            type: "zalo:ai-reply-sent",
            payload: {
              contact_id: contact.id,
              contact_name: contact.display_name,
              ai_reply: aiReply.substring(0, 200),
              conversation_id: conversation.id,
              lead_status: scoring.lead_status,
            },
            timestamp: new Date().toISOString(),
          });
        } catch (aiError) {
          console.error("[AI Reply] Error:", aiError);
        }
      }
    } catch (error) {
      console.error("[Listener] Error processing message:", error);
    }
  });

  // Start listening
  await api.listener.start();
  console.log(`[Listener] Started for account ${accountId}`);
}

export async function stopMessageListener(accountId: string): Promise<void> {
  const api = await getZaloClient(accountId);
  if (api?.listener) {
    await api.listener.stop();
    console.log(`[Listener] Stopped for account ${accountId}`);
  }
}
