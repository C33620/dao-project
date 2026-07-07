import { ProposalAutoRefresh } from "@/components/governance/proposal-auto-refresh";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import { getProposalById, getProposalTimeline } from "@/lib/services/proposals";
import Link from "next/link";
import { notFound } from "next/navigation";

type ProposalDetailPageProps = {
  params: Promise<{ proposalId: string }>;
};

export default async function ProposalDetailPage({
  params,
}: ProposalDetailPageProps) {
  const { proposalId } = await params;
  const proposal = await getProposalById(proposalId);

  if (!proposal) {
    notFound();
  }

  const timeline = await getProposalTimeline(proposalId);

  return (
    <div className="grid gap-5">
      <ProposalAutoRefresh
        status={proposal.status}
        hasVoted={proposal.governance.hasVoted}
      />

      <section className="flex flex-col min-[900px]:flex-row gap-4 items-start justify-between flex-wrap p-6 rounded-lg border border-(--border) bg-white/94 shadow-(--shadow-md)">
        <div className="min-w-0 flex-[1_1_640px]">
          <p className="m-0 text-(--muted-soft) uppercase tracking-[0.08em] text-[0.72rem]">
            {getProposalCategoryLabel(proposal.category)}
          </p>
          <h1 className="mt-2 mb-0 text-[clamp(1.95rem,2.4vw,2.8rem)] leading-[1.02] tracking-tighter max-w-[16ch]">
            {proposal.title}
          </h1>
          <p className="mt-[0.9rem] max-w-[66ch] text-(--muted) leading-[1.68]">
            {proposal.excerpt}
          </p>
        </div>

        <div className="grid gap-3 justify-items-start content-start">
          <StatusBadge
            label={proposal.statusLabel}
            tone={proposal.statusTone}
            className="proposal-detail__status"
          />
          <Link
            href="/app/proposals"
            className="inline-flex min-h-11 items-center justify-center rounded-full px-[1.05rem] py-[0.78rem] border border-transparent text-[0.94rem] font-bold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-160 ease hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 bg-white/88  text-(--foreground) hover:bg-(--surface) hover:border-(--border-strong)"
          >
            Back to proposals
          </Link>
        </div>
      </section>

      <section className="grid gap-5 grid-cols-12 *:col-span-12 min-[900px]:*:col-span-6">
        <SectionCard
          title="Current status"
          description="The latest onchain stage, timing, and overall result for this proposal."
        >
          <dl className="mt-4 grid gap-[0.95rem] grid-cols-1 min-[900px]:grid-cols-2">
            <div>
              <dt className="text-(--muted-soft) text-[0.78rem]">Stage</dt>
              <dd className="mt-1 font-bold tracking-[-0.01em]">
                {proposal.statusLabel}
              </dd>
            </div>
            <div>
              <dt className="text-(--muted-soft) text-[0.78rem]">
                Voting starts
              </dt>
              <dd className="mt-1 font-bold tracking-[-0.01em]">
                {proposal.votingStartsAt ?? "Waiting"}
              </dd>
            </div>
            <div>
              <dt className="text-(--muted-soft) text-[0.78rem]">
                Voting closes
              </dt>
              <dd className="mt-1 font-bold tracking-[-0.01em]">
                {proposal.votingEndsAt ?? "Waiting"}
              </dd>
            </div>
            <div>
              <dt className="text-(--muted-soft) text-[0.78rem]">Execution</dt>
              <dd className="mt-1 font-bold tracking-[-0.01em]">
                {proposal.executableAt ?? "Not scheduled"}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Key details"
          description="Important context and ownership information for this proposal."
        >
          <dl className="mt-4 grid gap-[0.95rem] grid-cols-1 min-[900px]:grid-cols-2">
            <div>
              <dt className="text-(--muted-soft) text-[0.78rem]">Category</dt>
              <dd className="mt-1 font-bold tracking-[-0.01em]">
                {getProposalCategoryLabel(proposal.category)}
              </dd>
            </div>
            <div>
              <dt className="text-(--muted-soft) text-[0.78rem]">Proposer</dt>
              <dd className="mt-1 font-bold tracking-[-0.01em]">
                {proposal.proposer}
              </dd>
            </div>
            <div>
              <dt className="text-(--muted-soft) text-[0.78rem]">Created</dt>
              <dd className="mt-1 font-bold tracking-[-0.01em]">
                {proposal.createdAt}
              </dd>
            </div>
            <div>
              <dt className="text-(--muted-soft) text-[0.78rem]">Queued</dt>
              <dd className="mt-1 font-bold tracking-[-0.01em]">
                {proposal.queuedAt ?? "Not queued"}
              </dd>
            </div>
          </dl>
        </SectionCard>
      </section>

      <section className="grid gap-5 grid-cols-12 *:col-span-12 min-[900px]:[&>*:first-child]:col-span-7 min-[900px]:[&>*:nth-child(2)]:col-span-5">
        <SectionCard
          title="Overview"
          description="A concise explanation of what this proposal is asking for."
        >
          <div className="grid gap-[0.95rem] text-(--muted) leading-[1.7]">
            {proposal.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Timeline"
          description="Key moments in the progress of this proposal."
        >
          <ol className="m-0 p-0 list-none grid gap-[0.85rem]">
            {timeline.map((event) => (
              <li
                key={event.id}
                className="grid gap-[0.35rem] py-[0.95rem] px-4 rounded-2xl bg-(--surface-subtle) border border-(--border)"
              >
                <strong className="text-[0.95rem] tracking-[-0.01em]">
                  {event.title}
                </strong>
                <span className="text-(--muted) text-[0.92rem]">
                  {event.description}
                </span>
                <em className="text-(--muted-soft) text-[0.84rem] not-italic">
                  {event.timestamp}
                </em>
              </li>
            ))}
          </ol>
        </SectionCard>
      </section>
    </div>
  );
}
