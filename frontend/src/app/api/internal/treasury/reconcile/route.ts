import { reconcileTreasuryDistributions } from "@/lib/treasury/distribute";
import { NextRequest, NextResponse } from "next/server";
import "server-only";

function buildUnauthorizedResponse() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized." },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TREASURY_INTERNAL_RECONCILE_SECRET;
  const providedSecret = request.headers.get("x-internal-reconcile-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return buildUnauthorizedResponse();
  }

  await reconcileTreasuryDistributions();

  return NextResponse.json({ ok: true });
}
