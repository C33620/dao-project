"use client";

import { ExecuteActionCard } from "@/components/governance/execute-action-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { ProposalSummary } from "@/types/governance";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ExecutableProposalsListProps = {
  initialProposals: ProposalSummary[];
};

export function ExecutableProposalsList({
  initialProposals,
}: ExecutableProposalsListProps) {
  const [proposals, setProposals] = useState(initialProposals);
  const router = useRouter();

  function handleExecuted(proposalId: string) {
    setProposals((current) =>
      current.filter((proposal) => proposal.id !== proposalId),
    );

    router.refresh();
  }

  return (
    <div className="grid gap-[0.9rem]">
      {proposals.length > 0 ? (
        proposals.map((proposal) => {
          const isCancelProposal = proposal.kind === "cancel";

          return (
            <article
              key={proposal.id}
              className="flex flex-col gap-[0.9rem] p-4 rounded-2xl border border-(--border) bg-(--surface-subtle)"
              style={
                isCancelProposal
                  ? {
                      borderColor: "rgba(185, 48, 72, 0.24)",
                      background: "rgba(250, 237, 241, 0.62)",
                    }
                  : undefined
              }
            >
              <div className="flex w-full justify-between items-start gap-4 flex-wrap">
                <div className="execution-item__headline">
                  <p className="m-0 text-(--muted-soft) text-[0.74rem] uppercase tracking-[0.08em]">
                    {getProposalCategoryLabel(proposal.category)}
                  </p>
                  <h3 className="mt-[0.35rem] mb-0 text-base tracking-[-0.02em]">
                    {proposal.title}
                  </h3>
                </div>

                <div className="execution-item__status">
                  <StatusBadge
                    label={
                      isCancelProposal
                        ? "Cancellation ready to execute"
                        : "Ready to execute"
                    }
                    tone={isCancelProposal ? "danger" : "success"}
                  />
                </div>
              </div>

              <p className="m-0 text-(--muted) leading-[1.6] max-w-[62ch]">
                {proposal.excerpt}
              </p>

              <dl className="grid gap-3 grid-cols-1 min-[900px]:grid-cols-2">
                <div>
                  <dt className="text-(--muted-soft) text-[0.75rem] uppercase tracking-[0.06em]">
                    Executable
                  </dt>
                  <dd className="mt-1 font-bold">
                    {proposal.executableAt ?? "Waiting"}
                  </dd>
                </div>
              </dl>

              <div className="relative w-full min-w-0 block *:w-full *:min-w-0">
                <ExecuteActionCard
                  proposal={proposal}
                  onExecuted={handleExecuted}
                />
              </div>
            </article>
          );
        })
      ) : (
        <div className="grid place-items-center gap-[0.6rem] min-h-60 p-8 text-center bg-white/90 border border-dashed border-(--border-strong) rounded-md">
          <div
            className="w-12 h-12 grid place-items-center rounded-full bg-(--surface-subtle) text-(--muted-soft) text-[1.4rem]"
            aria-hidden="true"
          >
            ≣
          </div>
          <h2 className="m-0 text-[1.1rem] tracking-[-0.02em]">
            Nothing needs execution right now
          </h2>
          <p className="m-0 text-(--muted) max-w-[44ch] leading-[1.6]">
            Only proposals that are fully ready for execution appear on this
            page.
          </p>
        </div>
      )}
    </div>
  );
}
