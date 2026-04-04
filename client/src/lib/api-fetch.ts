import { hasSupabaseEnv, supabase } from "@/lib/supabase";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!apiBaseUrl) return input;

  if (typeof input === "string") {
    if (isAbsoluteUrl(input)) return input;
    if (input.startsWith("/")) return new URL(input, apiBaseUrl).toString();
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

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = mergeHeaders(
    token ? { Authorization: `Bearer ${token}` } : {},
    init.headers,
  );

  const res = await fetch(resolvedInput, { ...init, headers });
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
