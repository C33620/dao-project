import "server-only";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import governorAbi from "@/abi/MyGovernor.json";
import { getCurrentUser } from "@/lib/auth";
import { getBlockchainClient } from "@/lib/blockchain/client";
import { db } from "@/lib/db";
import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
} from "@/lib/web3/contracts";
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
import type { Address, Hex } from "viem";

export type ProposalTimelineEvent = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
};

type GovernorState =
  | "pending"
  | "active"
  | "canceled"
  | "defeated"
  | "succeeded"
  | "queued"
  | "expired"
  | "executed";

type StoredProposalRecord = Awaited<
  ReturnType<typeof getStoredProposalRecords>
>[number];

type EnrichedProposal = {
  summary: ProposalSummary;
  detailVotes: ProposalDetail["votes"];
  timeline: ProposalDetail["timeline"];
  actionsLabel: string;
  descriptionParagraphs: string[];
  flags: {
    canVote: boolean;
    hasVoted: boolean;
    canQueue: boolean;
    canExecute: boolean;
    needsDelegation: boolean;
    userVotingPower: bigint;
    snapshotBlock: bigint | null;
  };
};

type GovernanceClockMode = "timestamp" | "blocknumber" | "unknown";

const ESTIMATED_BLOCK_TIME_SECONDS = BigInt(12);

function mapGovernorState(value: number): GovernorState {
  switch (value) {
    case 0:
      return "pending";
    case 1:
      return "active";
    case 2:
      return "canceled";
    case 3:
      return "defeated";
    case 4:
      return "succeeded";
    case 5:
      return "queued";
    case 6:
      return "expired";
    case 7:
      return "executed";
    default:
      return "pending";
  }
}

function governorStateToProposalStatus(state: GovernorState): ProposalStatus {
  switch (state) {
    case "pending":
      return "pending";
    case "active":
      return "active";
    case "queued":
      return "queued";
    case "succeeded":
      return "succeeded";
    case "executed":
      return "executed";
    case "defeated":
    case "expired":
      return "defeated";
    case "canceled":
      return "canceled";
    default:
      return "draft";
  }
}

function mapStatus(status: ProposalStatus): {
  statusLabel: string;
  statusTone: StatusTone;
} {
  switch (status) {
    case "pending":
      return { statusLabel: "Waiting", statusTone: "pending" };
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
      descriptionHash: true,
      category: true,
      proposerLabel: true,
      proposerAddress: true,
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
      governorAddress: true,
      targets: true,
      values: true,
      calldatas: true,
    },
  });
}

export async function getExecutableProposals(): Promise<ProposalSummary[]> {
  const records = await getStoredProposalRecords();
  const currentUserWallet = await getCurrentUserWalletAddress();
  const enriched: EnrichedProposal[] = [];

  for (const record of records) {
    try {
      const proposal = await enrichProposal(record, currentUserWallet);
      enriched.push(proposal);
    } catch (error) {
      console.error(
        "GET_EXECUTABLE_PROPOSALS_ENRICH_ERROR",
        record.proposalId,
        error,
      );
    }
  }

  return enriched
    .filter((proposal) => proposal.flags.canExecute)
    .map((proposal) => proposal.summary);
}

async function getCurrentUserWalletAddress() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      walletAddress: true,
    },
  });

  return fullUser?.walletAddress ?? null;
}

function formatReadableDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function detectClockMode(
  clockModeValue: string | null | undefined,
): GovernanceClockMode {
  if (!clockModeValue) {
    return "unknown";
  }

  const normalized = clockModeValue.toLowerCase();

  if (normalized.includes("mode=timestamp")) {
    return "timestamp";
  }

  if (normalized.includes("mode=blocknumber")) {
    return "blocknumber";
  }

  return "unknown";
}

function formatTimepointFromClockMode(
  timepoint: bigint | null,
  clockMode: GovernanceClockMode,
  currentBlockNumber?: bigint,
  currentBlockTimestampSeconds?: bigint,
): string | undefined {
  if (timepoint === null || timepoint <= BigInt(0)) {
    return undefined;
  }

  if (clockMode === "timestamp") {
    return formatReadableDate(new Date(Number(timepoint) * 1000));
  }

  if (
    clockMode === "blocknumber" &&
    currentBlockNumber !== undefined &&
    currentBlockTimestampSeconds !== undefined
  ) {
    const blockDelta = timepoint - currentBlockNumber;
    const estimatedTimestamp =
      currentBlockTimestampSeconds +
      (blockDelta > BigInt(0)
        ? blockDelta * ESTIMATED_BLOCK_TIME_SECONDS
        : BigInt(0));

    return formatReadableDate(new Date(Number(estimatedTimestamp) * 1000));
  }

  return undefined;
}

