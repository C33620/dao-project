// components/governance/create-proposal-card.tsx
export function CreateProposalCard() {
  return (
    <div className="dashboard-cta-card">
      <div className="dashboard-cta-card__content">
        <p className="section-kicker">Coming soon</p>
        <h2 className="dashboard-cta-card__title">
          Create a new proposal from the dashboard.
        </h2>
        <p className="dashboard-cta-card__description">
          This reusable entry point is reserved for the proposal creation flow.
          For now, it marks where drafting and submission will begin.
        </p>
      </div>

      <div className="dashboard-cta-card__actions">
        <button
          type="button"
          className="button button--secondary"
          disabled
          aria-disabled="true"
        >
          Create proposal
        </button>
      </div>
    </div>
  );
}
