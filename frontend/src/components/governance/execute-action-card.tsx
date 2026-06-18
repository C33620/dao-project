"use client";

import { useRef, useState } from "react";

import {
  normalizeGovernanceActionError,
  submitGovernanceAction,
} from "@/lib/governance/governance-action-client";
import type { ProposalSummary } from "@/types/governance";

type ExecuteActionCardProps = {
  proposal: ProposalSummary;
  onExecuted?: (proposalId: string) => void;
};

export function ExecuteActionCard({
  proposal,
  onExecuted,
}: ExecuteActionCardProps) {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "submitted" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState(
    "This proposal passed the queue and can be executed now.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  if (proposal.status !== "queued") {
    return null;
  }

  const disabled = isSubmitting || status === "success";

  const buttonClassName =
    status === "submitted" || status === "success"
      ? "button-2 button--secondary"
      : "button-2 button--primary";

  async function handleExecute() {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;

    try {
      setIsSubmitting(true);
      setStatus("submitting");
      setMessage("Confirm execution in your wallet.");

      const actionPromise = submitGovernanceAction(proposal.id, "execute");

      setStatus("submitted");
      setMessage("Execution submitted. Waiting for confirmation.");

      await actionPromise;

      setIsSubmitting(false);
      setStatus("success");
      setMessage("Proposal executed successfully.");

      window.setTimeout(() => {
        onExecuted?.(proposal.id);
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
          {isSubmitting
            ? "Executing..."
            : status === "submitted"
            ? "Execution submitted"
            : status === "success"
            ? "Executed"
            : "Execute proposal"}
        </button>
      </div>
    </div>
  );
}
