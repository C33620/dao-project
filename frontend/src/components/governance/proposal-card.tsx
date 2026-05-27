import { StatusBadge, StatusTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

export type ProposalCardData = {
  id: string;
  title: string;
  excerpt: string;
  status: string;
  tone?: StatusTone;
  category: string;
  author: string;
  createdAt: string;
  votingWindow: string;
};

type ProposalCardProps = {
  proposal: ProposalCardData;
  className?: string;
};

export function ProposalCard({ proposal, className }: ProposalCardProps) {
  return (
    <article className={cn("proposal-card", className)}>
      <div className="proposal-card__top">
        <StatusBadge
          label={proposal.status}
          tone={proposal.tone ?? "default"}
        />
        <span className="proposal-card__category">{proposal.category}</span>
      </div>

      <div className="proposal-card__body">
        <h3 className="proposal-card__title">
          <Link href={`/app/proposals/${proposal.id}`}>{proposal.title}</Link>
        </h3>
        <p className="proposal-card__excerpt">{proposal.excerpt}</p>
      </div>

      <dl className="proposal-card__meta">
        <div>
          <dt>Author</dt>
          <dd>{proposal.author}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{proposal.createdAt}</dd>
        </div>
        <div>
          <dt>Voting window</dt>
          <dd>{proposal.votingWindow}</dd>
        </div>
      </dl>
    </article>
  );
}
