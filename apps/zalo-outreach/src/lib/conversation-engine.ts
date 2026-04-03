import { prisma } from "./db.js";
import { broadcast } from "./ws.js";

// ============================================
// CONVERSATION ENGINE
// Tự động scoring + phân loại khi nhận tin nhắn
// ============================================

// Keywords phát hiện ý định
const BUYING_SIGNALS = [
  "giá", "bao nhiêu", "mua", "đặt hàng", "order", "thanh toán",
  "chuyển khoản", "ship", "giao hàng", "địa chỉ", "demo",
  "dùng thử", "tư vấn", "báo giá", "bảng giá", "gói nào",
  "đăng ký", "sử dụng", "triển khai", "hợp đồng", "liên hệ",
  "gặp", "meeting", "gọi", "zalo", "số điện thoại",
  "quan tâm", "thích", "hay", "tốt", "ok", "được",
];

const REJECTION_SIGNALS = [
  "không", "ko", "k cần", "không cần", "thôi", "đừng",
  "ngừng", "stop", "block", "spam", "phiền", "bận",
  "không quan tâm", "không cần thiết", "đã có rồi",
  "không liên hệ nữa", "xin lỗi không", "tôi không",
];

const GREETING_SIGNALS = [
  "hi", "hello", "chào", "xin chào", "alo", "hey",
];

/**
 * Score a conversation based on the latest inbound message.
 * Called automatically by listener when a message arrives.
 */
export async function scoreConversation(
  conversationId: string,
  contactId: string,
  inboundContent: string
): Promise<{
  lead_status: string;
  interest_score: number;
  signals: string[];
  next_action: string;
}> {
  // Get conversation history
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { created_at: "desc" },
        take: 20,
      },
      score: true,
    },
  });

  if (!conversation) {
    return { lead_status: "new", interest_score: 0, signals: [], next_action: "wait" };
  }

  const messages = conversation.messages.reverse();
  const inboundMessages = messages.filter(m => m.direction === "inbound");
  const content = inboundContent.toLowerCase().trim();

  // ---- Detect signals ----
  const detectedBuying: string[] = [];
  const detectedRejection: string[] = [];

  for (const kw of BUYING_SIGNALS) {
    if (content.includes(kw)) detectedBuying.push(kw);
  }
  for (const kw of REJECTION_SIGNALS) {
    if (content.includes(kw)) detectedRejection.push(kw);
  }

  const isGreeting = GREETING_SIGNALS.some(g => content.includes(g));

  // ---- Calculate scores ----
  let interestScore = conversation.score?.interest_score || 0;
  let intentScore = conversation.score?.intent_score || 0;
  let engagementScore = conversation.score?.engagement_score || 0;
  let sentimentScore = conversation.score?.sentiment_score || 50;

  // Engagement: reply count, message length
  engagementScore = Math.min(100, inboundMessages.length * 15);

  // Message length bonus (longer = more interested)
  if (content.length > 50) engagementScore = Math.min(100, engagementScore + 10);
  if (content.length > 100) engagementScore = Math.min(100, engagementScore + 10);

  // Intent: buying signals vs rejection
  if (detectedBuying.length > 0) {
    intentScore = Math.min(100, intentScore + detectedBuying.length * 20);
    sentimentScore = Math.min(100, sentimentScore + 10);
  }
  if (detectedRejection.length > 0) {
    intentScore = Math.max(0, intentScore - detectedRejection.length * 30);
    sentimentScore = Math.max(0, sentimentScore - 20);
  }

  // Interest = weighted combo
  interestScore = Math.round(
    intentScore * 0.5 + engagementScore * 0.3 + sentimentScore * 0.2
  );

  // ---- Determine lead status ----
  let leadStatus = "warm"; // default
  let nextAction = "follow_up";

  if (detectedRejection.length >= 2 || (detectedRejection.length > 0 && inboundMessages.length <= 1)) {
    leadStatus = "cold";
    nextAction = "wait";
  }

  if (detectedRejection.length >= 3 || content.includes("block") || content.includes("spam")) {
    leadStatus = "dead";
    nextAction = "stop";
  }

  if (detectedBuying.length >= 2 || intentScore >= 60) {
    leadStatus = "hot";
    nextAction = "close_deal";
  }

  if (isGreeting && inboundMessages.length === 1) {
    leadStatus = "warm";
    nextAction = "follow_up";
  }

  // Check for deal keywords
  const dealKeywords = ["đặt hàng", "mua", "thanh toán", "chuyển khoản", "đăng ký", "hợp đồng"];
  if (dealKeywords.some(k => content.includes(k))) {
    leadStatus = "hot";
    nextAction = "close_deal";
    interestScore = Math.max(interestScore, 80);
  }

  // ---- Reply time calculation ----
  let avgReplyTime: number | null = null;
  const replyTimes: number[] = [];
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].direction === "inbound" && messages[i - 1].direction === "outbound") {
      const diff = (messages[i].created_at.getTime() - messages[i - 1].created_at.getTime()) / 1000;
      if (diff > 0 && diff < 86400) replyTimes.push(diff);
    }
  }
  if (replyTimes.length > 0) {
    avgReplyTime = Math.round(replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length);
    // Fast reply = more interested
    if (avgReplyTime < 60) interestScore = Math.min(100, interestScore + 10);
    if (avgReplyTime < 300) interestScore = Math.min(100, interestScore + 5);
  }

  // Clamp
  interestScore = Math.max(0, Math.min(100, interestScore));

  // ---- Persist score ----
  const existingScore = conversation.score;
  const allSignals = [...detectedBuying.map(s => `+${s}`), ...detectedRejection.map(s => `-${s}`)];

  const scoreData = {
    interest_score: interestScore,
    intent_score: intentScore,
    engagement_score: engagementScore,
    sentiment_score: sentimentScore,
    lead_status: leadStatus,
    buying_signals: detectedBuying.length > 0
      ? JSON.stringify([...(existingScore?.buying_signals ? JSON.parse(existingScore.buying_signals) : []), ...detectedBuying].filter((v, i, a) => a.indexOf(v) === i))
      : existingScore?.buying_signals || null,
    rejection_signals: detectedRejection.length > 0
      ? JSON.stringify([...(existingScore?.rejection_signals ? JSON.parse(existingScore.rejection_signals) : []), ...detectedRejection].filter((v, i, a) => a.indexOf(v) === i))
      : existingScore?.rejection_signals || null,
    avg_reply_time_seconds: avgReplyTime,
    reply_rate: conversation.outbound_count > 0
      ? inboundMessages.length / conversation.outbound_count
      : null,
    total_words_received: inboundMessages.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0),
    longest_message_chars: Math.max(...inboundMessages.map(m => m.content.length), 0),
    first_reply_at: existingScore?.first_reply_at || new Date(),
    last_activity_at: new Date(),
    scored_at: new Date(),
    ai_next_action: nextAction,
  };

  if (existingScore) {
    await prisma.conversationScore.update({
      where: { id: existingScore.id },
      data: scoreData,
    });
  } else {
    await prisma.conversationScore.create({
      data: {
        conversation_id: conversationId,
        contact_id: contactId,
        ...scoreData,
      },
    });
  }

  // Update contact interest score
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      interest_score: interestScore,
      outreach_status: leadStatus === "dead" ? "not_interested"
        : leadStatus === "hot" ? "interested"
        : leadStatus === "converted" ? "converted"
        : "replied",
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      action: "score",
      entity_type: "conversation",
      entity_id: conversationId,
      details: JSON.stringify({
        lead_status: leadStatus,
        interest_score: interestScore,
        signals: allSignals,
        next_action: nextAction,
        message_preview: content.slice(0, 100),
      }),
    },
  });

  // Broadcast score update via WebSocket
  broadcast({
    type: "zalo:score-updated",
    payload: {
      conversation_id: conversationId,
      contact_id: contactId,
      lead_status: leadStatus,
      interest_score: interestScore,
      next_action: nextAction,
      signals: allSignals,
    },
    timestamp: new Date().toISOString(),
  });

  return {
    lead_status: leadStatus,
    interest_score: interestScore,
    signals: allSignals,
    next_action: nextAction,
  };
}

