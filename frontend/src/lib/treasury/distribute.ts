import "server-only";

import { db } from "@/lib/db";
import { writeTreasuryAuditEvent } from "@/lib/treasury/audit";
import {
  AccountSetupStatus,
  TreasuryAuditEventType,
  TreasuryDistributionKind,
  TreasuryDistributionStatus,
} from "@prisma/client";

const DISTRIBUTION_KIND = TreasuryDistributionKind.INITIAL_ALLOCATION;

type QueueInitialAllocationInput = {
  userId: string;
  normalizedEmail: string;
  issuer: string;
  walletAddress: string;
};

export async function queueInitialAllocationForUser(
  input: QueueInitialAllocationInput,
) {
  const tokenAddress = process.env.GOVERNANCE_TOKEN_ADDRESS;
  const chainId = Number(process.env.TREASURY_CHAIN_ID ?? 11155111);
  const amountBaseUnits = process.env.TREASURY_INITIAL_ALLOCATION_BASE_UNITS;
  const distributionPaused =
    String(process.env.TREASURY_DISTRIBUTION_PAUSED ?? "false") === "true";

  if (!tokenAddress || !amountBaseUnits) {
    throw new Error(
      "Treasury queue configuration is incomplete. Missing token address or base-unit amount.",
    );
  }

  const idempotencyKey = `initial-allocation:${input.userId}`;

  const existing = await db.treasuryDistribution.findUnique({
    where: {
      userId_kind: {
        userId: input.userId,
        kind: DISTRIBUTION_KIND,
      },
    },
  });

  if (existing?.status === TreasuryDistributionStatus.SUCCEEDED) {
    await writeTreasuryAuditEvent({
      userId: input.userId,
      type: TreasuryAuditEventType.INITIAL_ALLOCATION_BLOCKED_ALREADY_FUNDED,
      normalizedEmail: input.normalizedEmail,
      issuer: input.issuer,
      walletAddress: input.walletAddress,
      kind: DISTRIBUTION_KIND,
      amountBaseUnits: existing.amountBaseUnits,
      tokenAddress: existing.tokenAddress,
      chainId: existing.chainId,
      txHash: existing.txHash ?? undefined,
      idempotencyKey,
    });

    await db.user.update({
      where: { id: input.userId },
      data: {
        initialAllocationStatus: TreasuryDistributionStatus.SUCCEEDED,
        initialAllocationAt: existing.confirmedAt ?? existing.updatedAt,
        initialAllocationTxHash: existing.txHash ?? undefined,
        accountSetupStatus: AccountSetupStatus.READY,
        accountSetupUpdatedAt: new Date(),
      },
    });

    return {
      status: "already_funded" as const,
      setupStatus: "ready" as const,
    };
  }

  const nextStatus = distributionPaused
    ? TreasuryDistributionStatus.PAUSED
    : TreasuryDistributionStatus.PENDING;

  const distribution = existing
    ? await db.treasuryDistribution.update({
        where: { id: existing.id },
        data: {
          walletAddress: input.walletAddress,
          tokenAddress,
          chainId,
          amountBaseUnits,
          status: existing.status,
          processedAt: new Date(),
        },
      })
    : await db.treasuryDistribution.create({
        data: {
          userId: input.userId,
          kind: DISTRIBUTION_KIND,
          status: nextStatus,
          amountBaseUnits,
          tokenAddress,
          chainId,
          walletAddress: input.walletAddress,
          idempotencyKey,
          processedAt: new Date(),
        },
      });

  await db.user.update({
    where: { id: input.userId },
    data: {
      initialAllocationStatus:
        distribution.status === TreasuryDistributionStatus.SUCCEEDED
          ? TreasuryDistributionStatus.SUCCEEDED
          : distribution.status === TreasuryDistributionStatus.FAILED_FINAL
          ? TreasuryDistributionStatus.FAILED_FINAL
          : nextStatus,
      initialAllocationTxHash: distribution.txHash ?? undefined,
      accountSetupStatus:
        distribution.status === TreasuryDistributionStatus.SUCCEEDED
          ? AccountSetupStatus.READY
          : distribution.status === TreasuryDistributionStatus.FAILED_FINAL
          ? AccountSetupStatus.NEEDS_ATTENTION
          : AccountSetupStatus.PENDING,
      accountSetupUpdatedAt: new Date(),
    },
  });

  await writeTreasuryAuditEvent({
    userId: input.userId,
    type: TreasuryAuditEventType.INITIAL_ALLOCATION_QUEUED,
    normalizedEmail: input.normalizedEmail,
    issuer: input.issuer,
    walletAddress: input.walletAddress,
    kind: DISTRIBUTION_KIND,
    amountBaseUnits,
    tokenAddress,
    chainId,
    idempotencyKey,
    metadata: {
      mode: "manual-metamask-approval",
      paused: distributionPaused,
    },
  });

  if (distributionPaused) {
    await writeTreasuryAuditEvent({
      userId: input.userId,
      type: TreasuryAuditEventType.INITIAL_ALLOCATION_BLOCKED_PAUSED,
      normalizedEmail: input.normalizedEmail,
      issuer: input.issuer,
      walletAddress: input.walletAddress,
      kind: DISTRIBUTION_KIND,
      amountBaseUnits,
      tokenAddress,
      chainId,
      idempotencyKey,
    });

    return {
      status: "paused" as const,
      setupStatus: "finalizing" as const,
    };
  }

  return {
    status: "queued" as const,
    setupStatus: "finalizing" as const,
    distributionId: distribution.id,
  };
}

