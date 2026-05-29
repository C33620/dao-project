import Link from "next/link";

type CreateProposalEntryCardProps = {
  origin: "dashboard" | "proposals";
  description?: string;
};

export function CreateProposalEntryCard({
  origin,
  description = "Write a proposal for the group to review and vote on.",
}: CreateProposalEntryCardProps) {
  return (
    <section
      className="dashboard-cta-card"
      aria-labelledby={`create-proposal-${origin}`}
    >
      <div
        className="dashboard-cta-card__content"
        style={{
          display: "grid",
          gap: 12,
          justifyItems: "start",
          textAlign: "left",
        }}
      >
        <Link
          href={`/app/proposals/create?from=${origin}`}
          className="button button--primary"
        >
          Create a new proposal
        </Link>

        <p
          id={`create-proposal-${origin}`}
          className="dashboard-cta-card__description"
          style={{ margin: 0, maxWidth: "48ch" }}
        >
          {description}
        </p>
      </div>
    </section>
  );
}
