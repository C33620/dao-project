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
      <div className="grid gap-5">
        <SectionCard
          title="Create a proposal"
          description="Write a proposal for the group to review and vote on."
        >
          <div className="grid gap-4">
            <CreateProposalEntryCard origin="proposals" description="" />
          </div>
        </SectionCard>

        <SectionCard
          title="Cancel a proposal"
          description="Create a proposal to cancel a previously executed proposal."
        >
          <div className="grid gap-4">
            <CancelProposalEntryCard origin="proposals" description="" />
          </div>
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard
            title="Voted proposals"
            description="A preview of recent governance outcomes."
          >
            <div className="grid gap-4">
              <GovernanceActivityPreview
                items={votedPreview}
                emptyTitle="No voted proposals yet"
                emptyDescription="Recent voted proposals will appear here once activity exists."
              />

              <div className="flex justify-start pt-1">
                <Link
                  href="/app/history"
                  className="inline-flex min-h-11 items-center justify-center rounded-full px-[1.05rem] py-[0.78rem] border border-transparent text-[0.94rem] font-bold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-160 ease hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 bg-white/88 text-(--foreground) hover:bg-(--surface) hover:border-(--border-strong)"
                >
                  View more
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Proposals to validate"
            description="Discover proposals that need action."
          >
            <div className="grid gap-4">
              <ActionableProposalsPreview
                queueableProposals={queueableProposals}
                executableProposals={executableProposals}
              />

              <div className="flex justify-start pt-1">
                <Link
                  href="/app/execute"
                  className="inline-flex min-h-11 items-center justify-center rounded-full px-[1.05rem] py-[0.78rem] border border-transparent text-[0.94rem] font-bold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-160 ease hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 bg-white/88 text-(--foreground) hover:bg-(--surface) hover:border-(--border-strong)"
                >
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