function formatEtaToDisplay(secondsValue: bigint | null) {
  if (secondsValue === null || secondsValue <= BigInt(0)) {
    return undefined;
  }

  return formatReadableDate(new Date(Number(secondsValue) * 1000));
}

function safeJsonStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (!value.every((item) => typeof item === "string")) {
    return null;
  }

  return value;
}

async function enrichProposal(
  record: StoredProposalRecord,
  currentUserWallet: string | null,
): Promise<EnrichedProposal> {
  const client = getBlockchainClient();
  const proposalId = BigInt(record.proposalId);

  const rawState = (await client.readContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "state",
    args: [proposalId],
  })) as number;

  const snapshot = (await client.readContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "proposalSnapshot",
    args: [proposalId],
  })) as bigint;

  const deadline = (await client.readContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "proposalDeadline",
    args: [proposalId],
  })) as bigint;

  const eta = (await client.readContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "proposalEta",
    args: [proposalId],
  })) as bigint;

  const needsQueuing = (await client.readContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "proposalNeedsQueuing",
    args: [proposalId],
  })) as boolean;

  const voteTotals = (await client.readContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "proposalVotes",
    args: [proposalId],
  })) as [bigint, bigint, bigint];

  const clockModeRaw = (await client.readContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "CLOCK_MODE",
  })) as string;

  const clockMode = detectClockMode(clockModeRaw);

  const currentBlockNumber = await client.getBlockNumber();
  const currentBlock = await client.getBlock({
    blockNumber: currentBlockNumber,
  });
  const currentBlockTimestampSeconds = currentBlock.timestamp;

  const governorState = mapGovernorState(rawState);
  const status = governorStateToProposalStatus(governorState);
  const statusView = mapStatus(status);

  let hasVoted = false;
  let userVotingPower = BigInt(0);
  let needsDelegation = false;

  if (currentUserWallet) {
    const voter = currentUserWallet as Address;

    const hasUserVoted = (await client.readContract({
      address: MY_GOVERNOR_ADDRESS,
      abi: governorAbi,
      functionName: "hasVoted",
      args: [proposalId, voter],
    })) as boolean;

    const delegatee = (await client.readContract({
      address: GOVERNANCE_TOKEN_ADDRESS,
      abi: governanceTokenAbi,
      functionName: "delegates",
      args: [voter],
    })) as Address;

    const currentVotes = (await client.readContract({
      address: GOVERNANCE_TOKEN_ADDRESS,
      abi: governanceTokenAbi,
      functionName: "getVotes",
      args: [voter],
    })) as bigint;

    const balance = (await client.readContract({
      address: GOVERNANCE_TOKEN_ADDRESS,
      abi: governanceTokenAbi,
      functionName: "balanceOf",
      args: [voter],
    })) as bigint;

    const tokenClock = (await client.readContract({
      address: GOVERNANCE_TOKEN_ADDRESS,
      abi: governanceTokenAbi,
      functionName: "clock",
    })) as bigint;

    let snapshotVotes = BigInt(0);

    if (snapshot <= tokenClock) {
      try {
        snapshotVotes = (await client.readContract({
          address: GOVERNANCE_TOKEN_ADDRESS,
          abi: governanceTokenAbi,
          functionName: "getPastVotes",
          args: [voter, snapshot],
        })) as bigint;
      } catch (error) {
        console.error("GET_PAST_VOTES_READ_ERROR", error);
        snapshotVotes = BigInt(0);
      }
    }

    hasVoted = hasUserVoted;
    userVotingPower = snapshotVotes;
    needsDelegation =
      balance > BigInt(0) &&
      (delegatee.toLowerCase() !== voter.toLowerCase() ||
        currentVotes === BigInt(0));
  }

  const canVote =
    governorState === "active" && !hasVoted && userVotingPower > BigInt(0);

  const canQueue = governorState === "succeeded" && needsQueuing;

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const canExecute =
    governorState === "queued" && eta > BigInt(0) && eta <= nowSeconds;

  const votingStartsAt = record.votingStartsAt
    ? formatReadableDate(record.votingStartsAt)
    : formatTimepointFromClockMode(
        snapshot,
        clockMode,
        currentBlockNumber,
        currentBlockTimestampSeconds,
      );

  const votingEndsAt = record.votingEndsAt
    ? formatReadableDate(record.votingEndsAt)
    : formatTimepointFromClockMode(
        deadline,
        clockMode,
        currentBlockNumber,
        currentBlockTimestampSeconds,
      );

  const executableAt = record.executableAt
    ? formatReadableDate(record.executableAt)
    : formatEtaToDisplay(eta);

  const queuedAt = record.queuedAt
    ? formatReadableDate(record.queuedAt)
    : undefined;

  const actionsLabel = canVote
    ? "Vote available"
    : canQueue
    ? "Ready to queue"
    : canExecute
    ? "Ready to execute"
    : governorState === "pending"
    ? "Actions will appear once voting is active."
    : statusView.statusLabel;

  const summary: ProposalSummary = {
    id: record.proposalId,
    slug: record.proposalId,
    title: record.title,
    excerpt: record.excerpt,
    status,
    statusLabel: statusView.statusLabel,
    statusTone: statusView.statusTone,
    category: record.category,
    proposer: record.proposerLabel || record.proposerAddress,
    createdAt: formatReadableDate(record.createdAt),
    votingStartsAt,
    votingEndsAt,
    queuedAt,
    executableAt,
    actionsLabel,
    hasVoted,
  };

  const timeline: ProposalDetail["timeline"] = [
    {
      stage: "drafted",
      label: "Proposal created",
      date: formatReadableDate(record.createdAt),
      complete: true,
      current: governorState === "pending",
    },
  ];

  if (votingStartsAt) {
    timeline.push({
      stage: "active",
      label: `Voting starts: ${votingStartsAt}`,
      date: votingStartsAt,
      complete: governorState !== "pending",
      current: governorState === "active",
    });
  }

  if (votingEndsAt) {
    timeline.push({
      stage: "succeeded",
      label: `Voting ends: ${votingEndsAt}`,
      date: votingEndsAt,
      complete: [
        "succeeded",
        "queued",
        "executed",
        "defeated",
        "canceled",
        "expired",
      ].includes(governorState),
      current: governorState === "succeeded",
    });
  }

  if (queuedAt) {
    timeline.push({
      stage: "queued",
      label: "Queued",
      date: queuedAt,
      complete: ["queued", "executed"].includes(governorState),
      current: governorState === "queued" && !canExecute,
    });
  }

  if (executableAt) {
    timeline.push({
      stage: "executable",
      label: "Executable",
      date: executableAt,
      complete: governorState === "executed",
      current: canExecute,
    });
  }

  return {
    summary,
    detailVotes: {
      for: Number(voteTotals[1]),
      against: Number(voteTotals[0]),
      abstain: Number(voteTotals[2]),
      quorum: 0,
      totalParticipating: Number(voteTotals[0] + voteTotals[1] + voteTotals[2]),
    },
    timeline,
    actionsLabel,
    descriptionParagraphs: record.description
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    flags: {
      canVote,
      hasVoted,
      canQueue,
      canExecute,
      needsDelegation,
      userVotingPower,
      snapshotBlock: snapshot,
    },
  };
}

