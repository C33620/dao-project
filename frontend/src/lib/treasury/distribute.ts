import "server-only";

import { getBlockchainClient } from "@/lib/blockchain/client";
import { db } from "@/lib/db";
import { writeTreasuryAuditEvent } from "@/lib/treasury/audit";
import {
  AccountSetupStatus,
  TreasuryAuditEventType,
  TreasuryDistributionKind,
  TreasuryDistributionStatus,
} from "@prisma/client";
import type { Address } from "viem";

const INITIAL_ALLOCATION_KIND = TreasuryDistributionKind.INITIAL_ALLOCATION;
const INITIAL_GAS_FUNDING_KIND = TreasuryDistributionKind.INITIAL_GAS_FUNDING;
const LOW_BALANCE_GAS_REFILL_KIND =
  TreasuryDistributionKind.LOW_BALANCE_GAS_REFILL;

const REQUIRED_SETUP_KINDS = [
  INITIAL_ALLOCATION_KIND,
  INITIAL_GAS_FUNDING_KIND,
] as const;

type QueueInitialFundingInput = {
  userId: string;
  normalizedEmail: string;
  issuer: string;
  walletAddress: string;
};

type DistributionConfig = {
  kind: TreasuryDistributionKind;
  amountBaseUnits: string;
  tokenAddress?: string | null;
  queuedEvent: TreasuryAuditEventType;
  blockedPausedEvent: TreasuryAuditEventType;
  blockedAlreadyFundedEvent: TreasuryAuditEventType;
  submittedEvent: TreasuryAuditEventType;
  confirmedEvent: TreasuryAuditEventType;
  failedEvent: TreasuryAuditEventType;
  idempotencyKey: string;
};

function getTreasuryChainId() {
  return Number(process.env.TREASURY_CHAIN_ID ?? 11155111);
}

function isDistributionPaused() {
  return String(process.env.TREASURY_DISTRIBUTION_PAUSED ?? "false") === "true";
}

function getRequiredDistributionConfigs(userId: string): DistributionConfig[] {
  const tokenAddress = process.env.GOVERNANCE_TOKEN_ADDRESS;
  const allocationAmountBaseUnits =
    process.env.TREASURY_INITIAL_ALLOCATION_BASE_UNITS;
  const gasAmountBaseUnits = process.env.TREASURY_INITIAL_GAS_FUNDING_WEI;

  if (!tokenAddress || !allocationAmountBaseUnits || !gasAmountBaseUnits) {
    throw new Error(
      "Treasury queue configuration is incomplete. Missing token address, token amount, or gas amount.",
    );
  }

  return [
    {
      kind: INITIAL_ALLOCATION_KIND,
      amountBaseUnits: allocationAmountBaseUnits,
      tokenAddress,
      queuedEvent: TreasuryAuditEventType.INITIAL_ALLOCATION_QUEUED,
      blockedPausedEvent:
        TreasuryAuditEventType.INITIAL_ALLOCATION_BLOCKED_PAUSED,
      blockedAlreadyFundedEvent:
        TreasuryAuditEventType.INITIAL_ALLOCATION_BLOCKED_ALREADY_FUNDED,
      submittedEvent: TreasuryAuditEventType.INITIAL_ALLOCATION_SUBMITTED,
      confirmedEvent: TreasuryAuditEventType.INITIAL_ALLOCATION_CONFIRMED,
      failedEvent: TreasuryAuditEventType.INITIAL_ALLOCATION_FAILED,
      idempotencyKey: `initial-allocation:${userId}`,
    },
    {
      kind: INITIAL_GAS_FUNDING_KIND,
      amountBaseUnits: gasAmountBaseUnits,
      tokenAddress: null,
      queuedEvent: TreasuryAuditEventType.INITIAL_GAS_FUNDING_QUEUED,
      blockedPausedEvent:
        TreasuryAuditEventType.INITIAL_GAS_FUNDING_BLOCKED_PAUSED,
      blockedAlreadyFundedEvent:
        TreasuryAuditEventType.INITIAL_GAS_FUNDING_BLOCKED_ALREADY_FUNDED,
      submittedEvent: TreasuryAuditEventType.INITIAL_GAS_FUNDING_SUBMITTED,
      confirmedEvent: TreasuryAuditEventType.INITIAL_GAS_FUNDING_CONFIRMED,
      failedEvent: TreasuryAuditEventType.INITIAL_GAS_FUNDING_FAILED,
      idempotencyKey: `initial-gas-funding:${userId}`,
    },
  ];
}

