import type { ProposalCardData } from "@/components/governance/proposal-card";
import { ProposalList } from "@/components/governance/proposal-list";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WalletStatus } from "@/components/wallet/wallet-status";
import Link from "next/link";

const recentProposals: ProposalCardData[] = [
  {
    id: "101",
    title: "Refresh delegate incentives framework",
    excerpt:
      "Placeholder proposal summarizing a routine governance compensation update.",
    status: "Active",
    tone: "info",
    category: "Operations",
    author: "Core Council",
    createdAt: "May 22",
    votingWindow: "4 days left",
  },
  {
    id: "102",
    title: "Update timelock execution thresholds",
    excerpt:
      "Placeholder structure for a protocol configuration proposal with review notes.",
    status: "Queued",
    tone: "pending",
    category: "Protocol",
    author: "Risk Working Group",
    createdAt: "May 19",
    votingWindow: "Queued",
  },
];

export default function DashboardPage() {
  return (
    <PageShell
      title="Dashboard"
      description="A placeholder governance overview with reusable cards and structured hierarchy."
      actions={
        <div className="button-row">
          <Link href="/app/proposals" className="button button--secondary">
            Review proposals
          </Link>
          <Link href="/app/execute" className="button button--primary">
            Open execute queue
          </Link>
        </div>
      }
    >
      <div className="dashboard-grid">
        <WalletStatus />

        <SectionCard
          title="Voting power overview"
          description="Mock-safe participation summary."
        >
          <div className="metric-panel">
            <div>
              <span className="metric-panel__label">Current voting power</span>
              <strong className="metric-panel__value">24,500 GOV</strong>
            </div>
            <StatusBadge label="Delegated" tone="success" />
          </div>

          <dl className="metric-grid">
            <div>
              <dt>Quorum reference</dt>
              <dd>400,000 GOV</dd>
            </div>
            <div>
              <dt>Your share</dt>
              <dd>6.1%</dd>
            </div>
            <div>
              <dt>Recent participation</dt>
              <dd>80%</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Protocol status"
          description="Operational context for governance review."
        >
          <div className="status-stack">
            <div className="status-row">
              <span>Proposal cadence</span>
              <StatusBadge label="Healthy" tone="success" />
            </div>
            <div className="status-row">
              <span>Execution queue</span>
              <StatusBadge label="2 pending" tone="pending" />
            </div>
            <div className="status-row">
              <span>Gas outlook</span>
              <StatusBadge label="Moderate" tone="warning" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Quick actions"
          description="Navigation shortcuts for common governance tasks."
          className="dashboard-grid__wide"
        >
          <div className="quick-actions">
            <Link href="/app/proposals" className="quick-action-card">
              <strong>Open proposals</strong>
              <span>Review active governance items and draft-safe cards.</span>
            </Link>
            <Link href="/app/history" className="quick-action-card">
              <strong>View activity</strong>
              <span>
                Scan governance history in a structured timeline layout.
              </span>
            </Link>
            <Link href="/app/settings" className="quick-action-card">
              <strong>Check settings</strong>
              <span>
                Inspect placeholder account and governance preferences.
              </span>
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Recent proposals"
          description="Preview of structured proposal cards used across the app."
          className="dashboard-grid__wide"
        >
          <ProposalList proposals={recentProposals} />
        </SectionCard>
      </div>
    </PageShell>
  );
}
