// Using direct HTTP calls to Groq's OpenAI-compatible API to avoid SDK issues
// Endpoint: https://api.groq.com/openai/v1/chat/completions

export async function chat(messages, options = {}) {
  const {
    model: optionModel,
    temperature = 0.2,
    max_tokens = 2048,
  } = options;

  const modelsToTry = buildModelsToTry(optionModel);

  let lastError = null;
  for (const modelName of modelsToTry) {
    try {
      const content = await chatViaHttp(messages, {
        model: modelName,
        temperature,
        max_tokens,
      });
      return content;
    } catch (e) {
      lastError = e;
      const code = String(e && e.code ? e.code : "");
      const msg = (e?.message || "").toLowerCase();
      const modelUnavailable =
        code === "404" ||
        msg.includes("decommissioned") ||
        msg.includes("not found") ||
        msg.includes("is not supported") ||
        msg.includes("no longer supported") ||
        msg.includes("unknown model");
      if (modelUnavailable) {
        continue; // try next model
      }
      break; // non-model error; surface it
    }
  }
  throw normalizeGroqError(lastError || new Error("All Groq models failed"));
}

function buildModelsToTry(optionModel) {
  const fromEnv = process.env.GROQ_MODEL && process.env.GROQ_MODEL.trim();
  const preferred = optionModel || fromEnv || "llama-3.1-8b-instant";
  const fallbackCsv = process.env.GROQ_FALLBACK_MODELS || "llama-3.1-70b-versatile,mixtral-8x7b-32768";
  const fallbacks = fallbackCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const list = [preferred, ...fallbacks];
  // de-dupe while preserving order
  const seen = new Set();
  const deduped = [];
  for (const m of list) {
    if (!seen.has(m)) {
      seen.add(m);
      deduped.push(m);
    }
  }
  return deduped;
}

async function chatViaHttp(messages, { model, temperature, max_tokens }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("GROQ_API_KEY is not configured. Set it in environment variables.");
  }

  const body = JSON.stringify({ model, temperature, max_tokens, messages });
  const url = "https://api.groq.com/openai/v1/chat/completions";

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        let errorText = await res.text().catch(() => "");
        try {
          const json = JSON.parse(errorText);
          errorText = json?.error?.message || errorText;
        } catch {}
        const err = new Error(errorText || `HTTP ${res.status}`);
        err.code = String(res.status);
        throw err;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      return typeof content === "string" ? content : String(content ?? "");
    } catch (e) {
      lastError = e;
      const code = (e && e.code) ? String(e.code).toUpperCase() : "";
      const msg = (e?.message || "").toLowerCase();
      const transient = code === "ECONNRESET" || code === "ETIMEDOUT" || msg.includes("timeout") || msg.includes("reset");
      if (attempt < 2 && transient) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error("Unknown Groq error");
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
  const code = String(error && error.code ? error.code : "").toUpperCase();
  const network =
    lower.includes("fetch failed") ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT";
  if (network) {
    return new Error(`Network error talking to Groq: ${message}`);
  }
  if (lower.includes("unauthorized") || lower.includes("401")) {
    return new Error("Unauthorized with Groq API. Verify GROQ_API_KEY is valid.");
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return new Error("Rate limited by Groq. Please wait and try again.");
  }
  if (lower.includes("response_format")) {
    return new Error("Groq model does not support response_format; using plain JSON prompt.");
  }
  return new Error(message);
}
