import { ProposalList } from "@/components/governance/proposal-list";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getProposals } from "@/lib/services/proposals";
import { CancelProposalEntryCard } from "./components/cancel-proposal-entry-card";
import { CreateProposalEntryCard } from "./components/create-proposal-entry-card";
import { ProposalsAutoRefresh } from "./components/proposals-auto-refresh";

export default async function ProposalsPage() {
  const proposals = await getProposals("all");

  const visibleProposals = proposals.filter(
    (proposal) => proposal.status === "active" || proposal.status === "pending",
  );

  return (
    <PageShell title="" description="">
      <ProposalsAutoRefresh intervalMs={15000} />

      <div className="page-shell__content">
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

        <ProposalList
          proposals={visibleProposals}
          emptyTitle="No proposals open right now"
          emptyDescription="Active and pending proposals will appear here."
        />
      </div>
    </PageShell>
  );
}
