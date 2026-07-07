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
      className=" min-h-0 px-2 py-2.5 sm:px-4 sm:py-4"
      aria-labelledby={`cancel-proposal-${origin}`}
    >
      <div className="dashboard-cta-card__content grid justify-items-start gap-3 text-left">
        <Link
          href={`/app/proposals/create?mode=cancel&from=${origin}`}
          className="button button--secondary w-auto max-w-full sm:!-ml-4 flex-none self-start !border-[rgba(185,48,72,0.28)] bg-[rgba(255,255,255,0.92)] !text-[#9b3048]"
        >
          Cancel an existing proposal
        </Link>

        <p
          id={`cancel-proposal-${origin}`}
          className="dashboard-cta-card__description m-0 max-w-[48ch]"
        >
          {description}
        </p>
      </div>
    </section>
  );
}
