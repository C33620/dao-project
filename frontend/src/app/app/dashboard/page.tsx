import { CancelProposalEntryCard } from "@/app/app/proposals/components/cancel-proposal-entry-card";
import { CreateProposalEntryCard } from "@/app/app/proposals/components/create-proposal-entry-card";
import { ProposalList } from "@/components/governance/proposal-list";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth";
import {
  getExecutableProposals,
  getRecentGovernanceActivity,
} from "@/lib/services/proposals";
import { ensureLowBalanceGasRefillForUser } from "@/lib/treasury/distribute";
import Link from "next/link";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();

  if (currentUser?.id) {
    await ensureLowBalanceGasRefillForUser(currentUser.id);
  }

  const [proposalsToValidate, recentActivity] = await Promise.all([
    getExecutableProposals(),
    getRecentGovernanceActivity("executed"),
  ]);

  const votedPreview = recentActivity.slice(0, 3);
  const validationPreview = proposalsToValidate.slice(0, 3);

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
              {votedPreview.length > 0 ? (
                <div className="activity-preview-list">
                  {votedPreview.map((item) => (
                    <article key={item.id} className="activity-preview-item">
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <span>{item.occurredAt}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state empty-state--compact">
                  <div className="empty-state__icon" aria-hidden="true">
                    ≣
                  </div>
                  <h2>No voted proposals yet</h2>
                  <p>
                    Recent voted proposals will appear here once activity
                    exists.
                  </p>
                </div>
              )}

              <div className="dashboard-section-stack__footer">
                <Link href="/app/history" className="button button--secondary">
                  View more
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Proposals to validate"
            description="Active proposals that still need your attention."
          >
            <div className="dashboard-section-stack">
              <ProposalList
                proposals={validationPreview}
                emptyTitle="No proposals need validation right now"
                emptyDescription="When a proposal becomes active, it will appear here."
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
