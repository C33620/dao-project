"use client";

import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";
import type { ProposalSummary } from "@/types/governance";
import { BrowserProvider, Contract } from "ethers";
import { useState } from "react";

type QueueActionCardProps = {
  proposal: ProposalSummary;
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

export function QueueActionCard({ proposal }: QueueActionCardProps) {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "submitted" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState(
    "This proposal passed and is ready to be queued.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedTx, setHasSubmittedTx] = useState(false);

  const disabled =
    isSubmitting || hasSubmittedTx || proposal.status !== "succeeded";

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
      setMessage("Transaction submitted. Waiting for confirmation.");
      setIsSubmitting(false);

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Queue transaction receipt not found.");
      }

      setStatus("success");
      setMessage("Proposal queued successfully. Waiting for timelock.");

      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
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
    <div className="action-panel action-panel--interactive">
      <div className="action-panel__row">
        <span style={{ flexShrink: 0 }}>Queue status</span>
        <strong
          style={{
            textAlign: "right",
            color:
              status === "success"
                ? "var(--color-success)"
                : status === "error"
                ? "var(--color-error)"
                : "inherit",
          }}
        >
          {message}
        </strong>
      </div>

      <div className="button-row" style={{ width: "100%" }}>
        <button
          type="button"
          className="button-2 button--primary"
          style={{ width: "100%" }}
          disabled={disabled}
          onClick={handleQueue}
        >
          {isSubmitting
            ? "Queueing..."
            : status === "submitted"
            ? "Transaction sent"
            : status === "success"
            ? "Queued"
            : "Queue proposal"}
        </button>
      </div>
    </div>
  );
}