function includeByFilter(
  proposal: EnrichedProposal,
  filter: ProposalFilterOption,
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "active") {
    return proposal.summary.status === "active";
  }

  if (filter === "queued") {
    return proposal.flags.canQueue || proposal.summary.status === "queued";
  }

  return proposal.summary.status === filter;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const recentProposals = (await getProposals("all")).slice(0, 4);

  return {
    wallet: {
      connectionLabel: "Governance member",
      address: "Available in account",
      delegateLabel: "Based on onchain delegation",
      votingPower: "Available on proposal detail",
      participationRate: "Onchain vote history",
      lastAction: "Recent activity shown below",
    },
    votingPower: {
      totalVotingPower: "Onchain token supply",
      delegatedPower: "Onchain delegated votes",
      quorumReference: "Governor quorum at snapshot",
      shareOfQuorum: "Calculated per proposal",
    },
    protocolStatus: await getProtocolStatus(),
    recentProposals,
    recentActivity: await getRecentGovernanceActivity("all"),
  };
}

export async function getProposals(
  filter: ProposalFilterOption = "all",
): Promise<ProposalSummary[]> {
  const records = await getStoredProposalRecords();
  const currentUserWallet = await getCurrentUserWalletAddress();
  const enriched: EnrichedProposal[] = [];

  for (const record of records) {
    try {
      const proposal = await enrichProposal(record, currentUserWallet);
      enriched.push(proposal);
    } catch (error) {
      console.error("GET_PROPOSALS_ENRICH_ERROR", record.proposalId, error);
    }
  }

  return enriched
    .filter((proposal) => includeByFilter(proposal, filter))
    .map((proposal) => proposal.summary);
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
      descriptionHash: true,
      category: true,
      proposerLabel: true,
      proposerAddress: true,
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
      governorAddress: true,
      targets: true,
      values: true,
      calldatas: true,
    },
  });

  if (!record) {
    return null;
  }

  const currentUserWallet = await getCurrentUserWalletAddress();
  const enriched = await enrichProposal(record, currentUserWallet);

  return {
    ...enriched.summary,
    description: enriched.descriptionParagraphs,
    tags: [getProposalCategoryLabel(record.category)],
    contractSummary: "Governor lifecycle and vote status are read onchain.",
    votes: enriched.detailVotes,
    timeline: enriched.timeline,
    actionsLabel: enriched.actionsLabel,
    governance: {
      canVote: enriched.flags.canVote,
      hasVoted: enriched.flags.hasVoted,
      canQueue: enriched.flags.canQueue,
      canExecute: enriched.flags.canExecute,
      needsDelegation: enriched.flags.needsDelegation,
      userVotingPower: enriched.flags.userVotingPower.toString(),
      snapshotBlock: enriched.flags.snapshotBlock?.toString(),
    },
  };
}

