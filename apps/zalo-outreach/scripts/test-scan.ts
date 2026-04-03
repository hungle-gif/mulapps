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

  console.log("Logging in...");
  const zalo = new Zalo();
  const api = await zalo.login({ cookie: cookies, imei, userAgent: account.user_agent });
  console.log("Logged in:", api.getOwnId());

  // CORRECT: payload is { link, memberPage }
  console.log("\nScanning https://zalo.me/g/vzftyp584 ...\n");
  const result = await api.getGroupLinkInfo({ link: "https://zalo.me/g/vzftyp584", memberPage: 1 });

  console.log("Result keys:", Object.keys(result).join(", "));
  console.log(JSON.stringify(result, null, 2).substring(0, 3000));

  await prisma.$disconnect();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
