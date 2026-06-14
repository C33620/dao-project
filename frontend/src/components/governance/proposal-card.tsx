"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { ProposalSummary, VoteSupport } from "@/types/governance";

type ProposalCardProps = {
  proposal: ProposalSummary;
  onVoteClick?: (proposalId: string, support: VoteSupport) => void;
  hasOptimisticVote?: boolean;
};

export function ProposalCard({
  proposal,
  onVoteClick,
  hasOptimisticVote = false,
}: ProposalCardProps) {
  const isCancelProposal = proposal.kind === "cancel";
  const isActive = proposal.status === "active";
  const hasAlreadyVoted = proposal.hasVoted || hasOptimisticVote;
  const canVote = proposal.actionsLabel === "Vote available";

  const showVotedState = hasAlreadyVoted;
  const showVotingActions = isActive && !hasAlreadyVoted && canVote;
  const showIneligibleMessage = isActive && !hasAlreadyVoted && !canVote;

  const helperText =
    proposal.actionsLabel || "Actions will appear once voting is active.";

  return (
    <article className="proposal-card">
      <div className="proposal-card__top">
        <p
          className={`proposal-card__category${
            isCancelProposal ? " proposal-card__category--cancel" : ""
          }`}
        >
          {isCancelProposal
            ? "Cancel"
            : getProposalCategoryLabel(proposal.category)}
        </p>

        <StatusBadge label={proposal.statusLabel} tone={proposal.statusTone} />

        <div
          className={`proposal-card__content-panel${
            isCancelProposal ? " proposal-card__content-panel--cancel" : ""
          }`}
        >
          <h2 className="proposal-card__title">{proposal.title}</h2>
          <p className="proposal-card__excerpt">{proposal.excerpt}</p>
          {isCancelProposal && proposal.canceledProposalTitle ? (
            <p className="proposal-card__helper proposal-card__helper--cancel-target">
              Targets executed proposal: {proposal.canceledProposalTitle}
            </p>
          ) : null}
        </div>
      </div>

      <dl
        className={`proposal-card__meta${
          isCancelProposal ? " proposal-card__meta--cancel" : ""
        }`}
      >
        <div>
          <dt>Created</dt>
          <dd>{proposal.createdAt}</dd>
        </div>
        <div>
          <dt>Voting ends</dt>
          <dd>{proposal.votingEndsAt ?? "Waiting"}</dd>
        </div>
      </dl>

      <div className="proposal-card__footer">
        {showVotedState ? (
          <button
            type="button"
            className="proposal-card__button proposal-card__button--voted"
            disabled
            aria-disabled="true"
          >
            Voted
          </button>
        ) : showVotingActions ? (
          <div className="proposal-card__vote-actions">
            <button
              type="button"
              className="proposal-card__button proposal-card__button--yes"
              onClick={() => onVoteClick?.(proposal.id, "for")}
            >
              Yes
            </button>
            <button
              type="button"
              className="proposal-card__button proposal-card__button--no"
              onClick={() => onVoteClick?.(proposal.id, "against")}
            >
              No
            </button>
          </div>
        ) : showIneligibleMessage ? (
          <p className="proposal-card__helper">
            Not eligible to vote on this proposal.
          </p>
        ) : (
          <p className="proposal-card__helper">{helperText}</p>
        )}
      </div>
    </article>
  );
}
