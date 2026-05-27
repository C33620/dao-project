import { mockDashboardSummary } from "@/lib/mock/governance";
import type {
  DelegationStatus,
  ExecutionReadinessState,
  MockVoteSubmissionInput,
  MockVoteSubmissionResult,
  ProposalActionDisabledReason,
  ProposalActionState,
  ProposalDetail,
  VoteEligibility,
  VoteSupport,
  VotingPowerSummaryCard,
  WalletGovernanceProfile,
  WalletSession,
} from "@/types/governance";

const MOCK_CONNECTED = true;
const MOCK_PREVIOUS_VOTES: Partial<Record<string, VoteSupport>> = {
  "104": "for",
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatWalletSession(): WalletSession {
  if (!MOCK_CONNECTED) {
    return {
      connectionStatus: "disconnected",
      connectionLabel: "Wallet disconnected",
      networkLabel: "Ethereum Sepolia",
      environmentLabel: "Mock governance session",
      connectCtaLabel: "Connect wallet",
      isConnected: false,
    };
  }

  return {
    connectionStatus: "connected",
    connectionLabel: "Connected delegate session",
    address: mockDashboardSummary.wallet.address,
    displayName: "delegate.alpha.eth",
    networkLabel: "Ethereum Sepolia",
    environmentLabel: "Mock governance session",
    connectCtaLabel: "Reconnect wallet",
    isConnected: true,
  };
}

function formatVotingPower(): VotingPowerSummaryCard {
  return {
    totalVotingPower: mockDashboardSummary.votingPower.totalVotingPower,
    availableVotingPower: mockDashboardSummary.votingPower.totalVotingPower,
    delegatedVotingPower: mockDashboardSummary.votingPower.delegatedPower,
    quorumReference: mockDashboardSummary.votingPower.quorumReference,
    shareOfQuorum: mockDashboardSummary.votingPower.shareOfQuorum,
  };
}

function formatDelegation(): DelegationStatus {
  return {
    status: "self",
    label: "Self delegated",
    description:
      "This wallet is currently configured to vote directly in governance.",
    delegate: mockDashboardSummary.wallet.address,
  };
}

export async function getMockWalletSession(): Promise<WalletGovernanceProfile> {
  await wait(120);

  return {
    session: formatWalletSession(),
    votingPower: formatVotingPower(),
    delegation: formatDelegation(),
    participationRate: mockDashboardSummary.wallet.participationRate,
    lastAction: mockDashboardSummary.wallet.lastAction,
  };
}

function buildEligibility(proposal: ProposalDetail): VoteEligibility {
  const session = formatWalletSession();
  const delegation = formatDelegation();
  const votingPower = formatVotingPower();
  const existingVote = MOCK_PREVIOUS_VOTES[proposal.id];

  if (!session.isConnected) {
    return {
      canVote: false,
      reason: "wallet_required",
      title: "Connect wallet to vote",
      description:
        "Voting is unavailable until a governance wallet session is connected.",
    };
  }

  if (existingVote) {
    return {
      canVote: false,
      reason: "already_voted",
      title: "Vote already recorded",
      description:
        "This wallet has already used its mock vote for this proposal.",
    };
  }

  if (delegation.status === "delegated") {
    return {
      canVote: false,
      reason: "delegated_away",
      title: "Voting power delegated away",
      description:
        "This account has delegated its voting power and cannot cast a direct vote.",
    };
  }

  if (votingPower.availableVotingPower === "0 GOV") {
    return {
      canVote: false,
      reason: "no_voting_power",
      title: "No voting power available",
      description:
        "This wallet does not currently have delegated governance power.",
    };
  }

  switch (proposal.status) {
    case "active":
      return {
        canVote: true,
        title: "Eligible to vote",
        description:
          "Voting is live for this proposal and the connected wallet can participate.",
      };
    case "draft":
      return {
        canVote: false,
        reason: "draft",
        title: "Voting not started",
        description:
          "This proposal is still in draft review and has not entered an active voting window.",
      };
    case "succeeded":
    case "queued":
      return {
        canVote: false,
        reason: "execution_only",
        title: "Voting has closed",
        description:
          "This proposal has moved into queue or execution handling and can no longer receive votes.",
      };
    case "executed":
      return {
        canVote: false,
        reason: "executed",
        title: "Proposal already executed",
        description:
          "Execution is complete and no further vote action is available.",
      };
    case "canceled":
      return {
        canVote: false,
        reason: "canceled",
        title: "Proposal canceled",
        description:
          "Canceled proposals remain visible for auditability but cannot be voted on.",
      };
    case "defeated":
      return {
        canVote: false,
        reason: "proposal_closed",
        title: "Proposal closed",
        description:
          "Voting for this proposal has ended without enough support to advance.",
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

function getActionSummary(proposal: ProposalDetail): string {
  switch (proposal.status) {
    case "active":
      return "Voting is open. Select support and submit a mock governance vote.";
    case "succeeded":
      return "Voting passed. The next lifecycle step is queueing into timelock.";
    case "queued":
      return "The proposal is queued and awaiting timelock completion.";
    case "executed":
      return "Execution is complete. This proposal now serves as a historical record.";
    case "canceled":
      return "This proposal has been archived and cannot progress further.";
    case "draft":
      return "This proposal is being reviewed before entering a live voting window.";
    case "defeated":
      return "Voting has concluded and the proposal did not advance.";
    default:
      return proposal.actionsLabel;
  }
}

function mapDisabledReason(reason?: ProposalActionDisabledReason): string {
  switch (reason) {
    case "wallet_required":
      return "Connect a wallet to continue.";
    case "already_voted":
      return "This wallet has already voted.";
    case "delegated_away":
      return "Voting power is delegated to another address.";
    case "execution_only":
      return "This proposal is now in execution handling.";
    case "executed":
      return "This proposal has already executed.";
    case "canceled":
      return "This proposal was canceled.";
    case "draft":
      return "Voting has not started yet.";
    case "proposal_closed":
      return "Voting has closed.";
    case "no_voting_power":
      return "No voting power is available.";
    default:
      return "Action unavailable.";
  }
}

export async function getMockProposalActionState(
  proposal: ProposalDetail,
): Promise<ProposalActionState> {
  await wait(160);

  const eligibility = buildEligibility(proposal);
  const existingVote = MOCK_PREVIOUS_VOTES[proposal.id];

  return {
    proposalId: proposal.id,
    proposalStatus: proposal.status,
    summary: getActionSummary(proposal),
    eligibility,
    vote: {
      status: eligibility.canVote ? "review" : "idle",
      existingVote,
      submitLabel: eligibility.canVote
        ? "Submit mock vote"
        : "Voting unavailable",
      feedbackTitle: eligibility.canVote
        ? "Ready for review"
        : eligibility.title,
      feedbackMessage: eligibility.canVote
        ? "No wallet signature is required in this phase. This interaction only simulates the governance flow."
        : mapDisabledReason(eligibility.reason),
    },
  };
}

export async function submitMockVoteForProposal(
  proposal: ProposalDetail,
  input: MockVoteSubmissionInput,
): Promise<MockVoteSubmissionResult> {
  const eligibility = buildEligibility(proposal);

  if (!eligibility.canVote) {
    return {
      ok: false,
      proposalId: proposal.id,
      vote: {
        status: "error",
        selectedSupport: input.support,
        existingVote: MOCK_PREVIOUS_VOTES[proposal.id],
        submitLabel: "Voting unavailable",
        feedbackTitle: eligibility.title,
        feedbackMessage: eligibility.description,
      },
      eligibility,
      errorMessage: eligibility.description,
    };
  }

  await wait(900);

  if (input.support === "abstain") {
    return {
      ok: false,
      proposalId: proposal.id,
      support: input.support,
      vote: {
        status: "error",
        selectedSupport: input.support,
        submitLabel: "Retry mock vote",
        feedbackTitle: "Mock submission failed",
        feedbackMessage:
          "The mock vote relay returned an error for this attempt. No transaction was sent.",
      },
      eligibility,
      errorMessage:
        "The mock vote relay returned an error for this attempt. No transaction was sent.",
    };
  }

  return {
    ok: true,
    proposalId: proposal.id,
    support: input.support,
    vote: {
      status: "success",
      selectedSupport: input.support,
      existingVote: input.support,
      submitLabel: "Vote recorded",
      feedbackTitle: "Mock vote submitted",
      feedbackMessage:
        "Your selection was recorded in the mock interaction flow. No wallet signature or blockchain transaction occurred.",
    },
    eligibility: {
      canVote: false,
      reason: "already_voted",
      title: "Vote already recorded",
      description:
        "This wallet has already used its mock vote for this proposal.",
    },
  };
}

export async function getMockExecutionReadiness(
  proposal: ProposalDetail,
): Promise<ExecutionReadinessState> {
  await wait(100);

  switch (proposal.status) {
    case "active":
      return {
        proposalId: proposal.id,
        stage: "awaiting_vote_close",
        tone: "info",
        label: "Execution unavailable during voting",
        description:
          "Execution becomes relevant only after a proposal passes the active voting period.",
        executableAt: proposal.executableAt,
        queuedAt: proposal.queuedAt,
      };
    case "succeeded":
      return {
        proposalId: proposal.id,
        stage: "awaiting_queue",
        tone: "warning",
        label: "Awaiting queue",
        description:
          "This proposal passed and would typically be queued into timelock before execution.",
        executableAt: proposal.executableAt,
        queuedAt: proposal.queuedAt,
      };
    case "queued":
      return {
        proposalId: proposal.id,
        stage: "queued",
        tone: "pending",
        label: "Queued in timelock",
        description: proposal.executableAt
          ? "The proposal is queued and approaching its earliest executable timestamp."
          : "The proposal is queued and waiting for the timelock delay to complete.",
        executableAt: proposal.executableAt,
        queuedAt: proposal.queuedAt,
      };
    case "executed":
      return {
        proposalId: proposal.id,
        stage: "completed",
        tone: "success",
        label: "Execution completed",
        description:
          "This proposal has already passed through queueing and execution.",
        executableAt: proposal.executableAt,
        queuedAt: proposal.queuedAt,
      };
    case "canceled":
      return {
        proposalId: proposal.id,
        stage: "unavailable",
        tone: "danger",
        label: "Execution unavailable",
        description: "Canceled proposals cannot be queued or executed.",
        executableAt: proposal.executableAt,
        queuedAt: proposal.queuedAt,
      };
    case "defeated":
      return {
        proposalId: proposal.id,
        stage: "unavailable",
        tone: "danger",
        label: "Execution unavailable",
        description:
          "Defeated proposals do not advance to queueing or execution.",
        executableAt: proposal.executableAt,
        queuedAt: proposal.queuedAt,
      };
    default:
      return {
        proposalId: proposal.id,
        stage: "unavailable",
        tone: "default",
        label: "Execution unavailable",
        description:
          "This proposal has not reached an execution-ready lifecycle stage.",
        executableAt: proposal.executableAt,
        queuedAt: proposal.queuedAt,
      };
  }
}
