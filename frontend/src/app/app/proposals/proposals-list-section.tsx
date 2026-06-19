import { ProposalList } from "@/components/governance/proposal-list";
import { getOpenProposals } from "@/lib/services/proposals";

export async function ProposalsListSection() {
  const proposals = await getOpenProposals();

  return (
    <ProposalList
      proposals={proposals}
      emptyTitle="No proposals open right now"
      emptyDescription="Active and pending proposals will appear here."
    />
  );
}
