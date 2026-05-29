import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconcileTreasuryDistributions } from "@/lib/treasury/distribute";
import { TreasuryDistributionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized." },
    { status: 401 },
  );
}

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
}

export async function POST() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorized();
  }

  if (currentUser.role !== "admin") {
    return forbidden();
  }

  try {
    const before = await db.treasuryDistribution.count({
      where: {
        status: TreasuryDistributionStatus.SUBMITTED,
        txHash: { not: null },
      },
    });

    await reconcileTreasuryDistributions();

    const remainingSubmitted = await db.treasuryDistribution.count({
      where: {
        status: TreasuryDistributionStatus.SUBMITTED,
        txHash: { not: null },
      },
    });

    return NextResponse.json({
      ok: true,
      summary: {
        processed: before,
        remainingSubmitted,
      },
    });
  } catch (error) {
    console.error("[ADMIN_TREASURY_RECONCILE_ROUTE] POST_ERROR", error);

    return NextResponse.json(
      { ok: false, error: "Could not reconcile treasury distributions." },
      { status: 500 },
    );
  }
}
