import { getProposalById } from "@/lib/services/proposals";
import type { ExecutionReadinessState } from "@/types/governance";

export async function getExecutionState(
  proposalId: string,
): Promise<ExecutionReadinessState | null> {
  const proposal = await getProposalById(proposalId);

  if (!proposal) {
    return null;
  }

  if (proposal.status === "executed") {
    return {
      proposalId: proposal.id,
      stage: "completed",
      tone: "success",
      label: "Executed",
      description: "This proposal has already been executed.",
      queuedAt: proposal.queuedAt,
      executableAt: proposal.executableAt,
    };
  }

  if (proposal.status === "queued") {
    const isReady =
      typeof proposal.executableAt === "string" &&
      new Date(proposal.executableAt).getTime() <= Date.now();

    if (isReady) {
      return {
        proposalId: proposal.id,
        stage: "ready",
        tone: "success",
        label: "Ready to execute",
        description:
          "This proposal is queued and the execution delay has passed.",
        queuedAt: proposal.queuedAt,
        executableAt: proposal.executableAt,
      };
    }

    return {
      proposalId: proposal.id,
      stage: "queued",
      tone: "pending",
      label: "Queued",
      description:
        "This proposal is queued and waiting for its execution window.",
      queuedAt: proposal.queuedAt,
      executableAt: proposal.executableAt,
    };
  }

  if (proposal.status === "succeeded") {
    return {
      proposalId: proposal.id,
      stage: "awaiting_queue",
      tone: "info",
      label: "Awaiting queue",
      description:
        "This proposal passed and is waiting to be queued for execution.",
      queuedAt: proposal.queuedAt,
      executableAt: proposal.executableAt,
    };
  }

  if (proposal.status === "active") {
    return {
      proposalId: proposal.id,
      stage: "awaiting_vote_close",
      tone: "info",
      label: "Voting still open",
      description: "Execution is unavailable until voting has finished.",
      queuedAt: proposal.queuedAt,
      executableAt: proposal.executableAt,
    };
  }

  return {
    proposalId: proposal.id,
    stage: "unavailable",
    tone: "default",
    label: "Execution unavailable",
    description: "This proposal is not currently in an executable state.",
    queuedAt: proposal.queuedAt,
    executableAt: proposal.executableAt,
  };
}
