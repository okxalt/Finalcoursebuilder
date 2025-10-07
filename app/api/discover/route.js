import { NextResponse } from "next/server";
import { chat, extractJsonArray } from "@/lib/groq";
import { getCosts, ensureCredits, decrementCredits } from "@/lib/credits";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { topic } = await request.json();
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Invalid or missing 'topic'" }, { status: 400 });
    }

    const prompt = `You are a market research analyst. Based on the topic "${topic}", identify 3-5 distinct and marketable course or ebook opportunities. Return ONLY a valid JSON array of strings, where each string is a compelling title. Example format: ["Title 1", "Title 2", "Title 3"]`;

    const costs = getCosts();
    if (!ensureCredits(costs.discover)) {
      return NextResponse.json({ error: "Not enough credits" }, { status: 402 });
    }

    const content = await chat([
      { role: "system", content: "You are a precise assistant that outputs only the requested JSON when asked." },
      { role: "user", content: prompt },
    ], { temperature: 0.2, max_tokens: 512 });

    let opportunities;
    opportunities = extractJsonArray(content);

    // Sanitize and normalize
    opportunities = opportunities
      .filter((v) => typeof v === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 5);
    // Deduplicate
    opportunities = Array.from(new Set(opportunities));

    decrementCredits(costs.discover);
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
