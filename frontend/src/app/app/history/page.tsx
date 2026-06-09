import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import { getRecentGovernanceActivity } from "@/lib/services/proposals";

export default async function HistoryPage() {
  const activity = await getRecentGovernanceActivity("executed");

  return (
    <PageShell title="" description="">
      <div className="page-shell__content">
        <SectionCard
          title="Executed proposals"
          description="Only proposals that reached execution appear here, newest first."
        >
          <div className="activity-feed">
            {activity.length > 0 ? (
              activity.map((item) => (
                <article key={item.id} className="activity-feed__item">
                  <div className="activity-feed__marker" aria-hidden="true" />
                  <div className="activity-feed__content">
                    <div className="activity-feed__topline">
                      <h3>{item.title}</h3>
                      <span>{item.occurredAt}</span>
                    </div>
                    <p>{item.description}</p>
                    {item.relatedProposalCategory ? (
                      <p>
                        Category:{" "}
                        {getProposalCategoryLabel(item.relatedProposalCategory)}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state empty-state--compact">
                <div className="empty-state__icon" aria-hidden="true">
                  ≣
                </div>
                <h2>No executed proposals yet</h2>
                <p>
                  Proposals will appear here once they complete the governance
                  lifecycle and are executed onchain.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
