import type { ProposalCardData } from "@/components/governance/proposal-card";
import { ProposalList } from "@/components/governance/proposal-list";
import { PageShell } from "@/components/ui/page-shell";

const proposals: ProposalCardData[] = [
  {
    id: "101",
    title: "Refresh delegate incentives framework",
    excerpt:
      "Placeholder governance update focused on delegate compensation and reporting cadence.",
    status: "Active",
    tone: "info",
    category: "Operations",
    author: "Core Council",
    createdAt: "May 22, 2026",
    votingWindow: "Ends in 4 days",
  },
  {
    id: "102",
    title: "Update timelock execution thresholds",
    excerpt:
      "Placeholder protocol configuration item prepared for queue and execution review.",
    status: "Queued",
    tone: "pending",
    category: "Protocol",
    author: "Risk Working Group",
    createdAt: "May 19, 2026",
    votingWindow: "Queued for execution",
  },
  {
    id: "103",
    title: "Expand grants review committee",
    excerpt:
      "Placeholder community governance proposal for committee composition adjustments.",
    status: "Succeeded",
    tone: "success",
    category: "Community",
    author: "Ecosystem Lead",
    createdAt: "May 12, 2026",
    votingWindow: "Closed",
  },
  {
    id: "104",
    title: "Archive inactive incentive stream",
    excerpt:
      "Placeholder cleanup proposal with a narrower scope and low execution risk.",
    status: "Defeated",
    tone: "danger",
    category: "Treasury",
    author: "Operations Guild",
    createdAt: "May 5, 2026",
    votingWindow: "Closed",
  },
];

export default function ProposalsPage() {
  return (
    <PageShell
      title="Proposals"
      description="Structured proposal overview with placeholder filters, search, and reusable cards."
    >
      <section className="toolbar-card" aria-label="Proposal filters">
        <div className="toolbar-card__search">
          <label className="sr-only" htmlFor="proposal-search">
            Search proposals
          </label>
          <input
            id="proposal-search"
            type="text"
            placeholder="Search proposals (placeholder)"
            readOnly
          />
        </div>

        <div className="toolbar-card__filters">
          <button type="button" className="filter-pill" aria-pressed="true">
            All
          </button>
          <button type="button" className="filter-pill">
            Active
          </button>
          <button type="button" className="filter-pill">
            Queued
          </button>
          <button type="button" className="filter-pill">
            Closed
          </button>
        </div>
      </section>

      <ProposalList proposals={proposals} />
    </PageShell>
  );
}
