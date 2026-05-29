import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
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

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorized();
  }

  if (currentUser.role !== "admin") {
    return forbidden();
  }

  const rows = await db.treasuryDistribution.findMany({
    where: {
      status: {
        in: [
          TreasuryDistributionStatus.PENDING,
          TreasuryDistributionStatus.FAILED_RETRYABLE,
          TreasuryDistributionStatus.PAUSED,
          TreasuryDistributionStatus.SUBMITTED,
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          normalizedEmail: true,
          walletAddress: true,
          accountSetupStatus: true,
          accountSetupUpdatedAt: true,
          initialAllocationStatus: true,
          initialAllocationTxHash: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    items: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      walletAddress: row.walletAddress,
      amountBaseUnits: row.amountBaseUnits,
      tokenAddress: row.tokenAddress,
      chainId: row.chainId,
      txHash: row.txHash,
      submittedAt: row.submittedAt,
      confirmedAt: row.confirmedAt,
      attemptCount: row.attemptCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.user.id,
        displayName: row.user.name,
        email: row.user.normalizedEmail,
        walletAddress: row.user.walletAddress,
        accountSetupStatus: row.user.accountSetupStatus,
        accountSetupUpdatedAt: row.user.accountSetupUpdatedAt,
        initialAllocationStatus: row.user.initialAllocationStatus,
        initialAllocationTxHash: row.user.initialAllocationTxHash,
      },
    })),
  });
}
