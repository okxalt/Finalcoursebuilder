import { NextResponse } from "next/server";
import { chat, extractJsonArray } from "@/lib/groq";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { topic } = await request.json();
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Invalid or missing 'topic'" }, { status: 400 });
    }

    const prompt = `You are a market research analyst. Based on the topic "${topic}", identify 3-5 distinct and marketable course or ebook opportunities. Return ONLY a valid JSON array of strings, where each string is a compelling title. Example format: ["Title 1", "Title 2", "Title 3"]`;

    const content = await chat([
      { role: "system", content: "You are a precise assistant that outputs only the requested JSON when asked." },
      { role: "user", content: prompt },
    ], { temperature: 0.2, max_tokens: 512, response_format: { type: "json_object" } });

    let opportunities;
    try {
      const maybeObj = JSON.parse(content);
      if (Array.isArray(maybeObj)) {
        opportunities = maybeObj;
      } else if (maybeObj && Array.isArray(maybeObj.opportunities)) {
        opportunities = maybeObj.opportunities;
      }
    } catch {}
    if (!opportunities) {
      opportunities = extractJsonArray(content);
    }
    return NextResponse.json(opportunities);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("/api/discover error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to discover opportunities" },
      { status: 500 }
    );
  }
}
