import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, StatusTone } from "@/components/ui/status-badge";

type ProposalDetailProps = {
  proposalId: string;
  title: string;
  status: string;
  tone?: StatusTone;
};

export function ProposalDetail({
  proposalId,
  title,
  status,
  tone = "info",
}: ProposalDetailProps) {
  return (
    <div className="proposal-detail">
      <section className="proposal-detail__hero">
        <div className="proposal-detail__hero-copy">
          <p className="proposal-detail__eyebrow">Proposal #{proposalId}</p>
          <h1>{title}</h1>
          <p className="proposal-detail__summary">
            Placeholder overview for a governance proposal detail view. This
            area is intentionally structured for later on-chain metadata,
            proposer details, and final execution payloads.
          </p>
        </div>
        <div className="proposal-detail__hero-status">
          <StatusBadge label={status} tone={tone} />
        </div>
      </section>

      <div className="proposal-detail__meta-grid">
        <SectionCard title="Metadata">
          <dl className="key-value-grid">
            <div>
              <dt>Proposer</dt>
              <dd>Delegate Council</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>Treasury policy</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>May 18, 2026</dd>
            </div>
            <div>
              <dt>Voting deadline</dt>
              <dd>May 31, 2026</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Voting breakdown">
          <div className="vote-breakdown">
            <div>
              <span>For</span>
              <strong>61%</strong>
            </div>
            <div>
              <span>Against</span>
              <strong>24%</strong>
            </div>
            <div>
              <span>Abstain</span>
              <strong>15%</strong>
            </div>
          </div>
          <div className="progress-stack" aria-hidden="true">
            <span style={{ width: "61%" }} className="progress-stack__for" />
            <span
              style={{ width: "24%" }}
              className="progress-stack__against"
            />
            <span
              style={{ width: "15%" }}
              className="progress-stack__abstain"
            />
          </div>
        </SectionCard>
      </div>

      <div className="proposal-detail__body-grid">
        <SectionCard
          title="Summary"
          description="Structured placeholder copy for later proposal content."
        >
          <div className="prose-block">
            <p>
              This proposal placeholder represents a governance change request
              that would normally include rationale, scope, affected contracts,
              and operational risk notes.
            </p>
            <p>
              The final wired version can replace this content with validated
              proposal text, off-chain discussion links, and contract call
              previews without changing the layout structure.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Action area"
          description="Mock-safe call-to-action surface."
        >
          <div className="action-panel">
            <div className="action-panel__row">
              <span>Voting</span>
              <strong>Not available in Phase 2</strong>
            </div>
            <div className="action-panel__row">
              <span>Execution</span>
              <strong>Awaiting queue review</strong>
            </div>
            <div className="button-row">
              <button type="button" className="button button--primary" disabled>
                Vote placeholder
              </button>
              <button
                type="button"
                className="button button--secondary"
                disabled
              >
                Queue placeholder
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Timeline"
          description="Expected governance lifecycle steps."
        >
          <ol className="timeline-list">
            <li>
              <strong>Drafted</strong>
              <span>Context prepared and shared with delegates.</span>
            </li>
            <li>
              <strong>Voting live</strong>
              <span>Token holders can review and cast votes.</span>
            </li>
            <li>
              <strong>Queued</strong>
              <span>Successful proposals move into timelock review.</span>
            </li>
            <li>
              <strong>Ready to execute</strong>
              <span>Execution becomes available after the queue delay.</span>
            </li>
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
