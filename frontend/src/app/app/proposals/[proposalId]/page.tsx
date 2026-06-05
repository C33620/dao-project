import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import { getProposalById, getProposalTimeline } from "@/lib/services/proposals";
import Link from "next/link";
import { notFound } from "next/navigation";

type ProposalDetailPageProps = {
  params: Promise<{ proposalId: string }>;
};

export default async function ProposalDetailPage({
  params,
}: ProposalDetailPageProps) {
  const { proposalId } = await params;
  const proposal = await getProposalById(proposalId);

  if (!proposal) {
    notFound();
  }

  const timeline = await getProposalTimeline(proposalId);

  return (
    <div className="proposal-detail">
      <section className="proposal-detail__hero">
        <div className="proposal-detail__hero-content">
          <p className="proposal-detail__eyebrow">
            {getProposalCategoryLabel(proposal.category)}
          </p>
          <h1>{proposal.title}</h1>
          <p className="proposal-detail__summary">{proposal.excerpt}</p>
        </div>

        <div className="proposal-detail__hero-side">
          <StatusBadge
            label={proposal.statusLabel}
            tone={proposal.statusTone}
            className="proposal-detail__status"
          />
          <Link href="/app/proposals" className="button button--secondary">
            Back to proposals
          </Link>
        </div>
      </section>

      <section className="proposal-detail__meta-grid">
        <SectionCard
          title="Current status"
          description="The latest stage, timing, and overall result for this proposal."
        >
          <dl className="key-value-grid">
            <div>
              <dt>Stage</dt>
              <dd>{proposal.statusLabel}</dd>
            </div>
            <div>
              <dt>Voting starts</dt>
              <dd>{proposal.votingStartsAt ?? "Waiting"}</dd>
            </div>
            <div>
              <dt>Voting ends</dt>
              <dd>{proposal.votingEndsAt ?? "Waiting"}</dd>
            </div>
            <div>
              <dt>Execution</dt>
              <dd>{proposal.executableAt ?? "Not scheduled"}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Key details"
          description="Important context and ownership information for this proposal."
        >
          <dl className="key-value-grid">
            <div>
              <dt>Category</dt>
              <dd>{getProposalCategoryLabel(proposal.category)}</dd>
            </div>
            <div>
              <dt>Proposer</dt>
              <dd>{proposal.proposer}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{proposal.createdAt}</dd>
            </div>
            <div>
              <dt>Queued</dt>
              <dd>{proposal.queuedAt ?? "Not queued"}</dd>
            </div>
          </dl>
        </SectionCard>
      </section>

      <section className="proposal-detail__body-grid">
        <SectionCard
          title="Overview"
          description="A concise explanation of what this proposal is asking for."
        >
          <div className="prose-block">
            {proposal.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Timeline"
          description="Key moments in the progress of this proposal."
        >
          <ol className="timeline-list">
            {timeline.map((event) => (
              <li key={event.id}>
                <strong>{event.title}</strong>
                <span>{event.description}</span>
                <em>{event.timestamp}</em>
              </li>
            ))}
          </ol>
        </SectionCard>
      </section>
    </div>
  );
}
