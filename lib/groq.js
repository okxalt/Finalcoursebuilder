import Groq from "groq-sdk";

let groqClient = null;

function getClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "GROQ_API_KEY is not configured. Set it in environment variables."
    );
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export async function chat(messages, options = {}) {
  const {
    model = "llama3-8b-8192",
    temperature = 0.2,
    max_tokens = 2048,
    response_format, // e.g. { type: "json_object" }
  } = options;

  try {
    const client = getClient();
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model,
          temperature,
          max_tokens,
          messages,
          ...(response_format ? { response_format } : {}),
        });

        const content = completion?.choices?.[0]?.message?.content ?? "";
        return typeof content === "string" ? content : String(content ?? "");
      } catch (inner) {
        lastError = normalizeGroqError(inner);
        const msg = (lastError?.message || "").toLowerCase();
        const transient =
          msg.includes("fetch failed") ||
          msg.includes("connection") ||
          msg.includes("timeout") ||
          msg.includes("getaddrinfo") ||
          msg.includes("reset") ||
          msg.includes("refused");
        if (attempt < 2 && transient) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError || new Error("Unknown Groq error");
  } catch (err) {
    throw normalizeGroqError(err);
  }
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

export function normalizeGroqError(error) {
  const message = (error && error.message) || String(error || "") || "Unknown error";
  const lower = message.toLowerCase();
  if (
    lower.includes("fetch failed") ||
    lower.includes("connection error") ||
    lower.includes("enotfound") ||
    lower.includes("ecONNRESET".toLowerCase()) ||
    lower.includes("econrefused") ||
    lower.includes("getaddrinfo")
  ) {
    return new Error(
      "Unable to connect to Groq API. Check GROQ_API_KEY, network access, and try again."
    );
  }
  if (lower.includes("unauthorized") || lower.includes("401")) {
    return new Error("Unauthorized with Groq API. Verify GROQ_API_KEY is valid.");
  }
  return new Error(message);
}
