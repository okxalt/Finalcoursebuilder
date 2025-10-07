import { NextResponse } from "next/server";
import { chat, extractJsonObject } from "@/lib/groq";
import { getCosts, ensureCredits, decrementCredits } from "@/lib/credits";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { opportunityTitle, numChapters } = await request.json();
    const n = Number(numChapters);
    if (!opportunityTitle || typeof opportunityTitle !== "string") {
      return NextResponse.json({ error: "Invalid or missing 'opportunityTitle'" }, { status: 400 });
    }
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return NextResponse.json({ error: "'numChapters' must be an integer between 1 and 50" }, { status: 400 });
    }

    const prompt = `Create a course outline for a book titled "${opportunityTitle}". It must have exactly ${n} chapters. For each chapter, provide a \"title\" and a \"summary\" (an array of 3-5 strings detailing key learning points). Return ONLY a valid JSON object in this format: { \"title\": \"...\", \"chapters\": [{ \"title\": \"...\", \"summary\": [\"...\", \"...\"] }] }`;

    const costs = getCosts();
    if (!ensureCredits(costs.outline)) {
      return NextResponse.json({ error: "Not enough credits" }, { status: 402 });
    }

    const content = await chat([
      { role: "system", content: "You are a precise assistant that outputs only the requested JSON structure." },
      { role: "user", content: prompt },
    ], { temperature: 0.3, max_tokens: 2048 });

    const outline = extractJsonObject(content);

    // Basic validation of structure
    if (!outline || typeof outline !== "object" || !Array.isArray(outline.chapters)) {
      return NextResponse.json({ error: "Model returned an invalid outline structure" }, { status: 500 });
    }

    // Ensure chapter count matches exactly
    if (outline.chapters.length !== n) {
      outline.chapters = outline.chapters.slice(0, n);
      while (outline.chapters.length < n) {
        outline.chapters.push({ title: `Chapter ${outline.chapters.length + 1}`, summary: [] });
      }
    }

    // Sanitize chapters
    outline.title = typeof outline.title === "string" ? outline.title.trim() : String(outline.title || "");
    outline.chapters = outline.chapters.map((ch, idx) => {
      const title = typeof ch.title === "string" ? ch.title.trim() : `Chapter ${idx + 1}`;
      const summary = Array.isArray(ch.summary)
        ? ch.summary.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 6)
        : [];
      return { title, summary };
    });

    decrementCredits(costs.outline);
    return NextResponse.json(outline);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("/api/outline error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate outline" },
      { status: 500 }
    );
  }
}
