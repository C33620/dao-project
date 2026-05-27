import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposals } from "@/lib/services/proposals";
import Link from "next/link";

export default async function ExecutePage() {
  const proposals = await getProposals("queued");

  return (
    <PageShell
      title="Finalize"
      description="Review the items that are ready, or nearly ready, to move forward."
    >
      <div className="page-shell__content">
        <section className="toolbar-card">
          <div className="toolbar-card__search">
            <p className="section-kicker">Completion queue</p>
            <h2 className="toolbar-card__title">
              Items approaching completion
            </h2>
            <p className="toolbar-card__description">
              Use this view to check what is queued, confirm timing, and
              continue when the next step is available.
            </p>
          </div>
        </section>

        <SectionCard
          title="Ready or nearly ready"
          description="These items are closest to the final step."
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
                        {proposal.category}
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
                <h2>Nothing is queued right now</h2>
                <p>
                  When an item reaches the final stage, it will appear here.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
