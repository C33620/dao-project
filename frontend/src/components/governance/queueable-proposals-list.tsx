"use client";

import { QueueActionCard } from "@/components/governance/queue-action-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { ProposalSummary } from "@/types/governance";
import { useRouter } from "next/navigation";
import { useState } from "react";

type QueueableProposalsListProps = {
  initialProposals: ProposalSummary[];
};

export function QueueableProposalsList({
  initialProposals,
}: QueueableProposalsListProps) {
  const [proposals, setProposals] = useState(initialProposals);
  const router = useRouter();

  function handleQueued(proposalId: string) {
    setProposals((current) =>
      current.filter((proposal) => proposal.id !== proposalId),
    );

    router.refresh();
  }

  return (
    <div className="execution-list">
      {proposals.length > 0 ? (
        proposals.map((proposal) => {
          const isCancelProposal = proposal.kind === "cancel";

          return (
            <article
              key={proposal.id}
              className="execution-item execution-item--stacked"
              style={
                isCancelProposal
                  ? {
                      borderColor: "rgba(185, 48, 72, 0.24)",
                      background: "rgba(250, 237, 241, 0.62)",
                    }
                  : undefined
              }
            >
              <div className="execution-item__topline">
                <div>
                  <p className="execution-item__category">
                    {getProposalCategoryLabel(proposal.category)}
                  </p>
                  <h3 className="execution-item__title">{proposal.title}</h3>
                </div>

                {isCancelProposal ? (
                  <StatusBadge label="Cancellation proposal" tone="danger" />
                ) : null}
              </div>

              <p className="execution-item__body">{proposal.excerpt}</p>

              <dl className="execution-item__meta">
                <div>
                  <dt>Voting ended</dt>
                  <dd>{proposal.votingEndsAt ?? "—"}</dd>
                </div>
              </dl>

              <div className="proposal-card__action-slot">
                <QueueActionCard proposal={proposal} onQueued={handleQueued} />
              </div>
            </article>
          );
        })
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            ≣
          </div>
          <h2>No proposals awaiting queue</h2>
          <p>
            Proposals that have passed the vote and need to be queued will
            appear here.
          </p>
        </div>
      )}
    </div>
  );
}
