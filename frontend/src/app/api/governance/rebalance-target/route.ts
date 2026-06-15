import { getCurrentUser } from "@/lib/auth";
import { getGovernanceRebalanceSnapshot } from "@/lib/governance/rebalance";
import { NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized." },
    { status: 401 },
  );
}

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorized();
  }

  const snapshot = await getGovernanceRebalanceSnapshot();

  return NextResponse.json({
    ok: true,
    snapshot,
  });
}
