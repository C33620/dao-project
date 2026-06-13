import { ExecuteActionCard } from "@/components/governance/execute-action-card";
import { QueueActionCard } from "@/components/governance/queue-action-card";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import {
  getExecutableProposals,
  getQueueableProposals,
} from "@/lib/services/proposals";

export default async function ExecutePage() {
  const [executableProposals, queueableProposals] = await Promise.all([
    getExecutableProposals(),
    getQueueableProposals(),
  ]);

  return (
    <PageShell title="" description="">
      <div className="page-shell__content">
        <SectionCard
          title="Ready to queue"
          description="These proposals passed the vote and must be queued before execution."
        >
          <div className="execution-list">
            {queueableProposals.length > 0 ? (
              queueableProposals.map((proposal) => (
                <article
                  key={proposal.id}
                  className="execution-item execution-item--stacked"
                >
                  <div className="execution-item__topline">
                    <div>
                      <p className="execution-item__category">
                        {getProposalCategoryLabel(proposal.category)}
                      </p>
                      <h3 className="execution-item__title">
                        {proposal.title}
                      </h3>
                    </div>
                  </div>

                  <p className="execution-item__body">{proposal.excerpt}</p>

                  <dl className="execution-item__meta">
                    <div>
                      <dt>Voting ended</dt>
                      <dd>{proposal.votingEndsAt ?? "—"}</dd>
                    </div>
                  </dl>

                  <div style={{ width: "100%" }}>
                    <QueueActionCard proposal={proposal} />
                  </div>
                </article>
              ))
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
        </SectionCard>

        <SectionCard
          title="Ready to execute"
          description="These proposals passed the queue and can be executed now."
        >
          <div className="execution-list">
            {executableProposals.length > 0 ? (
              executableProposals.map((proposal) => (
                <article
                  key={proposal.id}
                  className="execution-item execution-item--stacked"
                >
                  <div className="execution-item__topline">
                    <div>
                      <p className="execution-item__category">
                        {getProposalCategoryLabel(proposal.category)}
                      </p>
                      <h3 className="execution-item__title">
                        {proposal.title}
                      </h3>
                    </div>
                    <StatusBadge label="Ready to execute" tone="success" />
                  </div>

                  <p className="execution-item__body">{proposal.excerpt}</p>

                  <dl className="execution-item__meta">
                    <div>
                      <dt>Executable</dt>
                      <dd>{proposal.executableAt ?? "Waiting"}</dd>
                    </div>
                  </dl>

                  <div className="execution-item__actions">
                    <ExecuteActionCard proposal={proposal} />
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon" aria-hidden="true">
                  ≣
                </div>
                <h2>Nothing needs execution right now</h2>
                <p>
                  Only proposals that are fully ready for execution appear on
                  this page.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
