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
      className=" min-h-0 sm:px-4 sm:py-4"
      aria-labelledby={`create-proposal-${origin}`}
    >
      <div className="dashboard-cta-card__content grid justify-items-start gap-3 text-left">
        <Link
          href={`/app/proposals/create?from=${origin}`}
          className="button button--primary sm:!-ml-4 w-auto max-w-full"
        >
          Create a new proposal
        </Link>

        <p
          id={`create-proposal-${origin}`}
          className="dashboard-cta-card__description m-0 max-w-[48ch]"
        >
          {description}
        </p>
      </div>
    </section>
  );
}
