"use client";

import { ExecuteActionCard } from "@/components/governance/execute-action-card";
import { QueueActionCard } from "@/components/governance/queue-action-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { ProposalSummary } from "@/types/governance";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ActionableProposal = ProposalSummary & {
  actionKind: "queue" | "execute";
};

type ActionableProposalsPreviewProps = {
  queueableProposals: ProposalSummary[];
  executableProposals: ProposalSummary[];
};

export function ActionableProposalsPreview({
  queueableProposals,
  executableProposals,
}: ActionableProposalsPreviewProps) {
  const router = useRouter();

  const [queueable, setQueueable] = useState(queueableProposals);
  const [executable, setExecutable] = useState(executableProposals);

  function handleQueued(proposalId: string) {
    setQueueable((current) =>
      current.filter((proposal) => proposal.id !== proposalId),
    );
    router.refresh();
  }

  function handleExecuted(proposalId: string) {
    setExecutable((current) =>
      current.filter((proposal) => proposal.id !== proposalId),
    );
    router.refresh();
  }

  const latestActionable = useMemo(() => {
    const merged: ActionableProposal[] = [
      ...queueable.map((proposal) => ({
        ...proposal,
        actionKind: "queue" as const,
      })),
      ...executable.map((proposal) => ({
        ...proposal,
        actionKind: "execute" as const,
      })),
    ];

    return merged
      .sort((a, b) => {
        const aTime = new Date(a.createdAt ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 2);
  }, [queueable, executable]);

  function renderStatusBadge(proposal: ActionableProposal) {
    const isCancelProposal = proposal.kind === "cancel";
    const isQueue = proposal.actionKind === "queue";

    if (isQueue) {
      if (isCancelProposal) {
        return <StatusBadge label="Cancellation proposal" tone="danger" />;
      }

      return <StatusBadge label="Ready to queue" tone="info" />;
    }

    return (
      <StatusBadge
        label={
          isCancelProposal
            ? "Cancellation ready to execute"
            : "Ready to execute"
        }
        tone={isCancelProposal ? "danger" : "success"}
      />
    );
  }

  function renderMeta(proposal: ActionableProposal) {
    if (proposal.actionKind === "queue") {
      return (
        <div>
          <dt>Voting ended</dt>
          <dd>{proposal.votingEndsAt ?? "—"}</dd>
        </div>
      );
    }

    return (
      <>
        <div>
          <dt>Executable</dt>
          <dd>{proposal.executableAt ?? "Waiting"}</dd>
        </div>

        {proposal.canceledProposalTitle ? (
          <div>
            <dt>Cancels</dt>
            <dd>{proposal.canceledProposalTitle}</dd>
          </div>
        ) : null}
      </>
    );
  }

  function renderAction(proposal: ActionableProposal) {
    if (proposal.actionKind === "queue") {
      return <QueueActionCard proposal={proposal} onQueued={handleQueued} />;
    }

    return (
      <ExecuteActionCard proposal={proposal} onExecuted={handleExecuted} />
    );
  }

if (latestActionable.length === 0) {
  return (
    <div className="grid place-items-center gap-[0.6rem] min-h-45 p-8 text-center bg-white/90 border border-dashed border-(--border-strong) rounded-md">
      <div
        className="w-12 h-12 grid place-items-center rounded-full bg-(--surface-subtle) text-(--muted-soft) text-[1.4rem]"
        aria-hidden="true"
      >
        ≣
      </div>
      <h2 className="m-0 text-[1.1rem] tracking-[-0.02em]">
        No proposals need validation right now
      </h2>
      <p className="m-0 text-(--muted) max-w-[44ch] leading-[1.6]">
        Queueable and executable proposals will appear here when available.
      </p>
    </div>
  );
}

return (
  <div className="grid grid-cols-1 gap-4 w-full *:min-w-0">
    {latestActionable.map((proposal) => {
      const isCancelProposal = proposal.kind === "cancel";

      return (
        <article
          key={`${proposal.actionKind}-${proposal.id}`}
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
              {renderStatusBadge(proposal)}
            </div>
          </div>

          <div className="execution-item__content">
            <p className="m-0 text-(--muted) leading-[1.6] max-w-[62ch]">
              {proposal.excerpt}
            </p>

            <dl className="grid gap-3 grid-cols-1 min-[900px]:grid-cols-2">
              {renderMeta(proposal)}
            </dl>
          </div>

          <div className="relative w-full min-w-0 block *:w-full *:min-w-0">
            {renderAction(proposal)}
          </div>
        </article>
      );
    })}
  </div>
);
}