/**
 * Get dashboard stats for all conversations
 */
export async function getConversationStats() {
  const [total, hot, warm, cold, dead, converted] = await Promise.all([
    prisma.conversationScore.count(),
    prisma.conversationScore.count({ where: { lead_status: "hot" } }),
    prisma.conversationScore.count({ where: { lead_status: "warm" } }),
    prisma.conversationScore.count({ where: { lead_status: "cold" } }),
    prisma.conversationScore.count({ where: { lead_status: "dead" } }),
    prisma.conversationScore.count({ where: { lead_status: "converted" } }),
  ]);

  const avgScore = await prisma.conversationScore.aggregate({
    _avg: { interest_score: true },
  });

  const recentHot = await prisma.conversationScore.findMany({
    where: { lead_status: "hot" },
    include: {
      contact: { select: { display_name: true, zalo_id: true, phone: true } },
      conversation: { select: { last_message_at: true, total_messages: true } },
    },
    orderBy: { interest_score: "desc" },
    take: 10,
  });

  return {
    total,
    by_status: { hot, warm, cold, dead, converted },
    conversion_rate: total > 0 ? ((converted / total) * 100).toFixed(1) + "%" : "0%",
    avg_interest_score: Math.round(avgScore._avg.interest_score || 0),
    hot_leads: recentHot.map(s => ({
      contact_name: s.contact.display_name,
      zalo_id: s.contact.zalo_id,
      phone: s.contact.phone,
      interest_score: s.interest_score,
      total_messages: s.conversation.total_messages,
      last_activity: s.last_activity_at,
      next_action: s.ai_next_action,
    })),
  };
}
