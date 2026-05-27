import {
  mockDashboardSummary,
  mockGovernanceActivity,
  mockProposals,
  mockProtocolStatus,
} from "@/lib/mock/governance";
import type {
  DashboardSummary,
  GovernanceActivityItem,
  ProposalDetail,
  ProposalFilterOption,
  ProposalSummary,
  ProtocolStatusItem,
} from "@/types/governance";

export type ProposalTimelineEvent = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
};

function toSummary(proposal: ProposalDetail): ProposalSummary {
  return {
    id: proposal.id,
    slug: proposal.slug,
    title: proposal.title,
    excerpt: proposal.excerpt,
    status: proposal.status,
    statusLabel: proposal.statusLabel,
    statusTone: proposal.statusTone,
    category: proposal.category,
    proposer: proposal.proposer,
    createdAt: proposal.createdAt,
    votingStartsAt: proposal.votingStartsAt,
    votingEndsAt: proposal.votingEndsAt,
    queuedAt: proposal.queuedAt,
    executableAt: proposal.executableAt,
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return mockDashboardSummary;
}

export async function getProposals(
  filter: ProposalFilterOption = "all",
): Promise<ProposalSummary[]> {
  const summaries = mockProposals.map(toSummary);

  if (filter === "all") {
    return summaries;
  }

  return summaries.filter((proposal) => proposal.status === filter);
}

export async function getProposalById(
  id: string,
): Promise<ProposalDetail | null> {
  const proposal = mockProposals.find((item) => item.id === id);
  return proposal ?? null;
}

export async function getProposalTimeline(
  proposalId: string,
): Promise<ProposalTimelineEvent[]> {
  const proposal = mockProposals.find((item) => item.id === proposalId);

  if (!proposal) {
    return [];
  }

  const timeline: ProposalTimelineEvent[] = [
    {
      id: `${proposal.id}-created`,
      title: "Proposal created",
      description: `${proposal.proposer} submitted this proposal for review.`,
      timestamp: proposal.createdAt,
    },
  ];

  if (proposal.votingStartsAt) {
    timeline.push({
      id: `${proposal.id}-voting-starts`,
      title: "Voting opens",
      description: "The review and voting window becomes available.",
      timestamp: proposal.votingStartsAt,
    });
  }

  if (proposal.votingEndsAt) {
    timeline.push({
      id: `${proposal.id}-voting-ends`,
      title: "Voting closes",
      description: "The voting window ends and the result can be finalized.",
      timestamp: proposal.votingEndsAt,
    });
  }

  if (proposal.queuedAt) {
    timeline.push({
      id: `${proposal.id}-queued`,
      title: "Queued",
      description: "The proposal is queued and waiting for execution.",
      timestamp: proposal.queuedAt,
    });
  }

  if (proposal.executableAt) {
    timeline.push({
      id: `${proposal.id}-executable`,
      title: "Executable",
      description: "The proposal is ready to be executed.",
      timestamp: proposal.executableAt,
    });
  }

  return timeline;
}

export async function getRecentGovernanceActivity(): Promise<
  GovernanceActivityItem[]
> {
  return mockGovernanceActivity;
}

export async function getProtocolStatus(): Promise<ProtocolStatusItem[]> {
  return mockProtocolStatus;
}
