import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  computeGovernanceTargetBaseUnits,
  formatUnits18,
  getEligibleGovernanceUserCount,
} from "@/lib/governance/rebalance";
import { queueGovernanceRebalanceTopUpForUser } from "@/lib/treasury/distribute";
import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized." },
    { status: 401 },
  );
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

type Body = {
  currentBalanceBaseUnits?: string;
};

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorized();
  }

  const body = (await request.json()) as Body;
  const currentBalanceBaseUnits = body.currentBalanceBaseUnits?.trim();

  if (!currentBalanceBaseUnits || !/^\d+$/.test(currentBalanceBaseUnits)) {
    return badRequest("currentBalanceBaseUnits must be an integer string.");
  }

  const user = await db.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      issuer: true,
      normalizedEmail: true,
      walletAddress: true,
      role: true,
    },
  });

  if (!user || !user.walletAddress || !user.issuer) {
    return badRequest("Current user is missing treasury identity fields.");
  }

  if (user.role === "VIEWER") {
    return badRequest(
      "Viewer accounts are not eligible for governance token top-ups.",
    );
  }

  const userCount = await getEligibleGovernanceUserCount();
  const targetBaseUnits = computeGovernanceTargetBaseUnits(userCount);
  const currentBalance = BigInt(currentBalanceBaseUnits);

  if (currentBalance >= targetBaseUnits) {
    return NextResponse.json({
      ok: true,
      queued: false,
      reason: "no_deficit",
      targetBaseUnits: targetBaseUnits.toString(),
      targetTokens: formatUnits18(targetBaseUnits),
    });
  }

  const deficit = targetBaseUnits - currentBalance;

  const result = await queueGovernanceRebalanceTopUpForUser({
    userId: user.id,
    normalizedEmail: user.normalizedEmail,
    issuer: user.issuer,
    walletAddress: user.walletAddress,
    amountBaseUnits: deficit.toString(),
  });

  return NextResponse.json({
    ok: true,
    queued: true,
    distributionId: result.distributionId,
    queueStatus: result.status,
    deficitBaseUnits: deficit.toString(),
    deficitTokens: formatUnits18(deficit),
    targetBaseUnits: targetBaseUnits.toString(),
    targetTokens: formatUnits18(targetBaseUnits),
    userCount,
  });
}
