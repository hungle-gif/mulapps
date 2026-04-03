import { getZaloClient } from "./client.js";
import { prisma } from "../db.js";
import { nanoid } from "nanoid";

interface SendResult {
  success: boolean;
  messageId: string;
  sentAt: Date;
  error?: string;
}

/**
 * Send a message to a contact via Zalo.
 * Handles template variable replacement.
 */
export async function sendMessage(
  contactId: string,
  messageContent: string,
  accountId?: string
): Promise<SendResult> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      contact_groups: {
        include: { group: true },
        take: 1,
      },
    },
  });

  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  // Replace template variables
  const groupName =
    contact.contact_groups[0]?.group?.name || "nhóm Zalo";
  const finalMessage = replaceTemplateVars(messageContent, {
    tên: contact.display_name,
    nhóm: groupName,
  });

  const api = await getZaloClient(accountId);
  const msgId = nanoid();

  try {
    // Send via zca-js
    await api.sendMessage(finalMessage, contact.zalo_id);

    // Get or create conversation
    const account = accountId
      ? await prisma.zaloAccount.findUnique({ where: { id: accountId } })
      : await prisma.zaloAccount.findFirst({
          where: { status: "active", is_default: true },
        });

    let conversation = await prisma.conversation.findFirst({
      where: {
        account_id: account!.id,
        contact_id: contact.id,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          account_id: account!.id,
          contact_id: contact.id,
          status: "active",
        },
      });
    }

    // Save message
    await prisma.message.create({
      data: {
        account_id: account!.id,
        contact_id: contact.id,
        conversation_id: conversation.id,
        direction: "outbound",
        content: finalMessage,
        message_type: "text",
        zalo_message_id: msgId,
        status: "sent",
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

    // Update contact status
    if (contact.outreach_status === "new" || contact.outreach_status === "pending") {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          outreach_status: "sent",
          last_contacted_at: new Date(),
        },
      });
    }

    return {
      success: true,
      messageId: msgId,
      sentAt: new Date(),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      messageId: msgId,
      sentAt: new Date(),
      error: errMsg,
    };
  }
}

/**
 * Replace template variables like {tên}, {nhóm}, {sản_phẩm}
 */
export function replaceTemplateVars(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

/**
 * Pick a random variant from a template.
 * Returns the main content or a random variant.
 */
export function pickTemplateVariant(
  mainContent: string,
  variantsJson?: string | null
): { content: string; variantIndex: number } {
  const allVariants = [mainContent];

  if (variantsJson) {
    try {
      const parsed = JSON.parse(variantsJson);
      if (Array.isArray(parsed)) {
        allVariants.push(...parsed);
      }
    } catch {
      // Ignore invalid JSON
    }
  }

  const idx = Math.floor(Math.random() * allVariants.length);
  return { content: allVariants[idx], variantIndex: idx };
}

/**
 * Random delay between min and max seconds
 */
export function randomDelay(minSeconds: number, maxSeconds: number): number {
  return (
    (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000
  );
}
