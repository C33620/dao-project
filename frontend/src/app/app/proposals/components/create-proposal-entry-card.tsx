import Link from "next/link";

type CreateProposalEntryCardProps = {
  origin: "dashboard" | "proposals";
  description: string;
};

export function CreateProposalEntryCard({
  origin,
  description,
}: CreateProposalEntryCardProps) {
  return (
    <section
      className="dashboard-cta-card"
      aria-labelledby={`create-proposal-${origin}`}
    >
      <div className="dashboard-cta-card__content">
        <p className="section-kicker">Create</p>
        <h2
          id={`create-proposal-${origin}`}
          className="dashboard-cta-card__title"
        >
          Start a new proposal
        </h2>
        <p className="dashboard-cta-card__description">{description}</p>
      </div>

      <div className="dashboard-cta-card__actions">
        <Link
          href={`/app/proposals/create?from=${origin}`}
          className="button button--primary"
        >
          Start a proposal
        </Link>
      </div>
    </section>
  );
}
