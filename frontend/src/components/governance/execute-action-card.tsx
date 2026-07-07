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
    <div className="grid gap-4 p-[1.15rem_1.2rem] rounded-[1.1rem] border border-(--border) bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_10px_30px_rgba(15,23,42,0.04)] w-full">
      <div className="flex flex-col items-start justify-start gap-4 pb-[0.85rem] border-b border-[rgba(214,218,225,0.52)] last-of-type:pb-0 last-of-type:border-0 w-full sm:flex-row sm:items-center sm:justify-between">
        <span className="flex-none w-full text-left text-(--muted-soft) text-[0.76rem] uppercase tracking-[0.07em] font-bold sm:w-auto">
          Execution status
        </span>
        <strong
          className={`flex-1 min-w-0 text-left text-[0.95rem] leading-[1.45]${
            status === "success"
              ? " text-(--success)"
              : status === "error"
              ? " text-(--danger)"
              : ""
          }`}
        >
          {message}
        </strong>
      </div>

      <div className="w-full">
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