export async function getProposalExecutionPayload(proposalId: string) {
  const record = await db.proposalRecord.findUnique({
    where: { proposalId },
    select: {
      proposalId: true,
      description: true,
      descriptionHash: true,
      targets: true,
      values: true,
      calldatas: true,
    },
  });

  if (!record) {
    return null;
  }

  const targets = safeJsonStringArray(record.targets) as Address[] | null;
  const values =
    safeJsonStringArray(record.values)?.map((item) => BigInt(item)) ?? null;
  const calldatas = safeJsonStringArray(record.calldatas) as Hex[] | null;

  if (!targets || !values || !calldatas || !record.descriptionHash) {
    return null;
  }

  return {
    proposalId: record.proposalId,
    description: record.description,
    descriptionHash: record.descriptionHash as Hex,
    targets,
    values,
    calldatas,
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
      description: "A new anonymous proposal was submitted for review.",
      timestamp: proposal.createdAt,
    },
  ];

  if (proposal.votingStartsAt) {
    timeline.push({
      id: `${proposal.id}-voting-starts`,
      title: "Voting opens",
      description:
        "The voting window is now controlled by the onchain governor.",
      timestamp: proposal.votingStartsAt,
    });
  }

  if (proposal.votingEndsAt) {
    timeline.push({
      id: `${proposal.id}-voting-ends`,
      title: "Voting closes",
      description: "The onchain voting period ends at this point.",
      timestamp: proposal.votingEndsAt,
    });
  }

  if (proposal.queuedAt) {
    timeline.push({
      id: `${proposal.id}-queued`,
      title: "Queued",
      description: "The proposal is queued in the timelock path.",
      timestamp: proposal.queuedAt,
    });
  }

  if (proposal.executableAt) {
    timeline.push({
      id: `${proposal.id}-executable`,
      title: "Executable",
      description:
        "The proposal can be executed once the timelock delay has passed.",
      timestamp: proposal.executableAt,
    });
  }

  return timeline;
}

export async function getRecentGovernanceActivity(
  filter: "all" | "voted" | "executed" = "all",
): Promise<GovernanceActivityItem[]> {
  const records = await getStoredProposalRecords();
  const currentUserWallet = await getCurrentUserWalletAddress();

  const enriched: EnrichedProposal[] = [];

  for (const record of records) {
    try {
      const proposal = await enrichProposal(record, currentUserWallet);
      enriched.push(proposal);
    } catch (error) {
      console.error(
        "RECENT_GOVERNANCE_ACTIVITY_ENRICH_ERROR",
        record.proposalId,
        error,
      );
    }
  }

  const filtered =
    filter === "voted"
      ? enriched.filter((item) => item.flags.hasVoted)
      : filter === "executed"
      ? enriched.filter((item) => item.summary.status === "executed")
      : enriched;

  return filtered.map((item) => ({
    id: `proposal-${item.summary.id}-${item.summary.status}`,
    type: "proposal_created",
    title: item.summary.title,
    description: item.summary.statusLabel,
    occurredAt: item.summary.createdAt,
    relatedProposalId: item.summary.id,
    relatedProposalCategory: item.summary.category,
    tone: item.summary.statusTone,
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
      helpText: "Counts proposal metadata saved in the companion store.",
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
      label: "Lifecycle source",
      value: "Onchain governor",
      tone: "success",
      helpText:
        "Proposal state, timing, and voting status are read from the governor contract.",
    },
  ];
}
