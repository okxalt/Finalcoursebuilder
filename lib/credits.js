import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "credits_token";
const DEFAULT_INITIAL = Number(process.env.INITIAL_CREDITS || 10);

function getSecret() {
  const secret = process.env.CREDITS_SECRET || process.env.GROQ_API_KEY || "dev-secret";
  return String(secret);
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payloadB64) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function parseToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64);
  if (!safeEqual(sig, expected)) return null;
  try {
    const json = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") return null;
    if (typeof data.credits !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

function makeToken(credits) {
  const payload = { v: 1, credits: Math.max(0, Math.floor(credits)), iat: Date.now() };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function getCredits() {
  const cookieStore = cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value || "";
  const parsed = parseToken(raw);
  if (parsed) return parsed.credits;
  return DEFAULT_INITIAL;
}

export function setCredits(newCredits) {
  const cookieStore = cookies();
  const token = makeToken(newCredits);
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return newCredits;
}

export function ensureCredits(cost) {
  const available = getCredits();
  return available >= cost;
}

export function decrementCredits(cost) {
  const available = getCredits();
  const next = Math.max(0, available - Math.max(0, Math.floor(cost)));
  return setCredits(next);
}

export function getCosts() {
  return {
    discover: Number(process.env.CREDITS_COST_DISCOVER || 1),
    outline: Number(process.env.CREDITS_COST_OUTLINE || 1),
    generate: Number(process.env.CREDITS_COST_GENERATE || 1),
    crm: Number(process.env.CREDITS_COST_CRM || 1),
  };
}

export function isDevTopupAllowed() {
  const envFlag = String(process.env.DEV_TOPUP_ENABLED || "").toLowerCase();
  if (envFlag === "1" || envFlag === "true") return true;
  return process.env.NODE_ENV !== "production";
}
