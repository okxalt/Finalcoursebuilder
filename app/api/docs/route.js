import { NextResponse } from "next/server";
import { chat, extractJsonObject } from "@/lib/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { topic, includeCodeExamples = true, language = "javascript", scope = "both" } = await request.json();
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Invalid or missing 'topic'" }, { status: 400 });
    }

    const scopeText = scope === "recent" ? "emphasize developments from the last 12-18 months" : scope === "past" ? "focus on fundamental, historical context and stable practices" : "cover fundamentals and any recent changes (last 12-18 months)";

    const prompt = `Create an in-depth documentation in MARKDOWN for the topic: "${topic}". ${scopeText}. If the topic is code-related, include practical, runnable examples in ${language}. Use this structure with clear headings and subheadings:

# Title

## Overview
- A concise description with context and when/why to use it.

## Key Concepts
- 5-9 bullets of the most important ideas with brief explanations.

## Step-by-Step Guide
- Numbered steps to accomplish the most common task(s).

## Code Examples
- Provide 2-4 examples in ${language} when relevant. Prefer minimal, runnable snippets.

## Best Practices
- Actionable tips and patterns.

## Pitfalls & Troubleshooting
- Common mistakes and how to fix them.

## FAQ
- 5-8 short Q&A pairs.

## References & Further Reading
- Curated links (if generic, describe the type of resource instead of specific URLs).

Return ONLY a JSON object with this shape: { "title": string, "content": string } where content contains the full markdown.`;

    const content = await chat([
      { role: "system", content: "You write world-class technical documentation with crystal-clear structure." },
      { role: "user", content: prompt },
    ], { temperature: 0.4, max_tokens: 4096 });

    const doc = extractJsonObject(content);
    if (!doc || typeof doc.title !== "string" || typeof doc.content !== "string") {
      return NextResponse.json({ error: "Model returned invalid documentation format" }, { status: 500 });
    }
    return NextResponse.json(doc);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("/api/docs error", error);
    return NextResponse.json({ error: error?.message || "Failed to generate documentation" }, { status: 500 });
  }
}
