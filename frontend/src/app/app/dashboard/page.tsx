import { CancelProposalEntryCard } from "@/app/app/proposals/components/cancel-proposal-entry-card";
import { CreateProposalEntryCard } from "@/app/app/proposals/components/create-proposal-entry-card";
import { ActionableProposalsPreview } from "@/components/governance/actionable-proposals-preview";
import { GovernanceActivityPreview } from "@/components/governance/governance-activity-preview";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth";
import {
  getExecutableProposals,
  getQueueableProposals,
  getRecentGovernanceActivity,
} from "@/lib/services/proposals";
import { ensureLowBalanceGasRefillForUser } from "@/lib/treasury/distribute";
import Link from "next/link";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();

  if (currentUser?.id) {
    await ensureLowBalanceGasRefillForUser(currentUser.id);
  }

  const [executableProposals, queueableProposals, recentActivity] =
    await Promise.all([
      getExecutableProposals(),
      getQueueableProposals(),
      getRecentGovernanceActivity("executed"),
    ]);

  const votedPreview = recentActivity.slice(0, 3);

  return (
    <PageShell title="" description="">
      <div className="dashboard-stack">
        <SectionCard
          title="Create a proposal"
          description="Write a proposal for the group to review and vote on."
        >
          <div className="dashboard-section-stack">
            <CreateProposalEntryCard origin="proposals" description="" />
          </div>
        </SectionCard>

        <SectionCard
          title="Cancel a proposal"
          description="Cancel an existing proposal."
        >
          <div className="dashboard-section-stack">
            <CancelProposalEntryCard origin="proposals" description="" />
          </div>
        </SectionCard>

        <div className="two-column-layout">
          <SectionCard
            title="Voted proposals"
            description="A preview of recent governance outcomes."
          >
            <div className="dashboard-section-stack">
              <GovernanceActivityPreview
                items={votedPreview}
                emptyTitle="No voted proposals yet"
                emptyDescription="Recent voted proposals will appear here once activity exists."
              />

              <div className="dashboard-section-stack__footer">
                <Link href="/app/history" className="button button--secondary">
                  View more
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Proposals to validate"
            description="Discover proposals that need action."
          >
            <div className="dashboard-section-stack">
              <ActionableProposalsPreview
                queueableProposals={queueableProposals}
                executableProposals={executableProposals}
              />

              <div className="dashboard-section-stack__footer">
                <Link href="/app/execute" className="button button--secondary">
                  View more
                </Link>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}
