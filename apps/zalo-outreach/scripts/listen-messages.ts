/**
 * Lắng nghe tin nhắn Zalo realtime
 * Khi có tin nhắn mới → log ra + gửi về Hub
 */
import { Zalo } from "zca-js";
import { PrismaClient } from "@prisma/client";
import { createDecipheriv } from "crypto";

const prisma = new PrismaClient();

function decrypt(ct: string): string {
  const key = Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY!, "hex");
  const [ivH, tagH, enc] = ct.split(":");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(ivH, "hex"));
  d.setAuthTag(Buffer.from(tagH, "hex"));
  return d.update(enc, "hex", "utf8") + d.final("utf8");
}

async function main() {
  const account = await prisma.zaloAccount.findFirst({ where: { status: "active" } });
  if (!account) { console.log("No account"); return; }

  const cookies = JSON.parse(decrypt(account.cookie));
  const imei = decrypt(account.imei);

  const zalo = new Zalo();
  const api = await zalo.login({ cookie: cookies, imei, userAgent: account.user_agent });
  const myId = api.getOwnId();
  console.log(`Logged in: ${myId} (${account.name})`);
  console.log("Listening for messages... (Ctrl+C to stop)\n");

  api.listener.on("message", async (message: any) => {
    try {
      const data = message.data || message;
      const senderId = data.uidFrom || data.uid || "";
      const content = data.content || "";
      const msgId = data.msgId || "";
      const threadId = data.idTo || data.threadId || "";
      const isSelf = String(senderId) === String(myId);
      const isGroup = data.idTo && data.idTo !== String(myId) && data.idTo !== String(senderId);

      if (isSelf) return; // Skip own messages

      // Get sender name if possible
      let senderName = senderId;
      try {
        const contact = await prisma.contact.findFirst({ where: { zalo_id: String(senderId) } });
        if (contact) senderName = contact.display_name;
      } catch {}

      const timestamp = new Date().toLocaleTimeString("vi-VN");

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📩 [${timestamp}] Tin nhắn mới!`);
      console.log(`   Từ: ${senderName} (${senderId})`);
      console.log(`   Nội dung: ${typeof content === "string" ? content : JSON.stringify(content).slice(0, 200)}`);
      if (isGroup) console.log(`   Nhóm: ${threadId}`);
      console.log(`   MsgID: ${msgId}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Notify Hub (nếu Hub đang chạy)
      try {
        await fetch("http://localhost:3000/api/webhook/zalo-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender_id: senderId,
            sender_name: senderName,
            content: typeof content === "string" ? content : JSON.stringify(content),
            msg_id: msgId,
            is_group: isGroup,
            thread_id: threadId,
            timestamp: new Date().toISOString(),
          }),
        });
        console.log(`   → Đã gửi về Hub ✅`);
      } catch {
        console.log(`   → Hub không available (bỏ qua)`);
      }
      console.log("");

    } catch (err) {
      console.error("Error processing message:", (err as Error).message);
    }
  });

  await api.listener.start();
  console.log("🔊 Listener started! Waiting for messages...\n");
}

main().catch(console.error);
