import { GovernanceActivityPreview } from "@/components/governance/governance-activity-preview";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getRecentGovernanceActivity } from "@/lib/services/proposals";

export default async function HistoryPage() {
  const activity = await getRecentGovernanceActivity("executed");

  return (
    <PageShell title="" description="">
      <div className="grid gap-5">
        <SectionCard
          title="Executed proposals"
          description="Only proposals that reached execution appear here, newest first."
        >
          <GovernanceActivityPreview
            items={activity}
            emptyTitle="No executed proposals yet"
            emptyDescription="Proposals will appear here once they complete the governance lifecycle and are executed onchain."
          />
        </SectionCard>
      </div>
    </PageShell>
  );
}