function getLowBalanceGasRefillConfig(userId: string): DistributionConfig {
  const gasRefillAmountBaseUnits = process.env.TREASURY_LOW_BALANCE_REFILL_WEI;

  if (!gasRefillAmountBaseUnits) {
    throw new Error("TREASURY_LOW_BALANCE_REFILL_WEI is not configured.");
  }

  return {
    kind: LOW_BALANCE_GAS_REFILL_KIND,
    amountBaseUnits: gasRefillAmountBaseUnits,
    tokenAddress: null,
    queuedEvent: TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_QUEUED,
    blockedPausedEvent:
      TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_BLOCKED_PAUSED,
    blockedAlreadyFundedEvent:
      TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_BLOCKED_ALREADY_FUNDED,
    submittedEvent: TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_SUBMITTED,
    confirmedEvent: TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_CONFIRMED,
    failedEvent: TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_FAILED,
    idempotencyKey: `low-balance-gas-refill:${userId}`,
  };
}

function getLowBalanceThresholdWei() {
  const value = process.env.TREASURY_LOW_BALANCE_THRESHOLD_WEI;

  if (!value) {
    throw new Error("TREASURY_LOW_BALANCE_THRESHOLD_WEI is not configured.");
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(
      "TREASURY_LOW_BALANCE_THRESHOLD_WEI must be an integer string.",
    );
  }

  return BigInt(value);
}

async function recomputeUserTreasurySetup(userId: string) {
  const rows = await db.treasuryDistribution.findMany({
    where: {
      userId,
      kind: { in: [...REQUIRED_SETUP_KINDS] },
    },
    select: {
      kind: true,
      status: true,
      txHash: true,
      confirmedAt: true,
      updatedAt: true,
    },
  });

  const byKind = new Map(rows.map((row) => [row.kind, row]));
  const allocation = byKind.get(INITIAL_ALLOCATION_KIND);
  const gasFunding = byKind.get(INITIAL_GAS_FUNDING_KIND);

  const hasAllRequired = REQUIRED_SETUP_KINDS.every((kind) => byKind.has(kind));

  const anyNeedsAttention = rows.some(
    (row) =>
      row.status === TreasuryDistributionStatus.FAILED_FINAL ||
      row.status === TreasuryDistributionStatus.PAUSED,
  );

  const allSucceeded =
    hasAllRequired &&
    REQUIRED_SETUP_KINDS.every(
      (kind) =>
        byKind.get(kind)?.status === TreasuryDistributionStatus.SUCCEEDED,
    );

  const accountSetupStatus = allSucceeded
    ? AccountSetupStatus.READY
    : anyNeedsAttention
    ? AccountSetupStatus.NEEDS_ATTENTION
    : AccountSetupStatus.PENDING;

  await db.user.update({
    where: { id: userId },
    data: {
      initialAllocationStatus: allocation?.status ?? null,
      initialAllocationAt:
        allocation?.status === TreasuryDistributionStatus.SUCCEEDED
          ? allocation.confirmedAt ?? allocation.updatedAt
          : null,
      initialAllocationTxHash: allocation?.txHash ?? null,
      accountSetupStatus,
      accountSetupUpdatedAt: new Date(),
    },
  });

  return {
    accountSetupStatus,
    allocationStatus: allocation?.status ?? null,
    gasFundingStatus: gasFunding?.status ?? null,
  };
}

