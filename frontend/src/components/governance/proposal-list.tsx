"use client";

import { ProposalCard } from "@/components/governance/proposal-card";
import { getMagicWalletClient } from "@/lib/web3/magic-wallet-client";
import type { ProposalSummary, VoteSupport } from "@/types/governance";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { createPublicClient, erc20Abi, http } from "viem";
import { sepolia } from "viem/chains";

type ProposalListProps = {
  proposals: ProposalSummary[];
  emptyTitle?: string;
  emptyDescription?: string;
};

type GovernanceFeedbackState = {
  type: "info" | "success" | "error" | null;
  message: string;
};

type GovernanceTargetResponse = {
  ok: boolean;
  snapshot?: {
    userCount: number;
    targetBaseUnits: string;
    targetTokens: string;
    thresholdTokens: string;
    bootstrapTokens: string;
  };
  error?: string;
};

type GovernanceDeficitResponse = {
  ok: boolean;
  queued?: boolean;
  distributionId?: string;
  queueStatus?: string;
  deficitBaseUnits?: string;
  deficitTokens?: string;
  targetBaseUnits?: string;
  targetTokens?: string;
  userCount?: number;
  error?: string;
};

type RebalanceGuard = {
  active: true;
  snapshotBlock: string;
};

const GOVERNANCE_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS;
const MASTER_WALLET_ADDRESS = process.env.NEXT_PUBLIC_MASTER_WALLET_ADDRESS;
const REBALANCE_GUARD_KEY = "governance-rebalance-guard";
const REBALANCE_PENDING_KEY = "governance-rebalance-pending";

function getScopedStorageKey(baseKey: string, walletAddress?: string) {
  return walletAddress ? `${baseKey}:${walletAddress.toLowerCase()}` : baseKey;
}

const ProposalVoteModal = dynamic(
  () =>
    import("@/components/governance/proposal-vote-modal").then(
      (mod) => mod.ProposalVoteModal,
    ),
  {
    ssr: false,
  },
);

function readRebalanceGuard(walletAddress?: string): RebalanceGuard | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(
    getScopedStorageKey(REBALANCE_GUARD_KEY, walletAddress),
  );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RebalanceGuard;
  } catch {
    window.sessionStorage.removeItem(
      getScopedStorageKey(REBALANCE_GUARD_KEY, walletAddress),
    );
    return null;
  }
}

function writeRebalanceGuard(snapshotBlock: string, walletAddress?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const value: RebalanceGuard = {
    active: true,
    snapshotBlock,
  };

  window.sessionStorage.setItem(
    getScopedStorageKey(REBALANCE_GUARD_KEY, walletAddress),
    JSON.stringify(value),
  );
}

function clearRebalanceGuard(walletAddress?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(
    getScopedStorageKey(REBALANCE_GUARD_KEY, walletAddress),
  );
}

function markRebalancePending(walletAddress?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    getScopedStorageKey(REBALANCE_PENDING_KEY, walletAddress),
    "true",
  );
}

function hasPendingRebalance(walletAddress?: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.sessionStorage.getItem(
      getScopedStorageKey(REBALANCE_PENDING_KEY, walletAddress),
    ) === "true"
  );
}

function clearPendingRebalance(walletAddress?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(
    getScopedStorageKey(REBALANCE_PENDING_KEY, walletAddress),
  );
}

