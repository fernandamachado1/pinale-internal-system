import { hasSupabaseEnv, supabase } from "@/lib/supabase";

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
  if (!hasSupabaseEnv) {
    return await fetch(input, init);
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = mergeHeaders(
    token ? { Authorization: `Bearer ${token}` } : {},
    init.headers,
  );

  const res = await fetch(input, { ...init, headers });
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
