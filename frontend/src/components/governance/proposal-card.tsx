"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { ProposalSummary, VoteSupport } from "@/types/governance";

type ProposalCardProps = {
  proposal: ProposalSummary;
  onVoteClick?: (proposalId: string, support: VoteSupport) => void;
};

export function ProposalCard({ proposal, onVoteClick }: ProposalCardProps) {
  const isActive = proposal.status === "active";
  const hasAlreadyVoted = proposal.hasVoted;
  const canVote = proposal.actionsLabel === "Vote available";

  const showVotedState = hasAlreadyVoted;
  const showVotingActions = isActive && !hasAlreadyVoted && canVote;
  const showIneligibleMessage = isActive && !hasAlreadyVoted && !canVote;

  return (
    <article className="proposal-card">
      <div className="proposal-card__top">
        <div className="proposal-card__headline">
          <p className="proposal-card__category">
            {getProposalCategoryLabel(proposal.category)}
          </p>
          <h2 className="proposal-card__title">{proposal.title}</h2>
          <p className="proposal-card__excerpt">{proposal.excerpt}</p>
        </div>

        <StatusBadge label={proposal.statusLabel} tone={proposal.statusTone} />
      </div>

      <dl className="proposal-card__meta">
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
              className="proposal-card__button proposal-card__button--secondary"
              onClick={() => onVoteClick?.(proposal.id, "against")}
            >
              No
            </button>
            <button
              type="button"
              className="proposal-card__button"
              onClick={() => onVoteClick?.(proposal.id, "for")}
            >
              Yes
            </button>
          </div>
        ) : showIneligibleMessage ? (
          <p className="proposal-card__helper">
            Not eligible to vote on this proposal.
          </p>
        ) : (
          <p className="proposal-card__helper">
            {proposal.actionsLabel ??
              "Actions will appear once voting is active."}
          </p>
        )}
      </div>
    </article>
  );
}