function getReadableWalletError(
  error: unknown,
  fallback = "We could not verify your governance balance.",
): string {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const maybeError = error as {
    code?: number | string;
    shortMessage?: string;
    message?: string;
    details?: string;
    cause?: unknown;
  };

  const causeMessage =
    typeof maybeError.cause === "object" &&
    maybeError.cause !== null &&
    "message" in maybeError.cause &&
    typeof (maybeError.cause as { message?: unknown }).message === "string"
      ? (maybeError.cause as { message: string }).message
      : "";

  const rawText = [
    maybeError.shortMessage,
    maybeError.message,
    maybeError.details,
    causeMessage,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ")
    .toLowerCase();

  if (
    maybeError.code === 4001 ||
    maybeError.code === "ACTION_REJECTED" ||
    rawText.includes("user rejected") ||
    rawText.includes("user canceled") ||
    rawText.includes("user cancelled") ||
    rawText.includes("action rejected")
  ) {
    return "Action canceled in wallet.";
  }

  if (
    rawText.includes("insufficient funds") ||
    rawText.includes("insufficient balance")
  ) {
    return "Your wallet does not have enough funds to complete this action.";
  }

  if (
    rawText.includes("wrong network") ||
    rawText.includes("chain mismatch") ||
    rawText.includes("wallet_switchethereumchain")
  ) {
    return "Please switch your wallet to Sepolia and try again.";
  }

  if (maybeError.shortMessage && maybeError.shortMessage.trim().length > 0) {
    return maybeError.shortMessage;
  }

  return fallback;
}

export function ProposalList({
  proposals,
  emptyTitle = "Nothing to review right now",
  emptyDescription = "When new items are ready for you, they will appear here.",
}: ProposalListProps) {
  const [selectedVoteIntent, setSelectedVoteIntent] = useState<{
    proposalId: string;
    support: VoteSupport;
  } | null>(null);

  const [optimisticallyVotedIds, setOptimisticallyVotedIds] = useState<
    Set<string>
  >(new Set());

  const [governanceFeedback, setGovernanceFeedback] =
    useState<GovernanceFeedbackState>({
      type: null,
      message: "",
    });

  useEffect(() => {
    if (!governanceFeedback.type || !governanceFeedback.message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGovernanceFeedback({ type: null, message: "" });
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [governanceFeedback]);

  const runGovernancePrecheck = useCallback(async () => {
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });

    if (!GOVERNANCE_TOKEN_ADDRESS || !MASTER_WALLET_ADDRESS) {
      throw new Error("Governance token configuration is incomplete.");
    }

    const targetResponse = await fetch("/api/governance/rebalance-target", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });

    const targetData =
      (await targetResponse.json()) as GovernanceTargetResponse;

    if (!targetResponse.ok || !targetData.ok || !targetData.snapshot) {
      throw new Error(
        targetData.error ?? "Could not compute governance balance target.",
      );
    }

    const walletClient = await getMagicWalletClient();
    const [walletAddress] = await walletClient.getAddresses();

    if (!walletAddress) {
      throw new Error("No account available.");
    }

    const balance = await publicClient.readContract({
      address: GOVERNANCE_TOKEN_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    const target = BigInt(targetData.snapshot.targetBaseUnits);

    if (balance > target) {
      const excess = balance - target;

      const hash = await walletClient.writeContract({
        address: GOVERNANCE_TOKEN_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [MASTER_WALLET_ADDRESS as `0x${string}`, excess],
        account: walletAddress,
        chain: sepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      markRebalancePending(walletAddress);

      setGovernanceFeedback({
        type: "success",
        message:
          "Your account is now rebalanced, but you must wait for the next proposal snapshot before voting.",
      });

      return { allowed: false as const };
    }

    if (balance < target) {
      const deficitResponse = await fetch("/api/governance/rebalance-deficit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          currentBalanceBaseUnits: balance.toString(),
        }),
      });

      const deficitData =
        (await deficitResponse.json()) as GovernanceDeficitResponse;

      if (!deficitResponse.ok || !deficitData.ok) {
        throw new Error(
          deficitData.error ?? "Could not queue governance deficit top-up.",
        );
      }

      setGovernanceFeedback({
        type: "info",
        message: deficitData.queued
          ? "A governance top-up has been queued. You can vote after funding completes and a new snapshot is reached."
          : "Your governance balance is below target. Please wait for funding before voting.",
      });

      return { allowed: false as const };
    }

    return { allowed: true as const };
  }, []);

  const handleVoteClick = useCallback(
    async (proposalId: string, support: VoteSupport) => {
      setGovernanceFeedback({ type: null, message: "" });

      try {
        const precheck = await runGovernancePrecheck();

        if (!precheck.allowed) {
          return;
        }
      } catch (error) {
        const message = getReadableWalletError(
          error,
          "We could not verify your governance balance.",
        );

        setGovernanceFeedback({
          type: message === "Action canceled in wallet." ? "info" : "error",
          message,
        });
        return;
      }

      setSelectedVoteIntent({ proposalId, support });
    },
    [runGovernancePrecheck],
  );

  const handleCloseModal = useCallback(() => {
    setSelectedVoteIntent(null);
  }, []);

  const handleVoteSuccess = useCallback((proposalId: string) => {
    setOptimisticallyVotedIds((current) => {
      const next = new Set(current);
      next.add(proposalId);
      return next;
    });
    setSelectedVoteIntent(null);
  }, []);

  const handleGovernanceFeedback = useCallback(
    (value: GovernanceFeedbackState) => {
      setGovernanceFeedback(value);
    },
    [],
  );

  if (proposals.length === 0) {
    return (
      <div className="grid place-items-center gap-[0.6rem] min-h-60 p-8 text-center bg-white/90 border border-dashed border-(--border-strong) rounded-md">
        <div
          className="w-12 h-12 grid place-items-center rounded-full bg-(--surface-subtle) text-(--muted-soft) text-[1.4rem]"
          aria-hidden="true"
        >
          ≣
        </div>
        <h2 className="m-0 text-[1.1rem] tracking-[-0.02em]">{emptyTitle}</h2>
        <p className="m-0 text-(--muted) max-w-[44ch] leading-[1.6]">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <>
      <section
        className="proposal-list-section"
        aria-labelledby="proposal-list-title"
      >
        <div className="proposal-list-section__header">
          <h2 id="proposal-list-title" className="proposal-list-section__title">
            Proposals to vote for
          </h2>
        </div>

        {governanceFeedback.type ? (
          <div
            className={
              governanceFeedback.type === "success"
                ? "inline-flex items-center gap-[0.45rem] min-h-7 px-[0.62rem] py-[0.32rem] rounded-full border text-[0.72rem] font-bold tracking-[0.01em] whitespace-nowrap text-(--success) bg-[#edf7f1] border-[#d5e9dc] fixed top-28 z-25 w-full sm:w-fit max-w-[min(100%,42rem)] mb-2"
                : governanceFeedback.type === "info"
                ? "inline-flex items-center gap-[0.45rem] min-h-7 px-[0.62rem] py-[0.32rem] rounded-full border text-[0.72rem] font-bold tracking-[0.01em] whitespace-nowrap text-(--info) bg-[#eef5fc] border-[#d9e6f5] fixed top-28 z-25 w-full sm:w-fit max-w-[min(100%,42rem)] mb-2"
                : "inline-flex items-center gap-[0.45rem] min-h-7 px-[0.62rem] py-[0.32rem] rounded-full border text-[0.72rem] font-bold tracking-[0.01em] whitespace-nowrap text-(--danger) bg-[#faedf1] border-[#efd6dd] fixed top-28 z-25 w-full sm:w-fit max-w-[min(100%,42rem)] mb-2"
            }
            role="status"
            aria-live="polite"
          >
            <span className="w-[0.42rem] h-[0.42rem] rounded-full bg-current opacity-[0.72] flex-none" />
            <span className="leading-[1.35] whitespace-normal">
              {governanceFeedback.message}
            </span>
          </div>
        ) : null}

        <div className="grid gap-4">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onVoteClick={handleVoteClick}
              hasOptimisticVote={optimisticallyVotedIds.has(proposal.id)}
            />
          ))}
        </div>
      </section>

      {selectedVoteIntent ? (
        <ProposalVoteModal
          proposalId={selectedVoteIntent.proposalId}
          support={selectedVoteIntent.support}
          onClose={handleCloseModal}
          onVoteSuccess={handleVoteSuccess}
          onGovernanceFeedback={handleGovernanceFeedback}
          hasPendingRebalance={hasPendingRebalance}
          writeRebalanceGuard={writeRebalanceGuard}
          clearPendingRebalance={clearPendingRebalance}
          readRebalanceGuard={readRebalanceGuard}
          clearRebalanceGuard={clearRebalanceGuard}
        />
      ) : null}
    </>
  );
}
