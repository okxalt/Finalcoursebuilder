import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasGroqKey = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());

  // Light connectivity check to Groq API models endpoint
  let reachable = false;
  let status = null;
  let error = null;

  if (hasGroqKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      status = res.status;
      reachable = res.ok;
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        error = body?.slice(0, 500) || `HTTP ${res.status}`;
      }
    } catch (e) {
      error = e?.message || String(e || "");
    }
  }

  return NextResponse.json({
    env: {
      hasGroqKey,
    },
    groq: {
      reachable,
      status,
      error: reachable ? null : error,
    },
  });
}
