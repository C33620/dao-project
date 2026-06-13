"use client";

import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";
import type { ProposalSummary } from "@/types/governance";
import { BrowserProvider, Contract } from "ethers";
import { useState, useTransition } from "react";

type ExecuteActionCardProps = {
  proposal: ProposalSummary;
};

type ExecutePayloadResponse = {
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

async function fetchExecutionPayload(proposalId: string) {
  const response = await fetch(`/api/proposals/${proposalId}/execute-payload`, {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json()) as ExecutePayloadResponse;

  if (!response.ok || !data.ok || !data.payload) {
    throw new Error(data.error ?? "Failed to load execution payload.");
  }

  return data.payload;
}

async function submitExecutionOnchain(proposalId: string) {
  const payload = await fetchExecutionPayload(proposalId);

  const magic = getMagicClient();
  const provider = new BrowserProvider(magic.rpcProvider);
  const signer = await provider.getSigner();

  const governorContract = new Contract(
    MY_GOVERNOR_ADDRESS,
    myGovernorAbi,
    signer,
  );

  const tx = await governorContract.execute(
    payload.targets,
    payload.values.map((value) => BigInt(value)),
    payload.calldatas,
    payload.descriptionHash,
  );

  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error("Execution transaction receipt not found.");
  }
}

export function ExecuteActionCard({ proposal }: ExecuteActionCardProps) {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState(
    "Confirm execution to validate the proposal.",
  );
  const [isPending, startTransition] = useTransition();

  const disabled = isPending || proposal.status !== "queued";

  function handleExecute() {
    setStatus("submitting");
    setMessage("Confirm proposal execution...");

    startTransition(async () => {
      try {
        await submitExecutionOnchain(proposal.id);
        setStatus("success");
        setMessage("Proposal executed successfully.");
        window.setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (error) {
        const nextMessage =
          error instanceof Error
            ? error.message
            : "We could not execute this proposal.";

        setStatus("error");
        setMessage(nextMessage);
      }
    });
  }

  return (
    <div className="action-panel action-panel--interactive">
      <div className="action-panel__row">
        <span>Execution status</span>
        <strong>{message}</strong>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button-2 button--primary"
          disabled={disabled}
          onClick={handleExecute}
        >
          {isPending
            ? "Executing..."
            : status === "success"
            ? "Executed"
            : "Execute proposal"}
        </button>
      </div>
    </div>
  );
}
