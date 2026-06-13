import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TreasuryDistributionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  if (user.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "Forbidden." },
      { status: 403 },
    );
  }

  const count = await db.treasuryDistribution.count({
    where: {
      status: {
        in: [
          TreasuryDistributionStatus.PENDING,
          TreasuryDistributionStatus.FAILED_RETRYABLE,
          TreasuryDistributionStatus.PAUSED,
        ],
      },
    },
  });

  return NextResponse.json({
    ok: true,
    count,
  });
}
