import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import { getRecentGovernanceActivity } from "@/lib/services/proposals";

export default async function HistoryPage() {
  const activity = await getRecentGovernanceActivity();

  return (
    <PageShell
      title="History"
      description="A chronological view of recent governance lifecycle activity."
    >
      <div className="page-shell__content">
        <SectionCard
          title="Recent activity"
          description="The newest lifecycle and participation-related updates appear first."
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
                <h2>No history yet</h2>
                <p>
                  Governance lifecycle activity will appear here once proposals
                  move onchain.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
