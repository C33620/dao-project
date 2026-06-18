"use client";

import { useRef, useState } from "react";

import {
  normalizeGovernanceActionError,
  submitGovernanceAction,
} from "@/lib/governance/governance-action-client";
import type { ProposalSummary } from "@/types/governance";

type QueueActionCardProps = {
  proposal: ProposalSummary;
  onQueued?: (proposalId: string) => void;
};

export function QueueActionCard({ proposal, onQueued }: QueueActionCardProps) {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "submitted" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState(
    "This proposal passed and is ready to be queued.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  if (proposal.status !== "succeeded") {
    return null;
  }

  const disabled = isSubmitting || status === "success";

  const buttonClassName =
    status === "submitted" || status === "success"
      ? "button-2 button--secondary"
      : "button-2 button--primary";

  async function handleQueue() {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;

    try {
      setIsSubmitting(true);
      setStatus("submitting");
      setMessage("Confirm queueing in your wallet.");

      const actionPromise = submitGovernanceAction(proposal.id, "queue");

      setStatus("submitted");
      setMessage("Queue submitted. Waiting for confirmation.");

      await actionPromise;

      setIsSubmitting(false);
      setStatus("success");
      setMessage("Proposal queued successfully.");

      window.setTimeout(() => {
        onQueued?.(proposal.id);
      }, 300);
    } catch (error) {
      setIsSubmitting(false);
      setStatus("error");
      setMessage(normalizeGovernanceActionError(error));
    } finally {
      submitLockRef.current = false;
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
