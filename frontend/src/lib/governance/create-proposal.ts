import myGovernorAbi from "@/abi/MyGovernor.json";
import {
  APPROX_SECONDS_PER_BLOCK,
  MIN_VOTING_PERIOD_BLOCKS,
  MY_GOVERNOR_ADDRESS,
} from "@/lib/web3/contracts";
import { encodeFunctionData } from "viem";

export type ProposalOrigin = "dashboard" | "proposals";

export function hoursToBlocks(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) {
    return MIN_VOTING_PERIOD_BLOCKS;
  }

  return Math.max(
    MIN_VOTING_PERIOD_BLOCKS,
    Math.round((hours * 60 * 60) / APPROX_SECONDS_PER_BLOCK),
  );
}

export function blocksToApproxHours(blocks: bigint | number): number {
  const numericBlocks = typeof blocks === "bigint" ? Number(blocks) : blocks;
  return Number(((numericBlocks * APPROX_SECONDS_PER_BLOCK) / 3600).toFixed(1));
}

export function buildVotingPeriodProposalDescription(input: {
  title: string;
  summary: string;
  newVotingPeriodBlocks: number;
  newVotingPeriodHours: number;
}) {
  return [
    input.title.trim(),
    "",
    input.summary.trim(),
    "",
    `Requested change: update the voting period to approximately ${input.newVotingPeriodHours} hours (${input.newVotingPeriodBlocks} blocks).`,
  ].join("\n");
}

export function buildVotingPeriodProposalAction(newVotingPeriodBlocks: number) {
  const calldata = encodeFunctionData({
    abi: myGovernorAbi,
    functionName: "setVotingPeriod",
    args: [newVotingPeriodBlocks],
  });

  return {
    targets: [MY_GOVERNOR_ADDRESS],
    values: [BigInt(0)],
    calldatas: [calldata],
  };
}

export function getProposalReturnHref(origin: ProposalOrigin) {
  return origin === "dashboard" ? "/app/dashboard" : "/app/proposals";
}
