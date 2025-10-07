import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, SectionType, AlignmentType } from "docx";
import { Theme } from "./tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanMarkdownLine(line) {
  let text = String(line || "");
  // Remove heading markers
  text = text.replace(/^#+\s*/, "");
  // Convert leading bullets '+' or '-' or '*' to a dot
  text = text.replace(/^\s*[+\-*]\s+/, "• ");
  // Strip bold/italic markers **, __, *, _
  text = text.replace(/\*\*|__/g, "");
  text = text.replace(/(^|\s)\*(\S.*?\S)?\*(?=\s|$)/g, (_, p1, p2 = "") => `${p1}${p2}`);
  text = text.replace(/(^|\s)_(\S.*?\S)?_(?=\s|$)/g, (_, p1, p2 = "") => `${p1}${p2}`);
  // Remove inline code backticks
  text = text.replace(/`+/g, "");
  // Collapse multiple spaces
  text = text.replace(/\s{2,}/g, " ");
  return text.trimEnd();
}

function paragraphFromMarkdown(md) {
  const lines = String(md || "").split(/\r?\n/);
  const paras = [];
  for (const line of lines) {
    const cleaned = cleanMarkdownLine(line);
    if (cleaned.trim().length === 0) {
      paras.push(new Paragraph(""));
    } else {
      paras.push(new Paragraph(cleaned));
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

    const titlePara = new Paragraph({
      children: [
        new TextRun({ text: String(title), bold: true, size: Theme.title.size, color: Theme.title.color }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    });

    const sections = [
      {
        properties: {
          type: SectionType.CONTINUOUS,
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
            pageBorders: undefined,
            background: { color: Theme.pastelBg },
          },
        },
        children: [
          titlePara,
          ...chapters.flatMap((ch, idx) => {
            const h1 = new Paragraph({
              children: [
                new TextRun({ text: `Chapter ${idx + 1}: `, color: Theme.h1.color, size: Theme.h1.size, bold: true }),
                new TextRun({ text: String(ch.title || "Untitled"), color: Theme.h1.color, size: Theme.h1.size }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 200 },
            });
            const subhead = new Paragraph({
              children: [new TextRun({ text: "Key Points", color: Theme.h2.color, size: Theme.h2.size, bold: true })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 120, after: 120 },
            });
            const summaryParas = Array.isArray(ch.summary)
              ? ch.summary.map((s) => new Paragraph({ text: String(s), spacing: { after: 60 } }))
              : [];
            const contentHeader = new Paragraph({
              children: [new TextRun({ text: "Chapter Content", color: Theme.h2.color, size: Theme.h2.size, bold: true })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 160, after: 100 },
            });
            const contentParas = paragraphFromMarkdown(ch.content || "");
            return [h1, subhead, ...summaryParas, contentHeader, ...contentParas];
          }),
        ],
      },
    ];

    const doc = new Document({ sections });

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
