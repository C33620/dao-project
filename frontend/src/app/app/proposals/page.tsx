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
          description="Add a new proposal for the group to consider."
        >
          <CreateProposalEntryCard
            origin="proposals"
            description="Write a proposal for the group to review and vote on."
          />
        </SectionCard>

        <ProposalList
          proposals={proposals}
          emptyTitle="No active proposals right now"
          emptyDescription="When the governor opens a voting window, proposals will appear here."
        />
      </div>
    </PageShell>
  );
}
