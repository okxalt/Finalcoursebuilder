import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "GROQ_API_KEY is not set. API routes will fail until it is configured."
  );
}

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function chat(messages, options = {}) {
  const {
    model = "llama3-8b-8192",
    temperature = 0.2,
    max_tokens = 2048,
  } = options;

  const completion = await groq.chat.completions.create({
    model,
    temperature,
    max_tokens,
    messages,
  });

  const content = completion?.choices?.[0]?.message?.content ?? "";
  return typeof content === "string" ? content : String(content ?? "");
}

export function extractJsonArray(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try {
      const parsed = JSON.parse(slice);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  throw new Error("Failed to parse JSON array from model response");
}

export function extractJsonObject(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (_) {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try {
      const parsed = JSON.parse(slice);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_) {}
  }
  throw new Error("Failed to parse JSON object from model response");
}
