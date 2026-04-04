async function loadDotEnv(): Promise<void> {
  try {
    const isDeploy = Boolean(Deno.env.get("DENO_DEPLOYMENT_ID"));
    if (isDeploy) return;
    const { load } = await import("jsr:@std/dotenv");
    const conf = await load({ envPath: ".env" });
    // Override local shell exports to avoid "stale env" issues while iterating.
    for (const [key, value] of Object.entries(conf)) {
      Deno.env.set(key, value);
    }
  } catch {
    // optional: makes local dev easier when a .env exists
  }
}

await loadDotEnv();

const [{ Hono }, { serveFile }, path, routes] = await Promise.all([
  import("npm:hono"),
  import("jsr:@std/http/file-server"),
  import("jsr:@std/path"),
  import("./routes.ts"),
]);

const { join, normalize } = path;
const { registerApiRoutes } = routes as typeof import("./routes.ts");

const app = new Hono();
registerApiRoutes(app as any);

const publicRoot = join(Deno.cwd(), "dist", "public");

function resolvePublicPath(pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const safePath = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = join(publicRoot, safePath);
  if (!fullPath.startsWith(publicRoot)) return null;
  return fullPath;
}

app.get("*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname.startsWith("/api")) return c.notFound();

  const request = c.req.raw;
  const maybeFilePath = pathname === "/" ? join(publicRoot, "index.html") : resolvePublicPath(pathname);
  if (maybeFilePath) {
    try {
      return await serveFile(request, maybeFilePath);
    } catch {
      // fall through to SPA fallback
    }
  }

  return await serveFile(request, join(publicRoot, "index.html"));
});

const port = Number(Deno.env.get("PORT") ?? "8000");
Deno.serve({ port }, app.fetch);
