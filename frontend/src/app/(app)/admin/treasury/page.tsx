import { TreasuryQueue } from "@/components/admin/treasury-queue";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TreasuryDistributionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

type TreasuryQueueItem = {
  id: string;
  kind: string;
  status: "PENDING" | "FAILED_RETRYABLE" | "PAUSED" | "SUBMITTED" | string;
  walletAddress: string;
  amountBaseUnits: string;
  tokenAddress: string;
  chainId: number;
  txHash: string | null;
  submittedAt: string | Date | null;
  confirmedAt: string | Date | null;
  attemptCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    walletAddress: string | null;
    accountSetupStatus: string;
    accountSetupUpdatedAt: string | Date | null;
    initialAllocationStatus: string | null;
    initialAllocationTxHash: string | null;
  };
};

async function getTreasuryQueue(): Promise<TreasuryQueueItem[]> {
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

  return rows.map((row) => ({
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
  }));
}

export default async function AdminTreasuryPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/auth");
  }

  if (currentUser.role !== "admin") {
    redirect("/");
  }

  const items = await getTreasuryQueue();

  const pendingItems = items.filter((item) =>
    ["PENDING", "FAILED_RETRYABLE", "PAUSED"].includes(item.status),
  );

  const submittedItems = items.filter((item) => item.status === "SUBMITTED");

  return (
    <main className="page-shell">
      <div className="page-shell__header">
        <div className="page-shell__heading">
          <h1>Treasury operations</h1>
          <p>
            Record manual Sepolia treasury sends, review queued allocations, and
            reconcile submitted transfers without changing the current MetaMask
            signing workflow.
          </p>
        </div>
      </div>

      <div className="page-shell__content">
        <TreasuryQueue
          initialPendingItems={pendingItems}
          initialSubmittedItems={submittedItems}
        />
      </div>
    </main>
  );
}
