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
import { unstable_cache } from "next/cache";
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

type SharedGovernanceContext = {
  clockMode: GovernanceClockMode;
  currentBlockNumber: bigint;
  currentBlockTimestampSeconds: bigint;
};

type UserGovernanceContext = {
  currentUserWallet: string | null;
  voterContext: {
    voter: Address;
    delegatee: Address;
    currentVotes: bigint;
    balance: bigint;
    tokenClock: bigint;
  } | null;
};

const ESTIMATED_BLOCK_TIME_SECONDS = BigInt(12);

export const GOVERNANCE_PROPOSALS_TAG = "governance-proposals";

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

async function withRpcRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 400,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit =
        message.includes("Too Many Requests") ||
        message.includes("Status: 429");

      if (!isRateLimit || attempt === retries) {
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function buildSharedGovernanceContext(): Promise<SharedGovernanceContext> {
  const client = getBlockchainClient();

  const [clockModeRaw, currentBlockNumber, currentBlock] = await withRpcRetry(
    async () => {
      const clockModePromise = client.readContract({
        address: MY_GOVERNOR_ADDRESS,
        abi: governorAbi,
        functionName: "CLOCK_MODE",
      }) as Promise<string>;

      const blockNumberPromise = client.getBlockNumber();

      const [clockMode, blockNumber] = await Promise.all([
        clockModePromise,
        blockNumberPromise,
      ]);

      const block = await client.getBlock({ blockNumber });

      return [clockMode, blockNumber, block] as const;
    },
  );

  return {
    clockMode: detectClockMode(clockModeRaw),
    currentBlockNumber,
    currentBlockTimestampSeconds: currentBlock.timestamp,
  };
}

async function buildUserGovernanceContext(): Promise<UserGovernanceContext> {
  const client = getBlockchainClient();
  const currentUserWallet = await getCurrentUserWalletAddress();

  if (!currentUserWallet) {
    return {
      currentUserWallet: null,
      voterContext: null,
    };
  }

  const voter = currentUserWallet as Address;

  const [delegatee, currentVotes, balance, tokenClock] = await withRpcRetry(
    async () => {
      const results = await client.multicall({
        contracts: [
          {
            address: GOVERNANCE_TOKEN_ADDRESS,
            abi: governanceTokenAbi,
            functionName: "delegates",
            args: [voter],
          },
          {
            address: GOVERNANCE_TOKEN_ADDRESS,
            abi: governanceTokenAbi,
            functionName: "getVotes",
            args: [voter],
          },
          {
            address: GOVERNANCE_TOKEN_ADDRESS,
            abi: governanceTokenAbi,
            functionName: "balanceOf",
            args: [voter],
          },
          {
            address: GOVERNANCE_TOKEN_ADDRESS,
            abi: governanceTokenAbi,
            functionName: "clock",
          },
        ],
        allowFailure: false,
      });

      return results as [Address, bigint, bigint, bigint];
    },
  );

  return {
    currentUserWallet,
    voterContext: {
      voter,
      delegatee,
      currentVotes,
      balance,
      tokenClock,
    },
  };
}

async function enrichProposal(
  record: StoredProposalRecord,
  sharedContext: SharedGovernanceContext,
  userContext?: UserGovernanceContext,
): Promise<EnrichedProposal> {
  const client = getBlockchainClient();
  const proposalId = BigInt(record.proposalId);

  const [rawState, snapshot, deadline, eta, needsQueuing, voteTotals] =
    await withRpcRetry(async () => {
      const results = await client.multicall({
        contracts: [
          {
            address: MY_GOVERNOR_ADDRESS,
            abi: governorAbi,
            functionName: "state",
            args: [proposalId],
          },
          {
            address: MY_GOVERNOR_ADDRESS,
            abi: governorAbi,
            functionName: "proposalSnapshot",
            args: [proposalId],
          },
          {
            address: MY_GOVERNOR_ADDRESS,
            abi: governorAbi,
            functionName: "proposalDeadline",
            args: [proposalId],
          },
          {
            address: MY_GOVERNOR_ADDRESS,
            abi: governorAbi,
            functionName: "proposalEta",
            args: [proposalId],
          },
          {
            address: MY_GOVERNOR_ADDRESS,
            abi: governorAbi,
            functionName: "proposalNeedsQueuing",
            args: [proposalId],
          },
          {
            address: MY_GOVERNOR_ADDRESS,
            abi: governorAbi,
            functionName: "proposalVotes",
            args: [proposalId],
          },
        ],
        allowFailure: false,
      });

      return results as [
        number,
        bigint,
        bigint,
        bigint,
        boolean,
        [bigint, bigint, bigint],
      ];
    });

  const governorState = mapGovernorState(rawState);
  const status = governorStateToProposalStatus(governorState);
  const statusView = mapStatus(status);

  let hasVoted = false;
  let userVotingPower = BigInt(0);
  let needsDelegation = false;

  if (userContext?.voterContext) {
    const { voter, delegatee, currentVotes, balance, tokenClock } =
      userContext.voterContext;

    const hasUserVoted = await withRpcRetry(
      () =>
        client.readContract({
          address: MY_GOVERNOR_ADDRESS,
          abi: governorAbi,
          functionName: "hasVoted",
          args: [proposalId, voter],
        }) as Promise<boolean>,
    );

    let snapshotVotes = BigInt(0);

    if (snapshot <= tokenClock) {
      try {
        snapshotVotes = await withRpcRetry(
          () =>
            client.readContract({
              address: GOVERNANCE_TOKEN_ADDRESS,
              abi: governanceTokenAbi,
              functionName: "getPastVotes",
              args: [voter, snapshot],
            }) as Promise<bigint>,
        );
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
        sharedContext.clockMode,
        sharedContext.currentBlockNumber,
        sharedContext.currentBlockTimestampSeconds,
      );

  const votingEndsAt = record.votingEndsAt
    ? formatReadableDate(record.votingEndsAt)
    : formatTimepointFromClockMode(
        deadline,
        sharedContext.clockMode,
        sharedContext.currentBlockNumber,
        sharedContext.currentBlockTimestampSeconds,
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

function buildProposalTimeline(
  proposal: ProposalDetail,
): ProposalTimelineEvent[] {
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

async function getExecutableProposalsUncached(): Promise<ProposalSummary[]> {
  const records = await getStoredProposalRecords();
  const sharedContext = await buildSharedGovernanceContext();
  const enriched: EnrichedProposal[] = [];

  for (const record of records) {
    try {
      const proposal = await enrichProposal(record, sharedContext);
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

async function getQueueableProposalsUncached(): Promise<ProposalSummary[]> {
  const records = await getStoredProposalRecords();
  const sharedContext = await buildSharedGovernanceContext();
  const enriched: EnrichedProposal[] = [];

  for (const record of records) {
    try {
      const proposal = await enrichProposal(record, sharedContext);
      enriched.push(proposal);
    } catch (error) {
      console.error(
        "GET_QUEUEABLE_PROPOSALS_ENRICH_ERROR",
        record.proposalId,
        error,
      );
    }
  }

  return enriched
    .filter((proposal) => proposal.flags.canQueue)
    .map((proposal) => proposal.summary);
}

async function getProposalsUncached(
  filter: ProposalFilterOption = "all",
): Promise<ProposalSummary[]> {
  const records = await getStoredProposalRecords();
  const [sharedContext, userContext] = await Promise.all([
    buildSharedGovernanceContext(),
    buildUserGovernanceContext(),
  ]);

  const enriched: EnrichedProposal[] = [];

  for (const record of records) {
    try {
      const proposal = await enrichProposal(record, sharedContext, userContext);
      enriched.push(proposal);
    } catch (error) {
      console.error("GET_PROPOSALS_ENRICH_ERROR", record.proposalId, error);
    }
  }

  return enriched
    .filter((proposal) => includeByFilter(proposal, filter))
    .map((proposal) => proposal.summary);
}

async function getRecentGovernanceActivityUncached(
  filter: "all" | "executed" = "all",
): Promise<GovernanceActivityItem[]> {
  const records = await getStoredProposalRecords();
  const sharedContext = await buildSharedGovernanceContext();
  const enriched: EnrichedProposal[] = [];

  for (const record of records) {
    try {
      const proposal = await enrichProposal(record, sharedContext);
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
    filter === "executed"
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

async function getRecentGovernanceActivityVotedForCurrentUser(): Promise<
  GovernanceActivityItem[]
> {
  const currentUserWallet = await getCurrentUserWalletAddress();

  if (!currentUserWallet) {
    return [];
  }

  const records = await getStoredProposalRecords();
  const [sharedContext, userContext] = await Promise.all([
    buildSharedGovernanceContext(),
    buildUserGovernanceContext(),
  ]);

  const enriched: EnrichedProposal[] = [];

  for (const record of records) {
    try {
      const proposal = await enrichProposal(record, sharedContext, userContext);
      enriched.push(proposal);
    } catch (error) {
      console.error(
        "RECENT_GOVERNANCE_ACTIVITY_VOTED_ENRICH_ERROR",
        record.proposalId,
        error,
      );
    }
  }

  return enriched
    .filter((item) => item.flags.hasVoted)
    .map((item) => ({
      id: `proposal-${item.summary.id}-voted`,
      type: "proposal_created",
      title: item.summary.title,
      description: "You voted on this proposal",
      occurredAt: item.summary.createdAt,
      relatedProposalId: item.summary.id,
      relatedProposalCategory: item.summary.category,
      tone: "success" as const,
    }));
}

const getExecutableProposalsCached = unstable_cache(
  async () => getExecutableProposalsUncached(),
  ["governance-executable-proposals"],
  { revalidate: 15, tags: [GOVERNANCE_PROPOSALS_TAG] },
);

const getQueueableProposalsCached = unstable_cache(
  async () => getQueueableProposalsUncached(),
  ["governance-queueable-proposals"],
  { revalidate: 15, tags: [GOVERNANCE_PROPOSALS_TAG] },
);

export async function getQueueableProposals(): Promise<ProposalSummary[]> {
  return getQueueableProposalsCached();
}

const getRecentGovernanceActivityCached = unstable_cache(
  async (filter: "all" | "executed") =>
    getRecentGovernanceActivityUncached(filter),
  ["governance-recent-activity"],
  { revalidate: 15, tags: [GOVERNANCE_PROPOSALS_TAG] },
);

export async function getExecutableProposals(): Promise<ProposalSummary[]> {
  return getExecutableProposalsCached();
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [recentProposals, protocolStatus, recentActivity] = await Promise.all([
    getProposals("all").then((items) => items.slice(0, 4)),
    getProtocolStatus(),
    getRecentGovernanceActivity("all"),
  ]);

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
    protocolStatus,
    recentProposals,
    recentActivity,
  };
}

export async function getProposals(
  filter: ProposalFilterOption = "all",
): Promise<ProposalSummary[]> {
  return getProposalsUncached(filter);
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

  const [sharedContext, userContext] = await Promise.all([
    buildSharedGovernanceContext(),
    buildUserGovernanceContext(),
  ]);

  const enriched = await enrichProposal(record, sharedContext, userContext);

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

  return buildProposalTimeline(proposal);
}

export async function getRecentGovernanceActivity(
  filter: "all" | "voted" | "executed" = "all",
): Promise<GovernanceActivityItem[]> {
  if (filter === "voted") {
    return getRecentGovernanceActivityVotedForCurrentUser();
  }

  return getRecentGovernanceActivityCached(
    filter === "executed" ? "executed" : "all",
  );
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
