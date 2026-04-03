import { Zalo, type API } from "zca-js";
import { decrypt } from "../crypto.js";
import { prisma } from "../db.js";

// Store active Zalo API instances by account ID
const activeClients = new Map<string, API>();

export async function getZaloClient(accountId?: string): Promise<API> {
  // Find account
  const account = accountId
    ? await prisma.zaloAccount.findUnique({ where: { id: accountId } })
    : await prisma.zaloAccount.findFirst({
        where: { status: "active", is_default: true },
      }) ??
      (await prisma.zaloAccount.findFirst({ where: { status: "active" } }));

  if (!account) {
    throw new Error("No active Zalo account found. Please login first via QR.");
  }

  // Return cached client if exists
  const cached = activeClients.get(account.id);
  if (cached) {
    return cached;
  }

  // Decrypt credentials
  const cookieJson = decrypt(account.cookie);
  const imei = decrypt(account.imei);
  const userAgent = account.user_agent;

  // Parse cookies back from JSON
  const cookies = JSON.parse(cookieJson);

  // Get secretKey if saved
  let secretKey: string | undefined;
  const skSetting = await prisma.setting.findUnique({
    where: { key: `secret_key_${account.zalo_id}` },
  });
  if (skSetting) {
    secretKey = decrypt(skSetting.value);
  }

  // Login with saved credentials
  const zalo = new Zalo();
  const api = await zalo.login({
    cookie: cookies,
    imei,
    userAgent,
  });

  activeClients.set(account.id, api);

  // Update last_active
  await prisma.zaloAccount.update({
    where: { id: account.id },
    data: { last_active_at: new Date() },
  });

  return api;
}

export function getCachedClient(accountId: string): API | undefined {
  return activeClients.get(accountId);
}

export function removeClient(accountId: string): void {
  activeClients.delete(accountId);
}

export function getActiveClientCount(): number {
  return activeClients.size;
}
