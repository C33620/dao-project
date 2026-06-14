"use client";

import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";
import type { ProposalSummary } from "@/types/governance";
import { BrowserProvider, Contract } from "ethers";
import { useState } from "react";

type QueueActionCardProps = {
  proposal: ProposalSummary;
  onQueued?: (proposalId: string) => void;
};

type QueuePayloadResponse = {
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

async function fetchQueuePayload(proposalId: string) {
  const response = await fetch(`/api/proposals/${proposalId}/execute-payload`, {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json()) as QueuePayloadResponse;

  if (!response.ok || !data.ok || !data.payload) {
    throw new Error(data.error ?? "Failed to load queue payload.");
  }

  return data.payload;
}

export function QueueActionCard({ proposal, onQueued }: QueueActionCardProps) {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "submitted" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState(
    "This proposal passed and is ready to be queued.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedTx, setHasSubmittedTx] = useState(false);

  if (proposal.status !== "succeeded") {
    return null;
  }

  const disabled = isSubmitting || hasSubmittedTx;

  const buttonClassName =
    status === "submitted" || status === "success"
      ? "button-2 button--secondary"
      : "button-2 button--primary";

  async function handleQueue() {
    try {
      setIsSubmitting(true);
      setStatus("submitting");
      setMessage("Confirm queueing...");

      const payload = await fetchQueuePayload(proposal.id);

      const magic = getMagicClient();
      const provider = new BrowserProvider(magic.rpcProvider);
      const signer = await provider.getSigner();

      const governorContract = new Contract(
        MY_GOVERNOR_ADDRESS,
        myGovernorAbi,
        signer,
      );

      const tx = await governorContract.queue(
        payload.targets,
        payload.values.map((value) => BigInt(value)),
        payload.calldatas,
        payload.descriptionHash,
      );

      setHasSubmittedTx(true);
      setStatus("submitted");
      setMessage("Queue submitted. Waiting for confirmation.");
      setIsSubmitting(false);

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Queue transaction receipt not found.");
      }

      setStatus("success");
      setMessage("Proposal queued successfully");

      window.setTimeout(() => {
        onQueued?.(proposal.id);
      }, 300);
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : "We could not queue this proposal.";

      setIsSubmitting(false);
      setHasSubmittedTx(false);
      setStatus("error");
      setMessage(nextMessage);
    }
  }

  return (
    <div className="action-panel action-panel--interactive action-panel--queue">
      <div className="action-panel__row action-panel__row--queue">
        <span>Queue status</span>
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
          onClick={handleQueue}
        >
          {isSubmitting
            ? "Queueing..."
            : status === "submitted"
            ? "Queue submitted"
            : status === "success"
            ? "Proposal queued"
            : "Queue proposal"}
        </button>
      </div>
    </div>
  );
}
