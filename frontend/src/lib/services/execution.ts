import { getMockExecutionReadiness } from "@/lib/mock/interactions";
import { getProposalById } from "@/lib/services/proposals";
import type { ExecutionReadinessState } from "@/types/governance";

export async function getExecutionState(
  proposalId: string,
): Promise<ExecutionReadinessState | null> {
  const proposal = await getProposalById(proposalId);

  if (!proposal) {
    return null;
  }

  return getMockExecutionReadiness(proposal);
}
