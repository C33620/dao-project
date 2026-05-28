import { ProposalList } from "@/components/governance/proposal-list";
import { PageShell } from "@/components/ui/page-shell";
import { getProposals } from "@/lib/services/proposals";

export default async function ProposalsPage() {
  const proposals = await getProposals("active");

  return (
    <PageShell title="" description="">
      <div className="page-shell__content">
        <ProposalList
          proposals={proposals}
          emptyTitle="No active proposals right now"
          emptyDescription="When a new item is ready for review, it will appear here."
        />
      </div>
    </PageShell>
  );
}
