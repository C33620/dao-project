"use client";

import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";

import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";

export type GovernanceActionIntent = "queue" | "execute";

type GovernancePayloadResponse = {
  ok: boolean;
  payload?: {
    proposalId: string;
    description: string;
    descriptionHash: string;
    targets: string[];
    values: string[];
    calldatas: string[];
  };
  error?: string;
};

const EXPECTED_CHAIN_ID = BigInt(
  process.env.NEXT_PUBLIC_GOVERNANCE_CHAIN_ID ?? "11155111",
);

function getReceiptProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Sepolia RPC URL is not configured on the frontend.");
  }

  return new JsonRpcProvider(rpcUrl);
}

async function waitForReceiptWithFallback(
  txHash: string,
  provider: JsonRpcProvider,
  timeoutMs = 90_000,
  attempts = 6,
  delayMs = 5_000,
) {
  const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs);

  if (receipt) {
    return receipt;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const fallbackReceipt = await provider.getTransactionReceipt(txHash);

    if (fallbackReceipt) {
      return fallbackReceipt;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `Transaction was submitted but no receipt was found yet. Hash: ${txHash}`,
  );
}

async function fetchGovernancePayload(
  proposalId: string,
  intent: GovernanceActionIntent,
) {
  const route =
    intent === "queue"
      ? `/api/proposals/${proposalId}/queue-payload`
      : `/api/proposals/${proposalId}/execute-payload`;

  const response = await fetch(route, {
    method: "GET",
    cache: "no-store",
  });

  const result = (await response.json()) as GovernancePayloadResponse;

  if (!response.ok || !result.ok || !result.payload) {
    throw new Error(result.error ?? "Failed to load governance payload.");
  }

  return result.payload;
}

export function normalizeGovernanceActionError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  if (message.includes("user rejected") || message.includes("user denied")) {
    return "The wallet confirmation was cancelled.";
  }

  if (
    message.includes("wrong network") ||
    message.includes("chain") ||
    message.includes("network")
  ) {
    return "Switch to the governance network and try again.";
  }

  if (message.includes("insufficient funds")) {
    return "This wallet does not have enough gas to complete the transaction.";
  }

  if (
    message.includes("replacement fee too low") ||
    message.includes("replacement transaction underpriced") ||
    message.includes("pending transaction") ||
    message.includes("nonce")
  ) {
    return "This wallet already has a pending transaction. Please wait for it to confirm before trying again.";
  }

  if (
    message.includes("proposal_not_queueable") ||
    message.includes("proposal_not_executable") ||
    message.includes("queue_payload_not_found") ||
    message.includes("execution_payload_not_found")
  ) {
    return "This proposal is no longer ready for this action. Refresh and try again.";
  }

  if (message.includes("transaction_not_confirmed")) {
    return "Transaction confirmation is still pending. Please wait before trying again.";
  }

  if (
    message.includes("proposal_not_queued") ||
    message.includes("proposal_not_executed")
  ) {
    return "Transaction confirmed, but proposal status is still refreshing. Please do not resubmit.";
  }

  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong.";
}

export async function submitGovernanceAction(
  proposalId: string,
  intent: GovernanceActionIntent,
) {
  const payload = await fetchGovernancePayload(proposalId, intent);

  const magic = getMagicClient();
  const provider = new BrowserProvider(magic.rpcProvider);
  const network = await provider.getNetwork();

  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error("Wrong network");
  }

  const signer = await provider.getSigner();
  const receiptProvider = getReceiptProvider();
  const governorContract = new Contract(
    MY_GOVERNOR_ADDRESS,
    myGovernorAbi,
    signer,
  );

  const tx =
    intent === "queue"
      ? await governorContract.queue(
          payload.targets,
          payload.values.map((value) => BigInt(value)),
          payload.calldatas,
          payload.descriptionHash,
        )
      : await governorContract.execute(
          payload.targets,
          payload.values.map((value) => BigInt(value)),
          payload.calldatas,
          payload.descriptionHash,
        );

  await waitForReceiptWithFallback(tx.hash, receiptProvider);

  const finalizeResponse = await fetch(
    `/api/proposals/${proposalId}/finalize-governance-action`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent,
        txHash: tx.hash,
      }),
    },
  );

  const finalizeResult = (await finalizeResponse.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
  } | null;

  if (!finalizeResponse.ok || !finalizeResult?.ok) {
    throw new Error(
      finalizeResult?.error ??
        "Transaction confirmed, but proposal status is still refreshing. Please do not resubmit.",
    );
  }

  return { txHash: tx.hash };
}
