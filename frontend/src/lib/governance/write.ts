"use client";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import governorAbi from "@/abi/MyGovernor.json";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
} from "@/lib/web3/contracts";
import { getMagicWalletClient } from "@/lib/web3/magic-wallet-client";
import type { Address, Hex } from "viem";

export async function delegateToSelf(walletAddress: Address) {
  const walletClient = await getMagicWalletClient();

  return walletClient.writeContract({
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: governanceTokenAbi,
    functionName: "delegate",
    args: [walletAddress],
    account: walletAddress,
  });
}

export async function castProposalVote(input: {
  walletAddress: Address;
  proposalId: bigint;
  support: 0 | 1 | 2;
}) {
  const walletClient = await getMagicWalletClient();

  return walletClient.writeContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "castVote",
    args: [input.proposalId, input.support],
    account: input.walletAddress,
  });
}

export async function queueProposal(input: {
  walletAddress: Address;
  targets: Address[];
  values: bigint[];
  calldatas: Hex[];
  descriptionHash: Hex;
}) {
  const walletClient = await getMagicWalletClient();

  return walletClient.writeContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "queue",
    args: [input.targets, input.values, input.calldatas, input.descriptionHash],
    account: input.walletAddress,
  });
}

export async function executeProposal(input: {
  walletAddress: Address;
  targets: Address[];
  values: bigint[];
  calldatas: Hex[];
  descriptionHash: Hex;
}) {
  const walletClient = await getMagicWalletClient();

  return walletClient.writeContract({
    address: MY_GOVERNOR_ADDRESS,
    abi: governorAbi,
    functionName: "execute",
    args: [input.targets, input.values, input.calldatas, input.descriptionHash],
    account: input.walletAddress,
  });
}
