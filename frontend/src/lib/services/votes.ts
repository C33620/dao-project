import { getProposalById } from "@/lib/services/proposals";
import type {
  MockVoteSubmissionInput,
  MockVoteSubmissionResult,
  ProposalActionDisabledReason,
  ProposalActionState,
  ProposalStatus,
  VoteActionState,
  VoteEligibility,
} from "@/types/governance";

function buildVoteEligibility(status: ProposalStatus): VoteEligibility {
  switch (status) {
    case "active":
      return {
        canVote: true,
        title: "Voting is open",
        description: "You can cast a vote on this proposal right now.",
      };

    case "draft":
      return {
        canVote: false,
        reason: "draft",
        title: "Proposal is still a draft",
        description: "Voting is unavailable until the proposal becomes active.",
      };

    case "succeeded":
      return {
        canVote: false,
        reason: "proposal_closed",
        title: "Voting has ended",
        description:
          "This proposal already passed and can no longer receive votes.",
      };

    case "queued":
      return {
        canVote: false,
        reason: "execution_only",
        title: "Proposal queued",
        description:
          "Voting has ended and the proposal is now in the execution flow.",
      };

    case "executed":
      return {
        canVote: false,
        reason: "executed",
        title: "Proposal executed",
        description:
          "This proposal has already been executed and cannot receive votes.",
      };

    case "defeated":
      return {
        canVote: false,
        reason: "proposal_closed",
        title: "Proposal defeated",
        description: "Voting has ended and this proposal did not pass.",
      };

    case "canceled":
      return {
        canVote: false,
        reason: "canceled",
        title: "Proposal canceled",
        description: "This proposal was canceled and cannot receive votes.",
      };

    default:
      return {
        canVote: false,
        reason: "proposal_not_active",
        title: "Voting unavailable",
        description: "This proposal is not currently in a votable state.",
      };
  }
}

function buildVoteActionState(status: ProposalStatus): VoteActionState {
  switch (status) {
    case "active":
      return {
        status: "review",
        submitLabel: "Cast vote",
      };

    case "executed":
      return {
        status: "success",
        submitLabel: "Executed",
        feedbackTitle: "Proposal executed",
        feedbackMessage: "This proposal has already been executed.",
      };

    case "queued":
      return {
        status: "idle",
        submitLabel: "Voting closed",
        feedbackTitle: "Proposal queued",
        feedbackMessage: "Voting has ended and the proposal is queued.",
      };

    case "succeeded":
      return {
        status: "idle",
        submitLabel: "Voting closed",
        feedbackTitle: "Voting complete",
        feedbackMessage:
          "This proposal passed and is awaiting the next governance step.",
      };

    case "defeated":
      return {
        status: "idle",
        submitLabel: "Voting closed",
        feedbackTitle: "Proposal defeated",
        feedbackMessage: "This proposal did not pass.",
      };

    case "canceled":
      return {
        status: "idle",
        submitLabel: "Voting closed",
        feedbackTitle: "Proposal canceled",
        feedbackMessage: "This proposal was canceled.",
      };

    case "draft":
    default:
      return {
        status: "idle",
        submitLabel: "Voting unavailable",
        feedbackTitle: "Voting unavailable",
        feedbackMessage: "This proposal is not open for voting.",
      };
  }
}

function buildActionSummary(status: ProposalStatus): string {
  switch (status) {
    case "active":
      return "Voting is currently open for this proposal.";
    case "succeeded":
      return "Voting has ended and the proposal passed.";
    case "queued":
      return "The proposal is queued and waiting for execution.";
    case "executed":
      return "The proposal has already been executed.";
    case "defeated":
      return "Voting has ended and the proposal did not pass.";
    case "canceled":
      return "The proposal was canceled.";
    case "draft":
    default:
      return "This proposal is not currently open for voting.";
  }
}

function getDisabledReasonForStatus(
  status: ProposalStatus,
): ProposalActionDisabledReason | undefined {
  switch (status) {
    case "draft":
      return "draft";
    case "queued":
      return "execution_only";
    case "executed":
      return "executed";
    case "canceled":
      return "canceled";
    case "succeeded":
    case "defeated":
      return "proposal_closed";
    default:
      return undefined;
  }
}

export async function getProposalActionState(
  proposalId: string,
): Promise<ProposalActionState | null> {
  const proposal = await getProposalById(proposalId);

  if (!proposal) {
    return null;
  }

  return {
    proposalId: proposal.id,
    proposalStatus: proposal.status,
    summary: buildActionSummary(proposal.status),
    eligibility: buildVoteEligibility(proposal.status),
    vote: buildVoteActionState(proposal.status),
  };
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
          "The requested proposal could not be found in the current proposal store.",
      },
      eligibility: {
        canVote: false,
        reason: "proposal_not_active",
        title: "Proposal unavailable",
        description:
          "The requested proposal could not be found in the current proposal store.",
      },
      errorMessage:
        "The requested proposal could not be found in the current proposal store.",
    };
  }

  if (proposal.status !== "active") {
    const reason =
      getDisabledReasonForStatus(proposal.status) ?? "proposal_not_active";

    return {
      ok: false,
      proposalId: proposal.id,
      support: input.support,
      vote: {
        status: "error",
        selectedSupport: input.support,
        submitLabel: "Voting unavailable",
        feedbackTitle: "Voting is closed",
        feedbackMessage:
          "Votes can only be submitted while a proposal is active.",
      },
      eligibility: {
        canVote: false,
        reason,
        title: "Voting unavailable",
        description:
          "Votes can only be submitted while the proposal is active.",
      },
      errorMessage: "Votes can only be submitted while the proposal is active.",
    };
  }

  return {
    ok: false,
    proposalId: proposal.id,
    support: input.support,
    vote: {
      status: "error",
      selectedSupport: input.support,
      submitLabel: "Wallet vote not connected",
      feedbackTitle: "Voting not wired yet",
      feedbackMessage:
        "This proposal is active, but wallet signing and onchain vote submission are not implemented yet.",
    },
    eligibility: {
      canVote: true,
      title: "Vote path not connected",
      description:
        "The proposal is active, but wallet signing and onchain vote submission are not implemented yet.",
    },
    errorMessage:
      "The proposal is active, but wallet signing and onchain vote submission are not implemented yet.",
  };
}
