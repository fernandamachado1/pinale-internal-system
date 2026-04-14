import * as webpush from "npm:web-push@3.6.7";

export type WebPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
  [key: string]: unknown;
};

let didConfigure = false;

function requiredEnv(name: string): string {
  const value = (Deno.env.get(name) ?? "").trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export function getVapidPublicKey(): string {
  return requiredEnv("VAPID_PUBLIC_KEY");
}

export function isPushConfigured(): boolean {
  return Boolean((Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim()) && Boolean((Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim());
}

export function configureWebPush(): void {
  if (didConfigure) return;
  const subject = (Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com").trim();
  const publicKey = requiredEnv("VAPID_PUBLIC_KEY");
  const privateKey = requiredEnv("VAPID_PRIVATE_KEY");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  didConfigure = true;
}

export async function sendWebPush(subscription: WebPushSubscription, payload: unknown): Promise<{ ok: true } | { ok: false; statusCode?: number }> {
  try {
    configureWebPush();
    await webpush.sendNotification(subscription as any, JSON.stringify(payload));
    return { ok: true };
  } catch (err: any) {
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : undefined;
    return { ok: false, statusCode };
  }
}

