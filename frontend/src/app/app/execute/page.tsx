import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ExecutePage() {
  return (
    <PageShell
      title="Execute"
      description="Queue and execution placeholder views for governance operations."
    >
      <div className="two-column-layout">
        <SectionCard
          title="Pending execution"
          description="Items approaching execution readiness."
        >
          <div className="execution-list">
            <article className="execution-item">
              <div>
                <h3>Proposal 102</h3>
                <p>
                  Timelock delay in progress for a placeholder protocol update.
                </p>
              </div>
              <StatusBadge label="Queued" tone="pending" />
            </article>

            <article className="execution-item">
              <div>
                <h3>Proposal 099</h3>
                <p>
                  Awaiting final review window before execution can be
                  attempted.
                </p>
              </div>
              <StatusBadge label="Review" tone="warning" />
            </article>
          </div>
        </SectionCard>

        <SectionCard
          title="Readiness status"
          description="Clear explanation before live execution exists."
        >
          <div className="status-stack">
            <div className="status-row">
              <span>Timelock complete</span>
              <StatusBadge label="1 ready soon" tone="info" />
            </div>
            <div className="status-row">
              <span>Wallet execution</span>
              <StatusBadge label="Disabled" tone="default" />
            </div>
            <div className="status-row">
              <span>Contract payload check</span>
              <StatusBadge label="Placeholder" tone="pending" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Queued actions"
          description="Structured list placeholder for future batched calls and execution payloads."
          className="two-column-layout__wide"
        >
          <div className="queued-actions">
            <div className="queued-actions__row">
              <span>Target contract</span>
              <strong>ProposalRegistry</strong>
            </div>
            <div className="queued-actions__row">
              <span>Action count</span>
              <strong>3 actions</strong>
            </div>
            <div className="queued-actions__row">
              <span>Earliest execute time</span>
              <strong>May 29, 2026 · 14:00 UTC</strong>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
