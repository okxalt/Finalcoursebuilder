import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function paragraphFromMarkdown(md) {
  // Minimal: split by lines; ignore complex markdown; keep text
  const lines = String(md || "").split(/\r?\n/);
  const paras = [];
  for (const line of lines) {
    const text = line.replace(/^#+\s*/, "");
    if (text.trim().length === 0) {
      paras.push(new Paragraph(""));
    } else {
      paras.push(new Paragraph(text));
    }
  }
  return paras;
}

export async function POST(request) {
  try {
    const { title, chapters } = await request.json();
    if (!title || !Array.isArray(chapters)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({ text: String(title), heading: HeadingLevel.TITLE }),
            ...chapters.flatMap((ch, idx) => {
              const header = new Paragraph({
                text: `Chapter ${idx + 1}: ${ch.title || "Untitled"}`,
                heading: HeadingLevel.HEADING_1,
              });
              const summaryParas = Array.isArray(ch.summary)
                ? ch.summary.map((s) => new Paragraph({ text: String(s) }))
                : [];
              const contentParas = paragraphFromMarkdown(ch.content || "");
              return [header, ...summaryParas, ...contentParas];
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.docx"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("/api/export error", error);
    return NextResponse.json({ error: error?.message || "Failed to export" }, { status: 500 });
  }
}
