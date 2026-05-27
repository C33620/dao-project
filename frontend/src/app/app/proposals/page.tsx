import { ProposalList } from "@/components/governance/proposal-list";
import { PageShell } from "@/components/ui/page-shell";
import { getProposals } from "@/lib/services/proposals";

export default async function ProposalsPage() {
  const proposals = await getProposals("active");

  return (
    <PageShell
      title="Proposals"
      description="Review the items that are active and ready for your attention."
    >
      <div className="page-shell__content">
        <section className="toolbar-card">
          <div className="toolbar-card__search">
            <p className="section-kicker">Active items</p>
            <h2 className="toolbar-card__title">Items ready to review</h2>
            <p className="toolbar-card__description">
              Use this list to open an item, understand its current state, and
              continue when you are ready.
            </p>
          </div>

          <div className="toolbar-card__filters" aria-label="Proposal filters">
            <button type="button" className="filter-pill" aria-current="page">
              Active
            </button>
            <button type="button" className="filter-pill">
              Recent
            </button>
          </div>
        </section>

        <ProposalList
          proposals={proposals}
          emptyTitle="No active proposals right now"
          emptyDescription="When a new item is ready for review, it will appear here."
        />
      </div>
    </PageShell>
  );
}
