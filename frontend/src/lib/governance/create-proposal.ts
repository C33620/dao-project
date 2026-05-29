import myGovernorAbi from "@/abi/MyGovernor.json";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";
import { encodeFunctionData, keccak256, stringToHex } from "viem";

export type ProposalOrigin = "dashboard" | "proposals";

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

export function buildProposalAction() {
  const calldata = encodeFunctionData({
    abi: myGovernorAbi,
    functionName: "setVotingPeriod",
    args: [2900],
  });

  return {
    targets: [MY_GOVERNOR_ADDRESS],
    values: [BigInt(0)],
    calldatas: [calldata],
  };
}

export function buildDescriptionHash(description: string) {
  return keccak256(stringToHex(description));
}

export function getProposalReturnHref(origin: ProposalOrigin) {
  return origin === "dashboard" ? "/app/dashboard" : "/app/proposals";
}
