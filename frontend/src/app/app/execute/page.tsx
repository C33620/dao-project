import { ExecutableProposalsList } from "@/components/governance/executable-proposals-list";

import { QueueableProposalsList } from "@/components/governance/queueable-proposals-list";
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
          <QueueableProposalsList initialProposals={queueableProposals} />
        </SectionCard>

        <SectionCard
          title="Ready to execute"
          description="These proposals passed the queue and can be executed now."
        >
          <div className="execution-list">
            {executableProposals.length > 0 ? (
              executableProposals.map((proposal) => {
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
                        <h3 className="execution-item__title">
                          {proposal.title}
                        </h3>
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
                      {proposal.canceledProposalTitle ? (
                        <div>
                          <dt>Cancels</dt>
                          <dd>{proposal.canceledProposalTitle}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="proposal-card__action-slot">
                      <ExecutableProposalsList
                        initialProposals={executableProposals}
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
