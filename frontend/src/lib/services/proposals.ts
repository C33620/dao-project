import { db } from "@/lib/db";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type {
  DashboardSummary,
  GovernanceActivityItem,
  ProposalDetail,
  ProposalFilterOption,
  ProposalStatus,
  ProposalSummary,
  ProtocolStatusItem,
  StatusTone,
} from "@/types/governance";

export type ProposalTimelineEvent = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
};

type ProposalLifecycleFields = {
  votingStartsAt: Date | null;
  votingEndsAt: Date | null;
  queuedAt: Date | null;
  executableAt: Date | null;
  executedAt: Date | null;
  canceledAt: Date | null;
  defeatedAt: Date | null;
};

function formatIso(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toMillis(value: Date | null): number | undefined {
  return value ? value.getTime() : undefined;
}

function mapStatus(status: ProposalStatus): {
  statusLabel: string;
  statusTone: StatusTone;
} {
  switch (status) {
    case "active":
      return { statusLabel: "Active", statusTone: "info" };
    case "queued":
      return { statusLabel: "Queued", statusTone: "pending" };
    case "succeeded":
      return { statusLabel: "Succeeded", statusTone: "success" };
    case "executed":
      return { statusLabel: "Executed", statusTone: "success" };
    case "defeated":
      return { statusLabel: "Defeated", statusTone: "danger" };
    case "canceled":
      return { statusLabel: "Canceled", statusTone: "danger" };
    case "draft":
    default:
      return { statusLabel: "Draft", statusTone: "default" };
  }
}

async function getStoredProposalRecords() {
  return db.proposalRecord.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      proposalId: true,
      title: true,
      excerpt: true,
      description: true,
      category: true,
      proposerLabel: true,
      createdAt: true,
      updatedAt: true,
      votingStartsAt: true,
      votingEndsAt: true,
      queuedAt: true,
      executableAt: true,
      executedAt: true,
      canceledAt: true,
      defeatedAt: true,
      governorTxHash: true,
    },
  });
}

type StoredProposalRecord = Awaited<
  ReturnType<typeof getStoredProposalRecords>
>[number];

function getLifecycleFields(record: {
  votingStartsAt: Date | null;
  votingEndsAt: Date | null;
  queuedAt: Date | null;
  executableAt: Date | null;
  executedAt: Date | null;
  canceledAt: Date | null;
  defeatedAt: Date | null;
}): ProposalLifecycleFields {
  return {
    votingStartsAt: record.votingStartsAt,
    votingEndsAt: record.votingEndsAt,
    queuedAt: record.queuedAt,
    executableAt: record.executableAt,
    executedAt: record.executedAt,
    canceledAt: record.canceledAt,
    defeatedAt: record.defeatedAt,
  };
}

function inferStatusFromRecord(
  record: ProposalLifecycleFields,
): ProposalStatus {
  const now = Date.now();
  const votingStartsAt = toMillis(record.votingStartsAt);
  const votingEndsAt = toMillis(record.votingEndsAt);
  const executableAt = toMillis(record.executableAt);

  if (record.executedAt) {
    return "executed";
  }

  if (record.canceledAt) {
    return "canceled";
  }

  if (record.defeatedAt) {
    return "defeated";
  }

  if (record.queuedAt || (executableAt !== undefined && executableAt <= now)) {
    return "queued";
  }

  if (
    votingStartsAt !== undefined &&
    votingEndsAt !== undefined &&
    votingStartsAt <= now &&
    votingEndsAt >= now
  ) {
    return "active";
  }

  if (votingEndsAt !== undefined && votingEndsAt < now) {
    return "succeeded";
  }

  return "draft";
}

function toSummary(record: StoredProposalRecord): ProposalSummary {
  const lifecycle = getLifecycleFields(record);
  const status = inferStatusFromRecord(lifecycle);
  const statusView = mapStatus(status);

  return {
    id: record.proposalId,
    slug: record.proposalId,
    title: record.title,
    excerpt: record.excerpt,
    status,
    statusLabel: statusView.statusLabel,
    statusTone: statusView.statusTone,
    category: record.category,
    proposer: record.proposerLabel,
    createdAt: record.createdAt.toISOString(),
    votingStartsAt: formatIso(record.votingStartsAt),
    votingEndsAt: formatIso(record.votingEndsAt),
    queuedAt: formatIso(record.queuedAt),
    executableAt: formatIso(record.executableAt),
  };
}