export async function markInitialAllocationSubmitted(input: {
  distributionId: string;
  adminUserId: string;
  txHash: string;
}) {
  const distribution = await db.treasuryDistribution.findUnique({
    where: { id: input.distributionId },
    include: {
      user: {
        select: {
          id: true,
          issuer: true,
          normalizedEmail: true,
          walletAddress: true,
        },
      },
    },
  });

  if (!distribution) {
    throw new Error("DISTRIBUTION_NOT_FOUND");
  }

  if (
    distribution.status !== TreasuryDistributionStatus.PENDING &&
    distribution.status !== TreasuryDistributionStatus.PROCESSING &&
    distribution.status !== TreasuryDistributionStatus.FAILED_RETRYABLE &&
    distribution.status !== TreasuryDistributionStatus.PAUSED
  ) {
    throw new Error("DISTRIBUTION_NOT_SUBMITTABLE");
  }

  const updated = await db.treasuryDistribution.update({
    where: { id: distribution.id },
    data: {
      status: TreasuryDistributionStatus.SUBMITTED,
      txHash: input.txHash,
      submittedAt: new Date(),
      processedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  await db.user.update({
    where: { id: distribution.userId },
    data: {
      initialAllocationStatus: TreasuryDistributionStatus.SUBMITTED,
      initialAllocationTxHash: input.txHash,
      accountSetupStatus: AccountSetupStatus.PENDING,
      accountSetupUpdatedAt: new Date(),
    },
  });

  await writeTreasuryAuditEvent({
    userId: distribution.userId,
    type: TreasuryAuditEventType.INITIAL_ALLOCATION_SUBMITTED,
    actor: input.adminUserId,
    normalizedEmail: distribution.user.normalizedEmail,
    issuer: distribution.user.issuer ?? undefined,
    walletAddress: distribution.walletAddress,
    kind: distribution.kind,
    amountBaseUnits: distribution.amountBaseUnits,
    tokenAddress: distribution.tokenAddress,
    chainId: distribution.chainId,
    txHash: input.txHash,
    idempotencyKey: distribution.idempotencyKey,
    metadata: {
      mode: "manual-metamask-approval",
    },
  });

  return updated;
}

export async function reconcileTreasuryDistributions() {
  const { JsonRpcProvider } = await import("ethers");

  const rpcUrl = process.env.TREASURY_RPC_URL;
  const chainId = Number(process.env.TREASURY_CHAIN_ID ?? 11155111);

  if (!rpcUrl) {
    throw new Error("TREASURY_RPC_URL is not configured.");
  }

  const provider = new JsonRpcProvider(rpcUrl, chainId);

  const rows = await db.treasuryDistribution.findMany({
    where: {
      status: TreasuryDistributionStatus.SUBMITTED,
      txHash: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          issuer: true,
          normalizedEmail: true,
          walletAddress: true,
        },
      },
    },
  });

  for (const row of rows) {
    if (!row.txHash) {
      continue;
    }

    try {
      const receipt = await provider.getTransactionReceipt(row.txHash);

      if (!receipt) {
        continue;
      }

      if (receipt.status === 1) {
        const confirmedAt = new Date();

        await db.treasuryDistribution.update({
          where: { id: row.id },
          data: {
            status: TreasuryDistributionStatus.SUCCEEDED,
            confirmedAt,
            processedAt: confirmedAt,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });

        await db.user.update({
          where: { id: row.userId },
          data: {
            initialAllocationStatus: TreasuryDistributionStatus.SUCCEEDED,
            initialAllocationAt: confirmedAt,
            initialAllocationTxHash: row.txHash,
            accountSetupStatus: AccountSetupStatus.READY,
            accountSetupUpdatedAt: confirmedAt,
          },
        });

        await writeTreasuryAuditEvent({
          userId: row.userId,
          type: TreasuryAuditEventType.INITIAL_ALLOCATION_CONFIRMED,
          normalizedEmail: row.user.normalizedEmail,
          issuer: row.user.issuer ?? undefined,
          walletAddress: row.walletAddress,
          kind: row.kind,
          amountBaseUnits: row.amountBaseUnits,
          tokenAddress: row.tokenAddress,
          chainId: row.chainId,
          txHash: row.txHash,
          idempotencyKey: row.idempotencyKey,
        });

        continue;
      }

      await db.treasuryDistribution.update({
        where: { id: row.id },
        data: {
          status: TreasuryDistributionStatus.FAILED_RETRYABLE,
          processedAt: new Date(),
          lastErrorCode: "ONCHAIN_REVERTED",
          lastErrorMessage: "Submitted treasury transfer reverted on-chain.",
        },
      });

      await db.user.update({
        where: { id: row.userId },
        data: {
          initialAllocationStatus: TreasuryDistributionStatus.FAILED_RETRYABLE,
          accountSetupStatus: AccountSetupStatus.PENDING,
          accountSetupUpdatedAt: new Date(),
        },
      });

      await writeTreasuryAuditEvent({
        userId: row.userId,
        type: TreasuryAuditEventType.INITIAL_ALLOCATION_FAILED,
        normalizedEmail: row.user.normalizedEmail,
        issuer: row.user.issuer ?? undefined,
        walletAddress: row.walletAddress,
        kind: row.kind,
        amountBaseUnits: row.amountBaseUnits,
        tokenAddress: row.tokenAddress,
        chainId: row.chainId,
        txHash: row.txHash,
        idempotencyKey: row.idempotencyKey,
        errorCode: "ONCHAIN_REVERTED",
        errorMessage: "Submitted treasury transfer reverted on-chain.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected reconcile failure.";

      await writeTreasuryAuditEvent({
        userId: row.userId,
        type: TreasuryAuditEventType.INITIAL_ALLOCATION_FAILED,
        normalizedEmail: row.user.normalizedEmail,
        issuer: row.user.issuer ?? undefined,
        walletAddress: row.walletAddress,
        kind: row.kind,
        amountBaseUnits: row.amountBaseUnits,
        tokenAddress: row.tokenAddress,
        chainId: row.chainId,
        txHash: row.txHash,
        idempotencyKey: row.idempotencyKey,
        errorCode: "RECONCILE_ERROR",
        errorMessage: message.slice(0, 500),
      });
    }
  }
}
