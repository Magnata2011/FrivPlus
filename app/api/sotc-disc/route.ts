import { NextResponse } from "next/server";

// Backend URL for the disc image. Defaults to the R2 public URL placeholder;
// override via the SOTC_DISC_URL env var in the Vercel project settings.
const BLOB_URL =
  process.env.SOTC_DISC_URL ||
  "https://REPLACE_WITH_R2_PUBLIC_URL/shadow-of-the-colossus/disc.iso";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag",
  "Access-Control-Max-Age": "86400",
};

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function HEAD(request: Request) {
  const res = await fetch(BLOB_URL, {
    method: "HEAD",
    headers: pickRange(request),
  });
  return cors(res);
}

export async function GET(request: Request) {
  const res = await fetch(BLOB_URL, {
    method: "GET",
    headers: pickRange(request),
  });
  return cors(res);
}

function pickRange(request: Request): Record<string, string> {
  const range = request.headers.get("range");
  return range ? { Range: range } : {};
}
