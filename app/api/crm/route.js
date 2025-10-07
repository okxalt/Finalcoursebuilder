import { NextResponse } from "next/server";
import { chat } from "@/lib/groq";
import { getCosts, ensureCredits, decrementCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { courseTitle, outline } = await request.json();
    if (!courseTitle || !outline || !Array.isArray(outline?.chapters)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const costs = getCosts();
    if (!ensureCredits(costs.crm)) {
      return NextResponse.json({ error: "Not enough credits" }, { status: 402 });
    }

    const summary = outline.chapters
      .map((ch, i) => `- Chapter ${i + 1}: ${ch.title} => ${(ch.summary || []).join("; ")}`)
      .join("\n");

    const prompt = `You are a senior growth marketer and course publisher. Based on the course titled "${courseTitle}", with outline:\n${summary}\n\nCreate a CRM + go-to-market pack in MARKDOWN with these sections and clear, practical content:\n\n# Promotion Strategy\n- 5-8 channels with actionable tactics\n- 2-week launch calendar\n\n# Email Sequence (7-day)\n- Day by day subjects and short, high-converting bodies\n\n# Creators To Target\n- 10 creator niches with why they fit\n\n# Influencer Outreach Messages\n- 3 short DM templates and 2 email templates that get replies\n\n# Affiliate Program\n- Commission, terms, assets list, UTM examples\n\nWrite concise, skimmable content. Use headings, subheadings, and lists. Keep it practical.`;

    const content = await chat([
      { role: "system", content: "You create crisp, tactical growth plans in markdown." },
      { role: "user", content: prompt },
    ], { temperature: 0.5, max_tokens: 4096 });

    decrementCredits(costs.crm);
    return NextResponse.json({ content });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("/api/crm error", error);
    return NextResponse.json({ error: error?.message || "Failed to generate CRM" }, { status: 500 });
  }
}
