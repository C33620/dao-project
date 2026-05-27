import { ProposalInteractionPanel } from "@/components/governance/proposal-interaction-panel";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WalletStatus } from "@/components/wallet/wallet-status";
import { formatDate } from "@/lib/utils/format";
import type {
  ExecutionReadinessState,
  ProposalActionState,
  ProposalDetail as ProposalDetailType,
  WalletGovernanceProfile,
} from "@/types/governance";

type ProposalDetailProps = {
  proposal: ProposalDetailType;
  wallet: WalletGovernanceProfile;
  actionState: ProposalActionState;
  executionState: ExecutionReadinessState;
};

export function ProposalDetail({
  proposal,
  wallet,
  actionState,
  executionState,
}: ProposalDetailProps) {
  const quorumReached =
    proposal.votes.totalParticipating >= proposal.votes.quorum;

  return (
    <div className="proposal-detail">
      <section className="proposal-detail__hero">
        <div className="proposal-detail__hero-copy">
          <p className="proposal-detail__eyebrow">Proposal #{proposal.id}</p>
          <h1>{proposal.title}</h1>
          <p className="proposal-detail__summary">{proposal.excerpt}</p>
        </div>

        <div className="proposal-detail__hero-status">
          <StatusBadge
            label={proposal.statusLabel}
            tone={proposal.statusTone}
          />
        </div>
      </section>

      <WalletStatus wallet={wallet} />

      <div className="proposal-detail__meta-grid">
        <SectionCard
          title="Proposal context"
          description="Core metadata and scheduling details for this governance action."
        >
          <dl className="key-value-grid">
            <div>
              <dt>Proposer</dt>
              <dd>{proposal.proposer}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{proposal.category}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(proposal.createdAt)}</dd>
            </div>
            <div>
              <dt>Voting opens</dt>
              <dd>
                {proposal.votingStartsAt
                  ? formatDate(proposal.votingStartsAt)
                  : "Not scheduled"}
              </dd>
            </div>
            <div>
              <dt>Voting deadline</dt>
              <dd>
                {proposal.votingEndsAt
                  ? formatDate(proposal.votingEndsAt)
                  : "Not scheduled"}
              </dd>
            </div>
            <div>
              <dt>Executable at</dt>
              <dd>
                {proposal.executableAt
                  ? formatDate(proposal.executableAt)
                  : "Not scheduled"}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Participation"
          description="Current voting totals and quorum progress."
        >
          <div className="vote-breakdown">
            <div>
              <span>For</span>
              <strong>{proposal.votes.for.toLocaleString()}</strong>
            </div>
            <div>
              <span>Against</span>
              <strong>{proposal.votes.against.toLocaleString()}</strong>
            </div>
            <div>
              <span>Abstain</span>
              <strong>{proposal.votes.abstain.toLocaleString()}</strong>
            </div>
          </div>

          <dl className="key-value-grid key-value-grid--compact">
            <div>
              <dt>Total participation</dt>
              <dd>{proposal.votes.totalParticipating.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Quorum target</dt>
              <dd>{proposal.votes.quorum.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Quorum status</dt>
              <dd>{quorumReached ? "Reached" : "Below quorum"}</dd>
            </div>
            <div>
              <dt>Execution bundle</dt>
              <dd>{proposal.contractSummary}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <div className="proposal-detail__body-grid">
        <SectionCard
          title="Proposal narrative"
          description="Structured rationale, intended changes, and supporting context."
        >
          <div className="prose-block">
            {proposal.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Timeline"
          description="Lifecycle progression and expected next steps."
        >
          <ol className="timeline-list">
            {proposal.timeline.map((item) => (
              <li key={`${item.stage}-${item.date}`}>
                <strong>{item.label}</strong>
                <span>{formatDate(item.date)}</span>
                <em>
                  {item.current
                    ? "Current stage"
                    : item.complete
                    ? "Completed"
                    : "Upcoming"}
                </em>
              </li>
            ))}
          </ol>
        </SectionCard>

        <ProposalInteractionPanel
          proposal={proposal}
          actionState={actionState}
          executionState={executionState}
        />
      </div>
    </div>
  );
}
