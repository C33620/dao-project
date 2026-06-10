import Link from "next/link";

import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import { getExecutableProposals } from "@/lib/services/proposals";

export default async function ExecutePage() {
  const proposals = await getExecutableProposals();

  return (
    <PageShell title="" description="">
      <div className="page-shell__content">
        <SectionCard
          title="Ready to execute"
          description="These proposals have cleared the timelock and can be executed now."
        >
          <div className="execution-list">
            {proposals.length > 0 ? (
              proposals.map((proposal) => (
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
                    <StatusBadge
                      label={proposal.statusLabel}
                      tone={proposal.statusTone}
                    />
                  </div>

                  <p className="execution-item__body">{proposal.excerpt}</p>

                  <dl className="execution-item__meta">
                    <div>
                      <dt>Queued</dt>
                      <dd>{proposal.queuedAt ?? "Not queued yet"}</dd>
                    </div>
                    <div>
                      <dt>Executable</dt>
                      <dd>{proposal.executableAt ?? "Waiting"}</dd>
                    </div>
                  </dl>

                  <div className="execution-item__actions">
                    <Link
                      href={`/app/proposals/${proposal.id}`}
                      className="button button--secondary"
                    >
                      Review item
                    </Link>
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
