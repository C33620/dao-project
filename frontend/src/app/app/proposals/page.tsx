import { ProposalList } from "@/components/governance/proposal-list";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getProposals } from "@/lib/services/proposals";
import { CreateProposalEntryCard } from "./components/create-proposal-entry-card";

export default async function ProposalsPage() {
  const proposals = await getProposals("active");

  return (
    <PageShell title="" description="">
      <div className="page-shell__content">
        <SectionCard
          title="Create a proposal"
          description="Start a new proposal for the group to review and vote on."
        >
          <CreateProposalEntryCard
            origin="proposals"
            description="Use the guided flow to prepare a proposal, review the change, and submit it from one place."
          />
        </SectionCard>

        <ProposalList
          proposals={proposals}
          emptyTitle="No active proposals right now"
          emptyDescription="When a new item is ready for review, it will appear here."
        />
      </div>
    </PageShell>
  );
}
