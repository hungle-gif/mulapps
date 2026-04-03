/**
 * Zalo QR Login — TỰ ĐỘNG LƯU SESSION LÂU DÀI
 * Chạy: npx tsx scripts/login-qr.ts
 */

import { Zalo } from "zca-js";
import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "crypto";

const prisma = new PrismaClient();
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key || key.length < 64) throw new Error("Set CREDENTIALS_ENCRYPTION_KEY in .env");
  return Buffer.from(key, "hex");
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

async function main() {
  console.log("===========================================");
  console.log("  ZALO QR LOGIN — AUTO SAVE SESSION");
  console.log("===========================================\n");

  const zalo = new Zalo();

  try {
    console.log("Đang tạo mã QR... (mở qr.png để quét)\n");

    const api = await zalo.loginQR();
    const ownId = api.getOwnId();

    console.log(`\n✅ Đăng nhập thành công! Zalo ID: ${ownId}`);

    // === LẤY CREDENTIALS TỪ API ===
    // zca-js cung cấp api.getContext() và api.getCookie()
    const context = api.getContext();
    const cookieJar = api.getCookie();

    const imei = context.imei;
    const userAgent = context.userAgent;
    const secretKey = context.secretKey;
    const uid = context.uid;

    // Serialize cookies từ CookieJar
    const cookieJson = JSON.stringify(cookieJar.toJSON().cookies);

    console.log(`   IMEI: ${imei ? "✅" : "❌"}`);
    console.log(`   Cookie: ${cookieJson ? "✅" : "❌"} (${cookieJson.length} chars)`);
    console.log(`   UserAgent: ${userAgent ? "✅" : "❌"}`);
    console.log(`   SecretKey: ${secretKey ? "✅" : "❌"}`);
    console.log(`   UID: ${uid}`);

    if (!imei || !cookieJson) {
      console.error("\n❌ Thiếu credentials, không thể lưu session.");
      return;
    }

    // === MÃ HÓA + LƯU VÀO DATABASE ===
    const account = await prisma.zaloAccount.upsert({
      where: { zalo_id: String(ownId) },
      update: {
        cookie: encrypt(cookieJson),
        imei: encrypt(imei),
        user_agent: userAgent || "Mozilla/5.0",
        status: "active",
        last_active_at: new Date(),
      },
      create: {
        zalo_id: String(ownId),
        cookie: encrypt(cookieJson),
        imei: encrypt(imei),
        user_agent: userAgent || "Mozilla/5.0",
        name: `Operis`,
        status: "active",
        is_default: true,
        last_active_at: new Date(),
      },
    });

    // Lưu thêm secretKey vào settings
    if (secretKey) {
      await prisma.setting.upsert({
        where: { key: `secret_key_${ownId}` },
        update: { value: encrypt(secretKey) },
        create: { key: `secret_key_${ownId}`, value: encrypt(secretKey) },
      });
    }

    console.log(`\n✅ SESSION ĐÃ LƯU THÀNH CÔNG!`);
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Zalo ID: ${account.zalo_id}`);
    console.log(`   Name: ${account.name}`);
    console.log(`   Credentials mã hóa AES-256-GCM → database`);
    console.log(`\n   Server dùng session này lâu dài, không cần quét lại.`);
    console.log(`   Chạy: npm run dev → gọi API bình thường.\n`);

  } catch (error) {
    console.error("\n❌ Lỗi:", (error as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
