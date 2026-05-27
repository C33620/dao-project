import {
  ProposalCard,
  ProposalCardData,
} from "@/components/governance/proposal-card";

type ProposalListProps = {
  proposals: ProposalCardData[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function ProposalList({
  proposals,
  emptyTitle = "No proposals yet",
  emptyDescription = "New proposals will appear here once governance data is connected.",
}: ProposalListProps) {
  if (proposals.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon" aria-hidden="true">
          ≣
        </div>
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="proposal-list">
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
    </div>
  );
}
