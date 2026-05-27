import { ProposalList } from "@/components/governance/proposal-list";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { WalletStatus } from "@/components/wallet/wallet-status";
import {
  getDashboardSummary,
  getProposals,
  getRecentGovernanceActivity,
} from "@/lib/services/proposals";
import Link from "next/link";

export default async function DashboardPage() {
  const [summary, proposalsNeedingReview, recentActivity] = await Promise.all([
    getDashboardSummary(),
    getProposals("active"),
    getRecentGovernanceActivity(),
  ]);

  const historyPreview = recentActivity.slice(0, 4);

  return (
    <PageShell
      title="Home"
      description="Start here with your account status, next actions, and recent activity."
    >
      <div className="dashboard-stack">
        <section className="dashboard-hero">
          <div className="dashboard-hero__content">
            <p className="section-kicker">Start here</p>
            <h2 className="dashboard-hero__title">
              Review what matters now and keep work moving.
            </h2>
            <p className="dashboard-hero__description">
              Use this space to enter your name, connect securely when ready,
              and jump straight into the next items that need your attention.
            </p>

            <form className="dashboard-name-form">
              <label className="dashboard-name-form__field">
                <span>Your name</span>
                <input
                  type="text"
                  name="displayName"
                  placeholder="Enter your name"
                />
              </label>

              <div className="dashboard-name-form__actions">
                <button type="button" className="button button--primary">
                  Sign in securely
                </button>
                <button type="button" className="button button--secondary">
                  Sign out
                </button>
              </div>
            </form>
          </div>

          <div className="dashboard-hero__account">
            <WalletStatus wallet={summary.wallet} />
          </div>
        </section>

        <section className="dashboard-actions">
          <article className="quick-action-card">
            <strong>Review proposals</strong>
            <span>Open the items that are ready for your attention now.</span>
            <Link href="/app/proposals" className="quick-action-card__link">
              Open proposals
            </Link>
          </article>

          <article className="quick-action-card">
            <strong>Check what is ready next</strong>
            <span>
              See which items are ready or nearly ready to be completed.
            </span>
            <Link href="/app/execute" className="quick-action-card__link">
              Open finalize
            </Link>
          </article>

          <article className="quick-action-card">
            <strong>Review recent activity</strong>
            <span>Look back at recent outcomes and follow what changed.</span>
            <Link href="/app/history" className="quick-action-card__link">
              Open history
            </Link>
          </article>
        </section>

        <div className="two-column-layout">
          <SectionCard
            title="Needs your review"
            description="These items are currently active and ready to be reviewed."
            className="two-column-layout__wide"
          >
            <ProposalList
              proposals={proposalsNeedingReview.slice(0, 3)}
              emptyTitle="Nothing needs your review right now"
              emptyDescription="When a new item becomes active, it will appear here."
            />
          </SectionCard>

          <SectionCard
            title="Recent activity"
            description="A quick look at what happened most recently."
          >
            <div className="activity-preview-list">
              {historyPreview.length > 0 ? (
                historyPreview.map((item) => (
                  <article key={item.id} className="activity-preview-item">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span>{item.occurredAt}</span>
                  </article>
                ))
              ) : (
                <div className="empty-state empty-state--compact">
                  <div className="empty-state__icon" aria-hidden="true">
                    ≣
                  </div>
                  <h2>No recent activity yet</h2>
                  <p>Recent updates will appear here as activity happens.</p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="At a glance"
            description="A short summary of your current preview workspace."
          >
            <dl className="key-value-grid">
              <div>
                <dt>Open items</dt>
                <dd>{summary.recentProposals.length}</dd>
              </div>
              <div>
                <dt>Recent updates</dt>
                <dd>{summary.recentActivity.length}</dd>
              </div>
              <div>
                <dt>Account state</dt>
                <dd>{summary.wallet.connectionLabel}</dd>
              </div>
              <div>
                <dt>Participation</dt>
                <dd>{summary.wallet.participationRate}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}
