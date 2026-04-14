import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api-fetch";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  return await navigator.serviceWorker.register("/sw.js");
}

export async function getIsSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return Boolean(sub);
}

export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error("Push não suportado neste dispositivo/navegador.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificação não concedida.");

  const res = await apiFetch(api.push.publicKey.path);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Falha ao obter chave pública do push");
  }
  const { publicKey } = (await res.json()) as { publicKey: string };

  const reg = await getServiceWorkerRegistration();
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });

  const subscribeRes = await apiFetch(api.push.subscribe.path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!subscribeRes.ok) {
    const payload = (await subscribeRes.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Falha ao salvar subscription no servidor");
  }
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await apiFetch(api.push.unsubscribe.path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

