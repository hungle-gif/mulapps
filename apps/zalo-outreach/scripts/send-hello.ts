/**
 * Tìm user theo SĐT và gửi tin nhắn
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
  const PHONE = "0868848668";
  const MESSAGE = "Xin chào! 👋";

  // Login
  const account = await prisma.zaloAccount.findFirst({ where: { status: "active" } });
  if (!account) { console.log("No account"); return; }

  const cookies = JSON.parse(decrypt(account.cookie));
  const imei = decrypt(account.imei);

  const zalo = new Zalo();
  const api = await zalo.login({ cookie: cookies, imei, userAgent: account.user_agent });
  console.log("Logged in:", api.getOwnId());

  // Find user by phone number (string, not object)
  console.log(`\nFinding user: ${PHONE}...`);
  const user = await api.findUser(PHONE);
  console.log("Found:", JSON.stringify(user, null, 2).slice(0, 500));

  if (!user || !user.uid) {
    console.log("User not found");
    return;
  }

  console.log(`\nUser: ${user.displayName || user.zaloName || "Unknown"} (uid: ${user.uid})`);

  // Send message: sendMessage(message, threadId, type)
  // message can be string or Message object
  console.log(`Sending "${MESSAGE}"...`);
  const result = await api.sendMessage(MESSAGE, user.uid);
  console.log("Result:", JSON.stringify(result, null, 2).slice(0, 300));
  console.log("\n✅ Done!");

  await prisma.$disconnect();
}

main().catch(console.error);
