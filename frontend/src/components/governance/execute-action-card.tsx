"use client";

import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";
import type { ProposalSummary } from "@/types/governance";
import { BrowserProvider, Contract } from "ethers";
import { useState, useTransition } from "react";

type ExecuteActionCardProps = {
  proposal: ProposalSummary;
  onExecuted?: (proposalId: string) => void;
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

export function ExecuteActionCard({
  proposal,
  onExecuted,
}: ExecuteActionCardProps) {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState(
    "Confirm execution to validate the proposal.",
  );
  const [isPending, startTransition] = useTransition();

  if (proposal.status !== "queued") {
    return null;
  }

  const disabled = isPending || status === "success";

  const buttonClassName =
    status === "success"
      ? "button-2 button--secondary"
      : "button-2 button--primary";

  function handleExecute() {
    setStatus("submitting");
    setMessage("Confirm proposal execution...");

    startTransition(async () => {
      try {
        await submitExecutionOnchain(proposal.id);
        setStatus("success");
        setMessage("Proposal executed successfully.");

        window.setTimeout(() => {
          onExecuted?.(proposal.id);
        }, 300);
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
    <div className="action-panel action-panel--interactive action-panel--queue">
      <div className="action-panel__row action-panel__row--queue">
        <span>Execution status</span>
        <strong
          className={`action-panel__status-message${
            status === "success"
              ? " action-panel__status-message--success"
              : status === "error"
              ? " action-panel__status-message--error"
              : ""
          }`}
        >
          {message}
        </strong>
      </div>

      <div className="action-panel__actions">
        <button
          type="button"
          className={buttonClassName}
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