async function queueSingleDistributionForUser(
  input: QueueInitialFundingInput,
  config: DistributionConfig,
) {
  const chainId = getTreasuryChainId();
  const distributionPaused = isDistributionPaused();

  const existing = await db.treasuryDistribution.findUnique({
    where: {
      userId_kind: {
        userId: input.userId,
        kind: config.kind,
      },
    },
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

  if (
    existing?.status === TreasuryDistributionStatus.SUCCEEDED &&
    config.kind !== LOW_BALANCE_GAS_REFILL_KIND
  ) {
    await writeTreasuryAuditEvent({
      userId: input.userId,
      type: config.blockedAlreadyFundedEvent,
      normalizedEmail: input.normalizedEmail,
      issuer: input.issuer,
      walletAddress: input.walletAddress,
      kind: config.kind,
      amountBaseUnits: existing.amountBaseUnits,
      tokenAddress: existing.tokenAddress ?? undefined,
      chainId: existing.chainId,
      txHash: existing.txHash ?? undefined,
      idempotencyKey: config.idempotencyKey,
    });

    return {
      status: "already_funded" as const,
      distribution: existing,
      paused: false,
    };
  }

  const nextStatus = distributionPaused
    ? TreasuryDistributionStatus.PAUSED
    : TreasuryDistributionStatus.PENDING;

  const distribution = existing
    ? await db.treasuryDistribution.update({
        where: { id: existing.id },
        data: {
          status:
            existing.status === TreasuryDistributionStatus.SUBMITTED
              ? existing.status
              : nextStatus,
          walletAddress: input.walletAddress,
          tokenAddress: config.tokenAddress ?? null,
          chainId,
          amountBaseUnits: config.amountBaseUnits,
          processedAt: new Date(),
          submittedAt:
            config.kind === LOW_BALANCE_GAS_REFILL_KIND &&
            existing.status === TreasuryDistributionStatus.SUCCEEDED
              ? null
              : existing.submittedAt,
          confirmedAt:
            config.kind === LOW_BALANCE_GAS_REFILL_KIND &&
            existing.status === TreasuryDistributionStatus.SUCCEEDED
              ? null
              : existing.confirmedAt,
          txHash:
            config.kind === LOW_BALANCE_GAS_REFILL_KIND &&
            existing.status === TreasuryDistributionStatus.SUCCEEDED
              ? null
              : existing.txHash,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      })
    : await db.treasuryDistribution.create({
        data: {
          userId: input.userId,
          kind: config.kind,
          status: nextStatus,
          amountBaseUnits: config.amountBaseUnits,
          tokenAddress: config.tokenAddress ?? null,
          chainId,
          walletAddress: input.walletAddress,
          idempotencyKey: config.idempotencyKey,
          processedAt: new Date(),
        },
      });

  await writeTreasuryAuditEvent({
    userId: input.userId,
    type: config.queuedEvent,
    normalizedEmail: input.normalizedEmail,
    issuer: input.issuer,
    walletAddress: input.walletAddress,
    kind: config.kind,
    amountBaseUnits: config.amountBaseUnits,
    tokenAddress: config.tokenAddress ?? undefined,
    chainId,
    idempotencyKey: config.idempotencyKey,
    metadata: {
      mode: "manual-metamask-approval",
      paused: distributionPaused,
    },
  });

  if (distributionPaused) {
    await writeTreasuryAuditEvent({
      userId: input.userId,
      type: config.blockedPausedEvent,
      normalizedEmail: input.normalizedEmail,
      issuer: input.issuer,
      walletAddress: input.walletAddress,
      kind: config.kind,
      amountBaseUnits: config.amountBaseUnits,
      tokenAddress: config.tokenAddress ?? undefined,
      chainId,
      idempotencyKey: config.idempotencyKey,
    });
  }

  return {
    status: distributionPaused ? ("paused" as const) : ("queued" as const),
    distribution,
    paused: distributionPaused,
  };
}

export async function queueInitialFundingForUser(
  input: QueueInitialFundingInput,
) {
  const configs = getRequiredDistributionConfigs(input.userId);

  const results = [];
  for (const config of configs) {
    const result = await queueSingleDistributionForUser(input, config);
    results.push(result);
  }

  const setup = await recomputeUserTreasurySetup(input.userId);

  if (setup.accountSetupStatus === AccountSetupStatus.READY) {
    return {
      status: "already_funded" as const,
      setupStatus: "ready" as const,
    };
  }

  return {
    status: results.some((result) => result.paused)
      ? ("paused" as const)
      : ("queued" as const),
    setupStatus:
      setup.accountSetupStatus === AccountSetupStatus.NEEDS_ATTENTION
        ? ("needs_attention" as const)
        : ("finalizing" as const),
    distributionIds: results.map((result) => result.distribution.id),
  };
}

export async function queueInitialAllocationForUser(
  input: QueueInitialFundingInput,
) {
  return queueInitialFundingForUser(input);
}

export async function ensureLowBalanceGasRefillForUser(userId: string) {
  console.log("[refill-check] called for userId", userId);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      issuer: true,
      normalizedEmail: true,
      walletAddress: true,
      role: true,
    },
  });

  console.log("[refill-check] user", JSON.stringify(user));

  if (!user || !user.walletAddress || !user.issuer) {
    console.log("[refill-check] skipped - missing user data");
    return { status: "skipped" as const, reason: "missing-user-data" as const };
  }

   if (user.role === "VIEWER") {
     return { status: "skipped" as const, reason: "non-member-role" as const };
   }

  const thresholdWei = getLowBalanceThresholdWei();
  console.log("[refill-check] threshold", thresholdWei.toString());

  const client = getBlockchainClient();
  const balanceWei = await client.getBalance({
    address: user.walletAddress as Address,
  });

  console.log(
    "[refill-check] balance",
    balanceWei.toString(),
    "threshold",
    thresholdWei.toString(),
    "needs refill",
    balanceWei < thresholdWei,
  );

  // ... rest of the function unchanged

  if (balanceWei >= thresholdWei) {
    return {
      status: "not_needed" as const,
      balanceWei: balanceWei.toString(),
      thresholdWei: thresholdWei.toString(),
    };
  }

  const config = getLowBalanceGasRefillConfig(user.id);

  await writeTreasuryAuditEvent({
    userId: user.id,
    type: TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_REQUESTED,
    normalizedEmail: user.normalizedEmail,
    issuer: user.issuer,
    walletAddress: user.walletAddress,
    kind: config.kind,
    amountBaseUnits: config.amountBaseUnits,
    chainId: getTreasuryChainId(),
    idempotencyKey: config.idempotencyKey,
    metadata: {
      thresholdWei: thresholdWei.toString(),
      observedBalanceWei: balanceWei.toString(),
      trigger: "dashboard-login-check",
    },
  });

  const result = await queueSingleDistributionForUser(
    {
      userId: user.id,
      normalizedEmail: user.normalizedEmail,
      issuer: user.issuer,
      walletAddress: user.walletAddress,
    },
    config,
  );

  return {
    status: result.status,
    distributionId: result.distribution.id,
    balanceWei: balanceWei.toString(),
    thresholdWei: thresholdWei.toString(),
  };
}

