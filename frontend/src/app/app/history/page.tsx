import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

const activityGroups = [
  {
    date: "Today",
    items: [
      {
        title: "Proposal 101 reached quorum",
        detail:
          "Placeholder governance milestone recorded in the activity feed.",
        tone: "success" as const,
      },
      {
        title: "Execution queue updated",
        detail:
          "A queued action placeholder is now waiting for timelock completion.",
        tone: "pending" as const,
      },
    ],
  },
  {
    date: "Earlier this week",
    items: [
      {
        title: "Delegate profile reviewed",
        detail: "Mock-safe account and participation metadata refreshed.",
        tone: "info" as const,
      },
      {
        title: "Governance settings changed",
        detail:
          "Notification preferences placeholder updated for this workspace.",
        tone: "warning" as const,
      },
    ],
  },
];

export default function HistoryPage() {
  return (
    <PageShell
      title="History"
      description="Chronological governance activity with clear rhythm and empty-safe grouping."
    >
      <SectionCard
        title="Activity feed"
        description="Recent protocol and user-facing governance events."
      >
        <div className="activity-groups">
          {activityGroups.map((group) => (
            <section key={group.date} className="activity-group">
              <h2>{group.date}</h2>

              <div className="activity-list">
                {group.items.map((item) => (
                  <article key={item.title} className="activity-item">
                    <div className="activity-item__rail" aria-hidden="true" />
                    <div className="activity-item__content">
                      <div className="activity-item__top">
                        <h3>{item.title}</h3>
                        <StatusBadge label="Recorded" tone={item.tone} />
                      </div>
                      <p>{item.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SectionCard>
    </PageShell>
  );
}
