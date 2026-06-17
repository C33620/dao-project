"use client";

import { ExecuteActionCard } from "@/components/governance/execute-action-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { ProposalSummary } from "@/types/governance";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ExecutableProposalsListProps = {
  initialProposals: ProposalSummary[];
};

export function ExecutableProposalsList({
  initialProposals,
}: ExecutableProposalsListProps) {
  const [proposals, setProposals] = useState(initialProposals);
  const router = useRouter();

  function handleExecuted(proposalId: string) {
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
                <div className="execution-item__headline">
                  <p className="execution-item__category">
                    {getProposalCategoryLabel(proposal.category)}
                  </p>
                  <h3 className="execution-item__title">{proposal.title}</h3>
                </div>

                <div className="execution-item__status">
                  <StatusBadge
                    label={
                      isCancelProposal
                        ? "Cancellation ready to execute"
                        : "Ready to execute"
                    }
                    tone={isCancelProposal ? "danger" : "success"}
                  />
                </div>
              </div>

              <p className="execution-item__body">{proposal.excerpt}</p>

              <dl className="execution-item__meta">
                <div>
                  <dt>Executable</dt>
                  <dd>{proposal.executableAt ?? "Waiting"}</dd>
                </div>
              </dl>

              <div className="proposal-card__action-slot">
                <ExecuteActionCard
                  proposal={proposal}
                  onExecuted={handleExecuted}
                />
              </div>
            </article>
          );
        })
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            ≣
          </div>
          <h2>Nothing needs execution right now</h2>
          <p>
            Only proposals that are fully ready for execution appear on this
            page.
          </p>
        </div>
      )}
    </div>
  );
}
