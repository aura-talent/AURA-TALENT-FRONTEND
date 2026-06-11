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
  const url = `${BACKEND_URL}/api/v1/${path.join("/")}${req.nextUrl.search}`;

  const headers: Record<string, string> = { "X-API-Key": BACKEND_API_KEY };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const body = req.method === "GET" ? undefined : await req.arrayBuffer();

  const resp = await fetch(url, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") ?? "application/json",
    },
  });
}

export { forward as GET, forward as POST, forward as PATCH };
