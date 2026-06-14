import Link from "next/link";

type CancelProposalEntryCardProps = {
  origin: "dashboard" | "proposals";
  description?: string;
};

export function CancelProposalEntryCard({
  origin,
  description = "Create a proposal to cancel a previously executed proposal.",
}: CancelProposalEntryCardProps) {
  return (
    <section
      className="dashboard-cta-card"
      aria-labelledby={`cancel-proposal-${origin}`}
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
          href={`/app/proposals/create?mode=cancel&from=${origin}`}
          className="button button--secondary"
          style={{
            borderColor: "rgba(185, 48, 72, 0.28)",
            color: "#9b3048",
            background: "rgba(255, 255, 255, 0.92)",
          }}
        >
          Cancel an exisitng proposal
        </Link>

        <p
          id={`cancel-proposal-${origin}`}
          className="dashboard-cta-card__description"
          style={{ margin: 0, maxWidth: "48ch" }}
        >
          {description}
        </p>
      </div>
    </section>
  );
}
