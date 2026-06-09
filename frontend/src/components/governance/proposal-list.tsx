"use client";

import { ProposalCard } from "@/components/governance/proposal-card";
import { VoteActionCard } from "@/components/governance/vote-action-card";
import type {
  ProposalActionState,
  ProposalDetail,
  ProposalSummary,
  VoteSupport,
} from "@/types/governance";
import { useEffect, useRef, useState } from "react";

type ProposalListProps = {
  proposals: ProposalSummary[];
  emptyTitle?: string;
  emptyDescription?: string;
};

type VoteFlowResponse = {
  proposal: ProposalDetail;
  actionState: ProposalActionState;
};

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
  const [preselectedSupport, setPreselectedSupport] =
    useState<VoteSupport | null>(null);
  const [isLoadingVoteFlow, setIsLoadingVoteFlow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  async function handleVoteClick(proposalId: string, support: VoteSupport) {
    setIsModalOpen(true);
    setIsLoadingVoteFlow(true);
    setLoadError(null);
    setPreselectedSupport(support);
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
    setPreselectedSupport(null);
    setLoadError(null);
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

        <div className="proposal-list">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onVoteClick={handleVoteClick}
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
                key={`${selectedProposal.id}-${preselectedSupport ?? "none"}`}
                proposal={selectedProposal}
                initialActionState={selectedActionState}
                onVoteSuccess={closeModal}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
