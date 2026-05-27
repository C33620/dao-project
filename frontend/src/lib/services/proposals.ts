import type { Proposal } from "@/types/governance";

export async function listProposals(): Promise<Proposal[]> {
  // TODO: add proposal sync/indexing source and repository implementation.
  return [];
}

export async function getProposalById(
  proposalId: string,
): Promise<Proposal | null> {
  const proposals = await listProposals();
  return proposals.find((proposal) => proposal.id === proposalId) ?? null;
}
