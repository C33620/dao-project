import { getProposalById } from "@/lib/services/proposals";
import type {
  ProposalActionState,
  ProposalDetail,
  VoteActionState,
  VoteEligibility,
} from "@/types/governance";

function buildVoteEligibility(proposal: ProposalDetail): VoteEligibility {
  const governance = proposal.governance;

  if (!governance) {
    return {
      canVote: false,
      reason: "wallet_required",
      title: "Wallet required",
      description: "Connect a governance wallet to check voting eligibility.",
    };
  }

  if (proposal.status === "pending") {
    return {
      canVote: false,
      reason: "proposal_not_started",
      title: "Voting has not started",
      description: "This proposal is waiting for its voting window to begin.",
    };
  }

  if (proposal.status === "draft") {
    return {
      canVote: false,
      reason: "draft",
      title: "Proposal is still a draft",
      description: "Voting is unavailable until the proposal becomes active.",
    };
  }

  if (proposal.status === "queued") {
    return {
      canVote: false,
      reason: "execution_only",
      title: "Proposal queued",
      description:
        "Voting has ended and the proposal is now in the execution flow.",
    };
  }

  if (proposal.status === "executed") {
    return {
      canVote: false,
      reason: "executed",
      title: "Proposal executed",
      description:
        "This proposal has already been executed and cannot receive votes.",
    };
  }

  if (proposal.status === "canceled") {
    return {
      canVote: false,
      reason: "canceled",
      title: "Proposal canceled",
      description: "This proposal was canceled and cannot receive votes.",
    };
  }

  if (proposal.status === "defeated" || proposal.status === "succeeded") {
    return {
      canVote: false,
      reason: "proposal_closed",
      title: "Voting closed",
      description: "Voting is no longer open for this proposal.",
    };
  }

  if (proposal.status !== "active") {
    return {
      canVote: false,
      reason: "proposal_not_active",
      title: "Voting unavailable",
      description: "This proposal is not currently in a votable state.",
    };
  }

  if (governance.hasVoted) {
    return {
      canVote: false,
      reason: "already_voted",
      title: "Vote already submitted",
      description: "Your vote has already been recorded for this proposal.",
    };
  }

  if (governance.needsDelegation) {
    return {
      canVote: false,
      reason: "delegated_away",
      title: "Delegation required",
      description:
        "Delegate voting power to yourself before voting on this proposal.",
    };
  }
  if (BigInt(governance.userVotingPower) <= BigInt(0)) {
    return {
      canVote: false,
      reason: "no_voting_power",
      title: "No voting power",
      description: "You did not have voting power at this proposal's snapshot.",
    };
  }

  return {
    canVote: true,
    title: "Voting is open",
    description: "You can cast a vote on this proposal right now.",
  };
}

function buildVoteActionState(proposal: ProposalDetail): VoteActionState {
  const governance = proposal.governance;

  if (governance?.hasVoted) {
    return {
      status: "success",
      submitLabel: "Voted",
      feedbackTitle: "Vote recorded",
      feedbackMessage: "Your vote has already been recorded onchain.",
    };
  }

  if (proposal.status === "active" && governance?.needsDelegation) {
    return {
      status: "review",
      submitLabel: "Enable vote",
      feedbackTitle: "Delegation required",
      feedbackMessage:
        "Delegate voting power to yourself before voting on this proposal.",
    };
  }

  if (
    proposal.status === "active" &&
    governance &&
    BigInt(governance.userVotingPower) <= BigInt(0)
  ) {
    return {
      status: "idle",
      submitLabel: "Not eligible for this snapshot",
      feedbackTitle: "Snapshot already passed",
      feedbackMessage:
        "Your wallet balance may be updated now, but you did not have voting power at this proposal's snapshot. You can vote on future proposals after the rebalance is reflected in a new snapshot.",
    };
  }

  if (proposal.status === "active") {
    return {
      status: "review",
      submitLabel: "Cast vote",
      feedbackTitle: "Review your vote",
      feedbackMessage:
        "Choose For, Against, or Abstain and confirm in your wallet.",
    };
  }

  if (proposal.status === "executed") {
    return {
      status: "success",
      submitLabel: "Executed",
      feedbackTitle: "Proposal executed",
      feedbackMessage: "This proposal has already been executed.",
    };
  }

  if (proposal.status === "queued") {
    return {
      status: "idle",
      submitLabel: "Voting closed",
      feedbackTitle: "Proposal queued",
      feedbackMessage: "Voting has ended and the proposal is queued.",
    };
  }

  if (proposal.status === "succeeded") {
    return {
      status: "idle",
      submitLabel: "Voting closed",
      feedbackTitle: "Voting complete",
      feedbackMessage:
        "This proposal passed and is awaiting the next governance step.",
    };
  }

  if (proposal.status === "defeated") {
    return {
      status: "idle",
      submitLabel: "Voting closed",
      feedbackTitle: "Proposal defeated",
      feedbackMessage: "This proposal did not pass.",
    };
  }

  if (proposal.status === "canceled") {
    return {
      status: "idle",
      submitLabel: "Voting closed",
      feedbackTitle: "Proposal canceled",
      feedbackMessage: "This proposal was canceled.",
    };
  }

  if (proposal.status === "pending") {
    return {
      status: "idle",
      submitLabel: "Voting not started",
      feedbackTitle: "Voting has not started",
      feedbackMessage: "This proposal is waiting for its voting window.",
    };
  }

  return {
    status: "idle",
    submitLabel: "Voting unavailable",
    feedbackTitle: "Voting unavailable",
    feedbackMessage: "This proposal is not open for voting.",
  };
}

function buildActionSummary(proposal: ProposalDetail): string {
  const governance = proposal.governance;

  if (proposal.status === "pending") {
    return "Voting has not started for this proposal yet.";
  }

  if (proposal.status === "active" && governance?.hasVoted) {
    return "Your vote has already been recorded for this active proposal.";
  }

  if (proposal.status === "active" && governance?.canVote) {
    return "Voting is currently open for this proposal.";
  }

  if (proposal.status === "active" && governance?.needsDelegation) {
    return "Voting is open, but you need to self-delegate before voting.";
  }

  if (
    proposal.status === "active" &&
    governance &&
    BigInt(governance.userVotingPower) <= BigInt(0)
  ) {
    return "Voting is open, but you did not have voting power at this proposal's snapshot.";
  }

  if (proposal.status === "active") {
    return "Voting is open, but your wallet is not currently eligible to vote.";
  }

  if (proposal.status === "succeeded") {
    return "Voting has ended and the proposal passed.";
  }

  if (proposal.status === "queued") {
    return "The proposal is queued and waiting for execution.";
  }

  if (proposal.status === "executed") {
    return "The proposal has already been executed.";
  }

  if (proposal.status === "defeated") {
    return "Voting has ended and the proposal did not pass.";
  }

  if (proposal.status === "canceled") {
    return "The proposal was canceled.";
  }

  return "This proposal is not currently open for voting.";
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
    summary: buildActionSummary(proposal),
    eligibility: buildVoteEligibility(proposal),
    vote: buildVoteActionState(proposal),
  };
}
