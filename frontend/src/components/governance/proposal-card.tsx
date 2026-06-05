import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { ProposalSummary } from "@/types/governance";
import Link from "next/link";

type ProposalCardProps = {
  proposal: ProposalSummary;
};

export function ProposalCard({ proposal }: ProposalCardProps) {
  return (
    <article className="proposal-card">
      <div className="proposal-card__top">
        <div className="proposal-card__headline">
          <p className="proposal-card__category">
            {getProposalCategoryLabel(proposal.category)}
          </p>
          <h2 className="proposal-card__title">
            <Link href={`/app/proposals/${proposal.id}`}>{proposal.title}</Link>
          </h2>
          <p className="proposal-card__excerpt">{proposal.excerpt}</p>
        </div>

        <StatusBadge label={proposal.statusLabel} tone={proposal.statusTone} />
      </div>

      <dl className="proposal-card__meta">
        <div>
          <dt>Proposer</dt>
          <dd>{proposal.proposer}</dd>
        </div>
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
        <Link
          href={`/app/proposals/${proposal.id}`}
          className="proposal-card__link"
        >
          Review proposal
        </Link>
      </div>
    </article>
  );
}
