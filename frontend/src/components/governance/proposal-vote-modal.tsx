"use client";

import { VoteActionCard } from "@/components/governance/vote-action-card";
import type {
  ProposalActionState,
  ProposalDetail,
  VoteSupport,
} from "@/types/governance";
import { useEffect, useRef, useState } from "react";

type ProposalVoteModalProps = {
  proposalId: string;
  support: VoteSupport;
  onClose: () => void;
  onVoteSuccess: (proposalId: string) => void;
  onGovernanceFeedback: (value: {
    type: "info" | "success" | "error" | null;
    message: string;
  }) => void;
  hasPendingRebalance: () => boolean;
  writeRebalanceGuard: (snapshotBlock: string) => void;
  clearPendingRebalance: () => void;
  readRebalanceGuard: () => {
    active: true;
    snapshotBlock: string;
  } | null;
  clearRebalanceGuard: () => void;
};

type VoteFlowResponse = {
  proposal: ProposalDetail;
  actionState: ProposalActionState;
};

export function ProposalVoteModal({
  proposalId,
  support,
  onClose,
  onVoteSuccess,
  onGovernanceFeedback,
  hasPendingRebalance,
  writeRebalanceGuard,
  clearPendingRebalance,
  readRebalanceGuard,
  clearRebalanceGuard,
}: ProposalVoteModalProps) {
  const [selectedProposal, setSelectedProposal] =
    useState<ProposalDetail | null>(null);
  const [selectedActionState, setSelectedActionState] =
    useState<ProposalActionState | null>(null);
  const [isLoadingVoteFlow, setIsLoadingVoteFlow] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  function handleVoteSuccessAndClose(completedProposalId: string) {
    onVoteSuccess(completedProposalId);
    onClose();
  }

  useEffect(() => {
    let isCancelled = false;

    async function prepareVoteFlow() {
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
            if (!isCancelled) {
              onClose();
              onGovernanceFeedback({
                type: "info",
                message:
                  "Your wallet was rebalanced. You must wait for a proposal with a newer snapshot before voting.",
              });
            }
            return;
          }

          clearRebalanceGuard();
        }

        if (!isCancelled) {
          setSelectedProposal(data.proposal);
          setSelectedActionState({
            ...data.actionState,
            vote: {
              ...data.actionState.vote,
              selectedSupport: support,
            },
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "We could not prepare the voting flow.",
          );
          onGovernanceFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "We could not prepare the voting flow.",
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingVoteFlow(false);
        }
      }
    }

    void prepareVoteFlow();

    return () => {
      isCancelled = true;
    };
  }, [
    clearPendingRebalance,
    clearRebalanceGuard,
    hasPendingRebalance,
    onClose,
    onGovernanceFeedback,
    proposalId,
    readRebalanceGuard,
    support,
    writeRebalanceGuard,
  ]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="proposal-vote-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-vote-modal-title"
      onClick={onClose}
    >
      <div
        className="proposal-vote-modal__surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="proposal-vote-modal__header">
          <div>
            <p className="wallet-status__label">Vote on proposal</p>
            <h2 id="proposal-vote-modal-title" className="proposal-card__title">
              {selectedProposal?.title ?? "Loading proposal"}
            </h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="proposal-card__button proposal-card__button--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {isLoadingVoteFlow ? (
          <div className="action-panel action-panel--interactive">
            <p className="wallet-status__label">Preparing vote</p>
            <p className="wallet-status__value">Loading proposal details...</p>
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
            onVoteSuccess={handleVoteSuccessAndClose}
          />
        ) : null}
      </div>
    </div>
  );
}
