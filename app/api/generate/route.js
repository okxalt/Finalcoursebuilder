import { NextResponse } from "next/server";
import { chat } from "@/lib/groq";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { courseTitle, chapterTitle, learningObjectives } = await request.json();
    if (!courseTitle || typeof courseTitle !== "string") {
      return NextResponse.json({ error: "Invalid or missing 'courseTitle'" }, { status: 400 });
    }
    if (!chapterTitle || typeof chapterTitle !== "string") {
      return NextResponse.json({ error: "Invalid or missing 'chapterTitle'" }, { status: 400 });
    }
    if (!Array.isArray(learningObjectives)) {
      return NextResponse.json({ error: "'learningObjectives' must be an array of strings" }, { status: 400 });
    }

    const points = learningObjectives.filter((s) => typeof s === "string" && s.trim().length > 0);

    const prompt = `You are an expert author writing a chapter for the book "${courseTitle}". Write the full content for the chapter titled "${chapterTitle}". Cover these key points: ${points.join(", ")}. Use markdown for formatting, including headings, lists, and **bold** text. The tone should be clear, engaging, and practical.`;

    const content = await chat([
      { role: "system", content: "You are a thoughtful expert author who writes in structured markdown." },
      { role: "user", content: prompt },
    ], { temperature: 0.6, max_tokens: 4096 });

    return NextResponse.json({ content });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("/api/generate error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate chapter content" },
      { status: 500 }
    );
  }
}
