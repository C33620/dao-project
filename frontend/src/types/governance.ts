export type ProposalStatus =
  | "draft"
  | "active"
  | "queued"
  | "executed"
  | "cancelled"
  | "unknown";

export type ProposalVoteSummary = {
  for: number;
  against: number;
  abstain: number;
};

export type Proposal = {
  id: string;
  title: string;
  summary: string;
  status: ProposalStatus;
  createdAt: string;
  proposer: string;
  voteSummary: ProposalVoteSummary;
};

export type ProposalTimelineItem = {
  id: string;
  label: string;
  timestamp: string;
  detail?: string;
};

export type ProtocolStatus = {
  treasuryReady: boolean;
  gasMonitoringReady: boolean;
  indexingReady: boolean;
};
