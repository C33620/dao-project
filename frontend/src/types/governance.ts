export type ProposalStatus =
  | "draft"
  | "active"
  | "succeeded"
  | "queued"
  | "executed"
  | "defeated"
  | "canceled";

export type ProposalTimelineStage =
  | "drafted"
  | "scheduled"
  | "active"
  | "succeeded"
  | "queued"
  | "executable"
  | "executed"
  | "defeated"
  | "canceled";

export type VoteSupport = "for" | "against" | "abstain";

export type ProposalCategory =
  | "Protocol"
  | "Treasury"
  | "Governance"
  | "Community"
  | "Risk"
  | "Operations";

export type StatusTone =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "pending";

export type ProposalVoteTotals = {
  for: number;
  against: number;
  abstain: number;
  quorum: number;
  totalParticipating: number;
};

export type ProposalTimelineItem = {
  stage: ProposalTimelineStage;
  label: string;
  date: string;
  complete: boolean;
  current?: boolean;
};

export type ProposalSummary = {
  id: string;
  slug?: string;
  title: string;
  excerpt: string;
  status: ProposalStatus;
  statusLabel: string;
  statusTone: StatusTone;
  category: ProposalCategory;
  proposer: string;
  createdAt: string;
  votingStartsAt?: string;
  votingEndsAt?: string;
  queuedAt?: string;
  executableAt?: string;
};

export type ProposalDetail = ProposalSummary & {
  description: string[];
  tags: string[];
  contractSummary: string;
  votes: ProposalVoteTotals;
  timeline: ProposalTimelineItem[];
  actionsLabel: string;
};

export type GovernanceActivityType =
  | "proposal_created"
  | "voting_opened"
  | "proposal_succeeded"
  | "proposal_queued"
  | "proposal_executed"
  | "delegation_updated";

export type GovernanceActivityItem = {
  id: string;
  type: GovernanceActivityType;
  title: string;
  description: string;
  occurredAt: string;
  relatedProposalId?: string;
  tone: StatusTone;
};

export type ProtocolStatusItem = {
  label: string;
  value: string;
  tone: StatusTone;
  helpText: string;
};

export type WalletGovernanceSummary = {
  connectionLabel: string;
  address: string;
  delegateLabel: string;
  votingPower: string;
  participationRate: string;
  lastAction: string;
};

export type VotingPowerSummary = {
  totalVotingPower: string;
  delegatedPower: string;
  quorumReference: string;
  shareOfQuorum: string;
};

export type DashboardSummary = {
  wallet: WalletGovernanceSummary;
  votingPower: VotingPowerSummary;
  protocolStatus: ProtocolStatusItem[];
  recentProposals: ProposalSummary[];
  recentActivity: GovernanceActivityItem[];
};

export type ProposalFilterOption = "all" | ProposalStatus;

export type WalletConnectionStatus =
  | "disconnected"
  | "connected"
  | "reconnecting";

export type DelegationStatusType =
  | "self"
  | "delegated"
  | "received"
  | "inactive";

export type ProposalActionDisabledReason =
  | "wallet_required"
  | "proposal_not_active"
  | "proposal_not_started"
  | "proposal_closed"
  | "already_voted"
  | "no_voting_power"
  | "delegated_away"
  | "execution_only"
  | "canceled"
  | "executed"
  | "draft";

export type TransactionLikeStatus =
  | "idle"
  | "review"
  | "submitting"
  | "success"
  | "error";

export type VoteEligibility = {
  canVote: boolean;
  reason?: ProposalActionDisabledReason;
  title: string;
  description: string;
};

export type VoteActionState = {
  status: TransactionLikeStatus;
  selectedSupport?: VoteSupport;
  existingVote?: VoteSupport;
  submitLabel: string;
  feedbackTitle?: string;
  feedbackMessage?: string;
};

export type VotingPowerSummaryCard = {
  totalVotingPower: string;
  availableVotingPower: string;
  delegatedVotingPower: string;
  quorumReference: string;
  shareOfQuorum: string;
};

export type DelegationStatus = {
  status: DelegationStatusType;
  label: string;
  description: string;
  delegate?: string;
};

export type WalletSession = {
  connectionStatus: WalletConnectionStatus;
  connectionLabel: string;
  address?: string;
  displayName?: string;
  networkLabel: string;
  environmentLabel: string;
  connectCtaLabel: string;
  isConnected: boolean;
};

export type WalletGovernanceProfile = {
  session: WalletSession;
  votingPower: VotingPowerSummaryCard;
  delegation: DelegationStatus;
  participationRate: string;
  lastAction: string;
};

export type ProposalActionState = {
  proposalId: string;
  proposalStatus: ProposalStatus;
  summary: string;
  eligibility: VoteEligibility;
  vote: VoteActionState;
};

export type ExecutionReadinessStage =
  | "unavailable"
  | "awaiting_vote_close"
  | "awaiting_queue"
  | "queued"
  | "ready"
  | "completed";

export type ExecutionReadinessState = {
  proposalId: string;
  stage: ExecutionReadinessStage;
  tone: StatusTone;
  label: string;
  description: string;
  queuedAt?: string;
  executableAt?: string;
};

export type MockVoteSubmissionInput = {
  proposalId: string;
  support: VoteSupport;
};

export type MockVoteSubmissionResult = {
  ok: boolean;
  proposalId: string;
  support?: VoteSupport;
  vote: VoteActionState;
  eligibility: VoteEligibility;
  errorMessage?: string;
};
