import myGovernorAbi from "@/abi/MyGovernor.json";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";
import type { ProposalCategory } from "@/types/governance";
import {
  encodeFunctionData,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";

export type ProposalOrigin = "dashboard" | "proposals";
export type ProposalMode = "standard" | "cancel";

export type PersistedProposalAction = {
  targets: Address[];
  values: bigint[];
  calldatas: Hex[];
  descriptionHash: Hex;
};

export const PROPOSAL_CATEGORY_OPTIONS: Array<{
  value: ProposalCategory;
  label: string;
}> = [
  { value: "COFFEE_MEETUP", label: "Coffee Meetup" },
  { value: "HACK_DAY", label: "Hack Day" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "OTHER", label: "Other" },
];

export function getProposalCategoryLabel(category: ProposalCategory) {
  const option = PROPOSAL_CATEGORY_OPTIONS.find(
    (item) => item.value === category,
  );
  return option?.label ?? "Other";
}

export function buildProposalTitle(input: string) {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : "Untitled proposal";
}

export function buildProposalSummary(input: string) {
  return input.trim();
}

export function buildProposalDescription(input: {
  proposalText: string;
  details: string;
}) {
  const sections = [buildProposalTitle(input.proposalText), ""];

  if (input.details.trim().length > 0) {
    sections.push(buildProposalSummary(input.details), "");
  }

  sections.push("Submitted through the governance proposal flow.");

  return sections.join("\n");
}

function buildStandardProposalAction() {
  const calldata = encodeFunctionData({
    abi: myGovernorAbi,
    functionName: "setVotingPeriod",
    args: [2900],
  });

  return {
    targets: [MY_GOVERNOR_ADDRESS as Address],
    values: [BigInt(0)],
    calldatas: [calldata as Hex],
  };
}

function buildCancelProposalAction() {
  const calldata = encodeFunctionData({
    abi: myGovernorAbi,
    functionName: "setVotingPeriod",
    args: [2900],
  });

  return {
    targets: [MY_GOVERNOR_ADDRESS as Address],
    values: [BigInt(0)],
    calldatas: [calldata as Hex],
  };
}

export function buildDescriptionHash(description: string) {
  return keccak256(stringToHex(description));
}

export function buildPersistedProposalAction(input: {
  mode: ProposalMode;
  description: string;
}): PersistedProposalAction {
  const action =
    input.mode === "cancel"
      ? buildCancelProposalAction()
      : buildStandardProposalAction();

  return {
    ...action,
    descriptionHash: buildDescriptionHash(input.description),
  };
}

export function getProposalReturnHref(origin: ProposalOrigin) {
  return origin === "dashboard" ? "/app/dashboard" : "/app/proposals";
}
