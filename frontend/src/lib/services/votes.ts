import {
  getMockProposalActionState,
  submitMockVoteForProposal,
} from "@/lib/mock/interactions";
import { getProposalById } from "@/lib/services/proposals";
import type {
  MockVoteSubmissionInput,
  MockVoteSubmissionResult,
  ProposalActionState,
} from "@/types/governance";

export async function getProposalActionState(
  proposalId: string,
): Promise<ProposalActionState | null> {
  const proposal = await getProposalById(proposalId);

  if (!proposal) {
    return null;
  }

  return getMockProposalActionState(proposal);
}

export async function submitMockVote(
  input: MockVoteSubmissionInput,
): Promise<MockVoteSubmissionResult> {
  const proposal = await getProposalById(input.proposalId);

  if (!proposal) {
    return {
      ok: false,
      proposalId: input.proposalId,
      vote: {
        status: "error",
        selectedSupport: input.support,
        submitLabel: "Proposal unavailable",
        feedbackTitle: "Proposal not found",
        feedbackMessage:
          "The requested proposal could not be found in the mock service layer.",
      },
      eligibility: {
        canVote: false,
        reason: "proposal_not_active",
        title: "Proposal unavailable",
        description:
          "The requested proposal could not be found in the mock service layer.",
      },
      errorMessage:
        "The requested proposal could not be found in the mock service layer.",
    };
  }

  return submitMockVoteForProposal(proposal, input);
}
