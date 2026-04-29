import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const debugPerf = String(import.meta.env.VITE_DEBUG_PERF ?? "").toLowerCase() === "true";
const localApiBaseUrl = "http://localhost:8001";

let didInitAuthListener = false;
let cachedAccessToken: string | null | undefined = undefined;
let inFlightSession: Promise<{ token: string | null }> | null = null;

function initAuthListener() {
  if (!hasSupabaseEnv) return;
  if (didInitAuthListener) return;
  didInitAuthListener = true;

  supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    cachedAccessToken = session?.access_token ?? null;
  });
}

async function getAccessToken(): Promise<string | null> {
  initAuthListener();

  // cachedAccessToken:
  // - undefined: not initialized yet
  // - null: known to be unauthenticated
  // - string: token
  if (cachedAccessToken !== undefined) return cachedAccessToken;

  const promise =
    inFlightSession ??
    (inFlightSession = supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => ({ token: data.session?.access_token ?? null }))
      .catch(() => ({ token: null }))
      .finally(() => {
        inFlightSession = null;
      }));

  const { token } = await promise;
  cachedAccessToken = token;
  return token;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function getDefaultApiBaseUrl(): string | null {
  if (apiBaseUrl) return apiBaseUrl;
  if (typeof window === "undefined") return null;

  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return localApiBaseUrl;
  }

  return null;
}

function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  const defaultBaseUrl = getDefaultApiBaseUrl();
  if (!defaultBaseUrl) return input;

  if (typeof input === "string") {
    if (isAbsoluteUrl(input)) return input;
    if (input.startsWith("/")) return new URL(input, defaultBaseUrl).toString();
    return input;
  }

  if (input instanceof URL) return input;

  // Request object (rare in this codebase) already has an absolute `url`.
  return input;
}

function mergeHeaders(
  base: Record<string, string>,
  extra: HeadersInit | undefined,
): Headers {
  const headers = new Headers(base);
  if (!extra) return headers;
  const extraHeaders = new Headers(extra);
  extraHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const resolvedInput = resolveApiUrl(input);

  if (!hasSupabaseEnv) {
    return await fetch(resolvedInput, init);
  }

  const t0 = debugPerf ? performance.now() : 0;
  const token = await getAccessToken();
  const t1 = debugPerf ? performance.now() : 0;

  const headers = mergeHeaders(
    token ? { Authorization: `Bearer ${token}` } : {},
    init.headers,
  );

  let res: Response;
  try {
    res = await fetch(resolvedInput, { ...init, headers });
  } catch (error) {
    const url = typeof resolvedInput === "string" ? resolvedInput : String(resolvedInput);
    throw new Error(`Não foi possível conectar à API em ${url}. Verifique se o backend está no ar.`, { cause: error });
  }
  if (debugPerf) {
    const t2 = performance.now();
    console.debug("[perf] apiFetch", {
      url: typeof resolvedInput === "string" ? resolvedInput : String(resolvedInput),
      tokenMs: Math.round(t1 - t0),
      fetchMs: Math.round(t2 - t1),
      status: res.status,
    });
  }
  if (res.status === 401) {
    // Only force the login screen when we truly don't have a session.
    // If we have a token and still get a 401, it usually indicates an API-side issue
    // (token validation/config), and redirecting causes a navigation loop.
    if (!token && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
  return res;
}
