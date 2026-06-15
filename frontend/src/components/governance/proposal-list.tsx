"use client";

import { ProposalCard } from "@/components/governance/proposal-card";
import { VoteActionCard } from "@/components/governance/vote-action-card";
import { getMagicWalletClient } from "@/lib/web3/magic-wallet-client";
import type {
  ProposalActionState,
  ProposalDetail,
  ProposalSummary,
  VoteSupport,
} from "@/types/governance";
import { useEffect, useRef, useState } from "react";
import { createPublicClient, erc20Abi, http } from "viem";
import { sepolia } from "viem/chains";

type ProposalListProps = {
  proposals: ProposalSummary[];
  emptyTitle?: string;
  emptyDescription?: string;
};

type VoteFlowResponse = {
  proposal: ProposalDetail;
  actionState: ProposalActionState;
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

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

function readRebalanceGuard(): RebalanceGuard | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(REBALANCE_GUARD_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RebalanceGuard;
  } catch {
    window.sessionStorage.removeItem(REBALANCE_GUARD_KEY);
    return null;
  }
}

function writeRebalanceGuard(snapshotBlock: string) {
  if (typeof window === "undefined") {
    return;
  }

  const value: RebalanceGuard = {
    active: true,
    snapshotBlock,
  };

  window.sessionStorage.setItem(REBALANCE_GUARD_KEY, JSON.stringify(value));
}

function clearRebalanceGuard() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(REBALANCE_GUARD_KEY);
}

function markRebalancePending() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(REBALANCE_PENDING_KEY, "true");
}

function hasPendingRebalance() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(REBALANCE_PENDING_KEY) === "true";
}

function clearPendingRebalance() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(REBALANCE_PENDING_KEY);
}

export function ProposalList({
  proposals,
  emptyTitle = "Nothing to review right now",
  emptyDescription = "When new items are ready for you, they will appear here.",
}: ProposalListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] =
    useState<ProposalDetail | null>(null);
  const [selectedActionState, setSelectedActionState] =
    useState<ProposalActionState | null>(null);

  const [isLoadingVoteFlow, setIsLoadingVoteFlow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [optimisticallyVotedIds, setOptimisticallyVotedIds] = useState<
    Set<string>
  >(new Set());
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [governanceFeedback, setGovernanceFeedback] =
    useState<GovernanceFeedbackState>({
      type: null,
      message: "",
    });

  async function runGovernancePrecheck() {
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
      markRebalancePending();

      setGovernanceFeedback({
        type: "success",
        message:
          `Excess governance tokens were returned to the treasury. ` +
          `Your account is now rebalanced, but you must wait for the next proposal snapshot before voting.`,
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
          ? `Your account is below the governance balance target. An admin funding item has been queued. You can vote after the top-up is completed and the next snapshot is reached.`
          : `Your account is below the governance balance target. Please wait for admin funding before voting.`,
      });

      return { allowed: false as const };
    }

    return { allowed: true as const };
  }

  async function handleVoteClick(proposalId: string, support: VoteSupport) {
    setGovernanceFeedback({ type: null, message: "" });

    try {
      const precheck = await runGovernancePrecheck();

      if (!precheck.allowed) {
        return;
      }
    } catch (error) {
      setGovernanceFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not verify your governance balance.",
      });
      return;
    }

    setIsModalOpen(true);
    setIsLoadingVoteFlow(true);
    setLoadError(null);
    setSelectedProposal(null);
    setSelectedActionState(null);

    try {
      const response = await fetch(`/api/proposals/${proposalId}/vote-flow`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load this proposal for voting.");
      }

      const data = (await response.json()) as VoteFlowResponse;

      console.log("vote-flow proposal", data.proposal);
      console.log("snapshotBlock", data.proposal.governance?.snapshotBlock);

      const snapshotBlock = data.proposal.governance?.snapshotBlock;

      if (hasPendingRebalance() && snapshotBlock) {
        writeRebalanceGuard(snapshotBlock);
        clearPendingRebalance();
      }

      const guard = readRebalanceGuard();

      if (guard && snapshotBlock) {
        const currentSnapshot = BigInt(snapshotBlock);
        const blockedUntilAfter = BigInt(guard.snapshotBlock);

        if (currentSnapshot <= blockedUntilAfter) {
          closeModal();
          setGovernanceFeedback({
            type: "info",
            message:
              "Your wallet was rebalanced. You must wait for a proposal with a newer snapshot before voting.",
          });
          return;
        }

        clearRebalanceGuard();
      }

      setSelectedProposal(data.proposal);
      setSelectedActionState({
        ...data.actionState,
        vote: {
          ...data.actionState.vote,
          selectedSupport: support,
        },
      });
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not prepare the voting flow.",
      );
    } finally {
      setIsLoadingVoteFlow(false);
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setSelectedProposal(null);
    setSelectedActionState(null);
    setLoadError(null);
  }

  function handleVoteSuccess(proposalId: string) {
    setOptimisticallyVotedIds((current) => {
      const next = new Set(current);
      next.add(proposalId);
      return next;
    });
    closeModal();
  }

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }

    if (isModalOpen) {
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  if (proposals.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon" aria-hidden="true">
          ≣
        </div>
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
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
                ? "status-badge status-badge--success treasury-page-feedback"
                : governanceFeedback.type === "info"
                ? "status-badge status-badge--info treasury-page-feedback"
                : "status-badge status-badge--danger treasury-page-feedback"
            }
            role="status"
            aria-live="polite"
          >
            <span className="status-badge__dot" />
            <span className="status-badge__label">
              {governanceFeedback.message}
            </span>
          </div>
        ) : null}

        <div className="proposal-list">
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

      {isModalOpen ? (
        <div
          className="proposal-vote-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proposal-vote-modal-title"
          onClick={closeModal}
        >
          <div
            className="proposal-vote-modal__surface"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="proposal-vote-modal__header">
              <div>
                <p className="wallet-status__label">Vote on proposal</p>
                <h2
                  id="proposal-vote-modal-title"
                  className="proposal-card__title"
                >
                  {selectedProposal?.title ?? "Loading proposal"}
                </h2>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                className="proposal-card__button proposal-card__button--secondary"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            {isLoadingVoteFlow ? (
              <div className="action-panel action-panel--interactive">
                <p className="wallet-status__label">Preparing vote</p>
                <p className="wallet-status__value">
                  Loading proposal details...
                </p>
              </div>
            ) : loadError ? (
              <div className="action-panel action-panel--interactive">
                <p className="wallet-status__label">Could not open vote flow</p>
                <p className="wallet-status__value">{loadError}</p>
              </div>
            ) : selectedProposal && selectedActionState ? (
              <VoteActionCard
                proposal={selectedProposal}
                initialActionState={selectedActionState}
                onVoteSuccess={handleVoteSuccess}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
