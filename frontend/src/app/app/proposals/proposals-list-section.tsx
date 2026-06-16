import { ProposalList } from "@/components/governance/proposal-list";
import { getProposals } from "@/lib/services/proposals";

export async function ProposalsListSection() {
  const proposals = await getProposals("all");

  const visibleProposals = proposals.filter(
    (proposal) => proposal.status === "active" || proposal.status === "pending",
  );

  return (
    <ProposalList
      proposals={visibleProposals}
      emptyTitle="No proposals open right now"
      emptyDescription="Active and pending proposals will appear here."
    />
  );
}