function getAuditEventConfig(kind: TreasuryDistributionKind) {
  if (kind === INITIAL_GAS_FUNDING_KIND) {
    return {
      submittedEvent: TreasuryAuditEventType.INITIAL_GAS_FUNDING_SUBMITTED,
      confirmedEvent: TreasuryAuditEventType.INITIAL_GAS_FUNDING_CONFIRMED,
      failedEvent: TreasuryAuditEventType.INITIAL_GAS_FUNDING_FAILED,
    };
  }

  if (kind === LOW_BALANCE_GAS_REFILL_KIND) {
    return {
      submittedEvent: TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_SUBMITTED,
      confirmedEvent: TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_CONFIRMED,
      failedEvent: TreasuryAuditEventType.LOW_BALANCE_GAS_REFILL_FAILED,
    };
  }

  return {
    submittedEvent: TreasuryAuditEventType.INITIAL_ALLOCATION_SUBMITTED,
    confirmedEvent: TreasuryAuditEventType.INITIAL_ALLOCATION_CONFIRMED,
    failedEvent: TreasuryAuditEventType.INITIAL_ALLOCATION_FAILED,
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

  await recomputeUserTreasurySetup(distribution.userId);

  const events = getAuditEventConfig(distribution.kind);

  await writeTreasuryAuditEvent({
    userId: distribution.userId,
    type: events.submittedEvent,
    actor: input.adminUserId,
    normalizedEmail: distribution.user.normalizedEmail,
    issuer: distribution.user.issuer ?? undefined,
    walletAddress: distribution.walletAddress,
    kind: distribution.kind,
    amountBaseUnits: distribution.amountBaseUnits,
    tokenAddress: distribution.tokenAddress ?? undefined,
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
  const chainId = getTreasuryChainId();

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

    const events = getAuditEventConfig(row.kind);

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

        await recomputeUserTreasurySetup(row.userId);

        await writeTreasuryAuditEvent({
          userId: row.userId,
          type: events.confirmedEvent,
          normalizedEmail: row.user.normalizedEmail,
          issuer: row.user.issuer ?? undefined,
          walletAddress: row.walletAddress,
          kind: row.kind,
          amountBaseUnits: row.amountBaseUnits,
          tokenAddress: row.tokenAddress ?? undefined,
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

      await recomputeUserTreasurySetup(row.userId);

      await writeTreasuryAuditEvent({
        userId: row.userId,
        type: events.failedEvent,
        normalizedEmail: row.user.normalizedEmail,
        issuer: row.user.issuer ?? undefined,
        walletAddress: row.walletAddress,
        kind: row.kind,
        amountBaseUnits: row.amountBaseUnits,
        tokenAddress: row.tokenAddress ?? undefined,
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
        type: events.failedEvent,
        normalizedEmail: row.user.normalizedEmail,
        issuer: row.user.issuer ?? undefined,
        walletAddress: row.walletAddress,
        kind: row.kind,
        amountBaseUnits: row.amountBaseUnits,
        tokenAddress: row.tokenAddress ?? undefined,
        chainId: row.chainId,
        txHash: row.txHash,
        idempotencyKey: row.idempotencyKey,
        errorCode: "RECONCILE_ERROR",
        errorMessage: message.slice(0, 500),
      });
    }
  }
}
