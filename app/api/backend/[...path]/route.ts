import { NextRequest } from "next/server";

/**
 * Server-side proxy to the FastAPI backend. The shared API key lives here
 * in server env vars — the browser never sees it.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY ?? "change-me";

async function forward(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = `${BACKEND_URL}/api/v1/${pathStr}${req.nextUrl.search}`;

  console.log(`[Proxy] ➡️  Forwarding ${req.method} /api/backend/${pathStr} to ${url}`);

  const headers: Record<string, string> = { "X-API-Key": BACKEND_API_KEY };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers["authorization"] = authHeader;

  try {
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

    const resp = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });

    console.log(`[Proxy] ⬅️  Response from backend: ${resp.status} for ${req.method} /${pathStr}`);

    if (!resp.ok) {
      try {
        const errorText = await resp.clone().text();
        console.error(`[Proxy] ❌ Backend error details:`, errorText);
      } catch (err) {
        console.error(`[Proxy] ❌ Failed to read backend error text:`, err);
      }
    }

    const responseHeaders: Record<string, string> = {};
    const respContentType = resp.headers.get("content-type");
    if (respContentType) responseHeaders["content-type"] = respContentType;
    
    // Copy cache-control and connection headers to support SSE streaming properly
    const cacheControl = resp.headers.get("cache-control");
    if (cacheControl) responseHeaders["cache-control"] = cacheControl;
    const connection = resp.headers.get("connection");
    if (connection) responseHeaders["connection"] = connection;

    // Prevent buffer holding in intermediate proxies (like Next.js dev server/Nginx)
    if (respContentType?.includes("text/event-stream")) {
      responseHeaders["x-accel-buffering"] = "no";
    }

    return new Response(resp.body, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Proxy] ❌ Error forwarding request to backend:`, error);
    return new Response(
      JSON.stringify({ detail: `Failed to connect to backend: ${error instanceof Error ? error.message : String(error)}` }),
      { 
        status: 502,
        headers: { "content-type": "application/json" }
      }
    );
  }
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
