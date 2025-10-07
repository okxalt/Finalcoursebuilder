import { NextResponse } from "next/server";
import { getCredits, setCredits, isDevTopupAllowed } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ credits: getCredits(), devTopup: isDevTopupAllowed() });
}

export async function POST(request) {
  if (!isDevTopupAllowed()) {
    return NextResponse.json({ error: "Top-up disabled" }, { status: 403 });
  }
  const { amount } = await request.json().catch(() => ({ amount: 0 }));
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const updated = setCredits(getCredits() + n);
  return NextResponse.json({ credits: updated });
}
