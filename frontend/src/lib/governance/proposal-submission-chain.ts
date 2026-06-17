import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";
import {
  BrowserProvider,
  Contract,
  Interface,
  JsonRpcProvider,
  type TransactionReceipt,
} from "ethers";

function isBigInt(value: unknown): value is bigint {
  return typeof value === "bigint";
}

export function getReceiptProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Sepolia RPC URL is not configured on the frontend.");
  }

  return new JsonRpcProvider(rpcUrl);
}

type WaitForReceiptResult =
  | {
      status: "confirmed";
      receipt: TransactionReceipt;
    }
  | {
      status: "pending";
      txHash: string;
      reason: "timeout";
    };

export async function waitForReceiptWithFallback(
  txHash: string,
  provider: JsonRpcProvider,
  timeoutMs = 90_000,
  attempts = 6,
  delayMs = 5_000,
): Promise<WaitForReceiptResult> {
  try {
    const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs);

    if (receipt) {
      return {
        status: "confirmed",
        receipt: receipt as TransactionReceipt,
      };
    }
  } catch (error) {
    const maybeTimeout =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "TIMEOUT";

    if (!maybeTimeout) {
      throw error;
    }
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const fallbackReceipt = await provider.getTransactionReceipt(txHash);

    if (fallbackReceipt) {
      return {
        status: "confirmed",
        receipt: fallbackReceipt as TransactionReceipt,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return {
    status: "pending",
    txHash,
    reason: "timeout",
  };
}

export function extractProposalIdFromReceipt(receipt: unknown): bigint | null {
  if (!receipt || typeof receipt !== "object" || !("logs" in receipt)) {
    return null;
  }

  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const governorInterface = new Interface(myGovernorAbi);

  for (const log of logs) {
    if (
      !log ||
      typeof log !== "object" ||
      !("address" in log) ||
      !("topics" in log) ||
      !("data" in log)
    ) {
      continue;
    }

    if (
      typeof log.address !== "string" ||
      log.address.toLowerCase() !== MY_GOVERNOR_ADDRESS.toLowerCase()
    ) {
      continue;
    }

    if (!Array.isArray(log.topics)) {
      continue;
    }

    try {
      const parsedLog = governorInterface.parseLog({
        topics: log.topics as string[],
        data: typeof log.data === "string" ? log.data : "0x",
      });

      if (parsedLog?.name !== "ProposalCreated") {
        continue;
      }

      const proposalId = parsedLog.args?.proposalId ?? parsedLog.args?.[0];

      if (isBigInt(proposalId)) {
        return proposalId;
      }
    } catch (error) {
      console.error("PROPOSAL_CREATED_EVENT_DECODE_ERROR", error);
    }
  }

  return null;
}

export async function deriveProposalId({
  targets,
  values,
  calldatas,
  descriptionHash,
}: {
  targets: readonly `0x${string}`[];
  values: readonly bigint[];
  calldatas: readonly `0x${string}`[];
  descriptionHash: `0x${string}`;
}): Promise<bigint | null> {
  try {
    const magic = getMagicClient();
    const provider = new BrowserProvider(magic.rpcProvider);
    const governorContract = new Contract(
      MY_GOVERNOR_ADDRESS,
      myGovernorAbi,
      provider,
    );

    if (typeof governorContract.getProposalId === "function") {
      const proposalId = await governorContract.getProposalId(
        targets,
        values,
        calldatas,
        descriptionHash,
      );

      if (isBigInt(proposalId)) {
        return proposalId;
      }
    }

    if (typeof governorContract.hashProposal === "function") {
      const proposalId = await governorContract.hashProposal(
        targets,
        values,
        calldatas,
        descriptionHash,
      );

      if (isBigInt(proposalId)) {
        return proposalId;
      }
    }
  } catch (error) {
    console.error("PROPOSAL_ID_DERIVATION_ERROR", error);
  }

  return null;
}