function buildTimeline(proposal: ProposalSummary): ProposalDetail["timeline"] {
  const items: ProposalDetail["timeline"] = [
    {
      stage: "drafted",
      label: "Proposal created",
      date: proposal.createdAt,
      complete: true,
      current: proposal.status === "draft",
    },
  ];

  if (proposal.votingStartsAt) {
    items.push({
      stage: "active",
      label: "Voting starts",
      date: proposal.votingStartsAt,
      complete: proposal.status !== "draft",
      current: proposal.status === "active",
    });
  }

  if (proposal.votingEndsAt) {
    items.push({
      stage: "succeeded",
      label: "Voting ends",
      date: proposal.votingEndsAt,
      complete:
        proposal.status === "succeeded" ||
        proposal.status === "queued" ||
        proposal.status === "executed",
      current: proposal.status === "succeeded",
    });
  }

  if (proposal.queuedAt) {
    items.push({
      stage: "queued",
      label: "Queued",
      date: proposal.queuedAt,
      complete: proposal.status === "queued" || proposal.status === "executed",
      current: proposal.status === "queued",
    });
  }

  if (proposal.executableAt) {
    items.push({
      stage: "executable",
      label: "Executable",
      date: proposal.executableAt,
      complete: proposal.status === "executed",
      current: proposal.status === "queued",
    });
  }

  return items;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const recentProposals = (await getProposals("all")).slice(0, 4);

  return {
    wallet: {
      connectionLabel: "Governance member",
      address: "Available in account",
      delegateLabel: "Based on onchain delegation",
      votingPower: "Available on proposal detail",
      participationRate: "Not available yet",
      lastAction: "Recent activity shown below",
    },
    votingPower: {
      totalVotingPower: "Not available yet",
      delegatedPower: "Not available yet",
      quorumReference: "Onchain governor threshold applies",
      shareOfQuorum: "Not available yet",
    },
    protocolStatus: await getProtocolStatus(),
    recentProposals,
    recentActivity: await getRecentGovernanceActivity(),
  };
}

export async function getProposals(
  filter: ProposalFilterOption = "all",
): Promise<ProposalSummary[]> {
  const summaries = (await getStoredProposalRecords()).map(toSummary);

  if (filter === "all") {
    return summaries;
  }

  return summaries.filter((proposal) => proposal.status === filter);
}

export async function getProposalById(
  id: string,
): Promise<ProposalDetail | null> {
  const record = await db.proposalRecord.findUnique({
    where: {
      proposalId: id,
    },
    select: {
      id: true,
      proposalId: true,
      title: true,
      excerpt: true,
      description: true,
      category: true,
      proposerLabel: true,
      createdAt: true,
      updatedAt: true,
      votingStartsAt: true,
      votingEndsAt: true,
      queuedAt: true,
      executableAt: true,
      executedAt: true,
      canceledAt: true,
      defeatedAt: true,
      governorTxHash: true,
    },
  });

  if (!record) {
    return null;
  }

  const summary = toSummary(record);

  return {
    ...summary,
    description: record.description
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    tags: [getProposalCategoryLabel(record.category)],
    contractSummary: "Governor proposal recorded with app metadata.",
    votes: {
      for: 0,
      against: 0,
      abstain: 0,
      quorum: 0,
      totalParticipating: 0,
    },
    timeline: buildTimeline(summary),
    actionsLabel: summary.statusLabel,
  };
}

export async function getProposalTimeline(
  proposalId: string,
): Promise<ProposalTimelineEvent[]> {
  const proposal = await getProposalById(proposalId);

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
  const proposals = (await getStoredProposalRecords()).slice(0, 10);

  return proposals.map((record) => ({
    id: `proposal-created-${record.proposalId}`,
    type: "proposal_created",
    title: record.title,
    description: `${record.proposerLabel} created a ${getProposalCategoryLabel(
      record.category,
    )} proposal.`,
    occurredAt: record.createdAt.toISOString(),
    relatedProposalId: record.proposalId,
    relatedProposalCategory: record.category,
    tone: "default",
  }));
}

export async function getProtocolStatus(): Promise<ProtocolStatusItem[]> {
  const proposals = await getStoredProposalRecords();

  return [
    {
      label: "Proposal throughput",
      value: `${proposals.length} recorded proposal${
        proposals.length === 1 ? "" : "s"
      }`,
      tone: proposals.length > 0 ? "success" : "default",
      helpText: "Counts proposal metadata saved in the app companion layer.",
    },
    {
      label: "Category coverage",
      value: `${
        new Set(proposals.map((item) => item.category)).size
      } categories used`,
      tone: "info",
      helpText: "Shows how many proposal categories are represented so far.",
    },
    {
      label: "Metadata source",
      value: "Prisma companion store",
      tone: "pending",
      helpText:
        "Governor state stays onchain while proposal metadata is stored offchain.",
    },
  ];
}
