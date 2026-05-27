"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { submitMockVote } from "@/lib/services/votes";
import type {
  ProposalActionState,
  ProposalDetail,
  StatusTone,
  VoteSupport,
} from "@/types/governance";
import { useState, useTransition } from "react";

type VoteActionCardProps = {
  proposal: ProposalDetail;
  initialActionState: ProposalActionState;
};

const supportOptions: Array<{
  value: VoteSupport;
  label: string;
  description: string;
}> = [
  {
    value: "for",
    label: "For",
    description: "Support the proposal as currently written.",
  },
  {
    value: "against",
    label: "Against",
    description: "Reject the proposal in its current form.",
  },
  {
    value: "abstain",
    label: "Abstain",
    description: "Record participation without taking a side.",
  },
];

function getToneFromStatus(
  status: ProposalActionState["vote"]["status"],
): StatusTone {
  switch (status) {
    case "success":
      return "success";
    case "error":
      return "danger";
    case "submitting":
      return "pending";
    case "review":
      return "info";
    default:
      return "default";
  }
}

export function VoteActionCard({
  proposal,
  initialActionState,
}: VoteActionCardProps) {
  const [actionState, setActionState] = useState(initialActionState);
  const [selectedSupport, setSelectedSupport] = useState<
    VoteSupport | undefined
  >(initialActionState.vote.selectedSupport);
  const [isPending, startTransition] = useTransition();

  const buttonDisabled =
    isPending || !actionState.eligibility.canVote || !selectedSupport;

  const buttonLabel = isPending
    ? "Submitting mock vote..."
    : actionState.vote.submitLabel;

  function handleSubmit() {
    if (!selectedSupport) {
      setActionState((current) => ({
        ...current,
        vote: {
          ...current.vote,
          status: "error",
          feedbackTitle: "Selection required",
          feedbackMessage: "Choose For, Against, or Abstain before submitting.",
        },
      }));
      return;
    }

    setActionState((current) => ({
      ...current,
      vote: {
        ...current.vote,
        status: "submitting",
        selectedSupport,
        feedbackTitle: "Submitting mock vote",
        feedbackMessage:
          "The interface is simulating a transaction-style governance flow.",
      },
    }));

    startTransition(async () => {
      const result = await submitMockVote({
        proposalId: proposal.id,
        support: selectedSupport,
      });

      setActionState((current) => ({
        ...current,
        eligibility: result.eligibility,
        vote: result.vote,
      }));
    });
  }

  return (
    <div className="action-panel action-panel--interactive">
      <div className="action-panel__row">
        <span>Current state</span>
        <strong>{actionState.summary}</strong>
      </div>

      <div className="action-panel__row">
        <span>Eligibility</span>
        <strong>{actionState.eligibility.title}</strong>
      </div>

      <div className="action-panel__support-grid">
        {supportOptions.map((option) => {
          const active = selectedSupport === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={
                active ? "action-option action-option--active" : "action-option"
              }
              onClick={() => setSelectedSupport(option.value)}
              disabled={!actionState.eligibility.canVote || isPending}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          );
        })}
      </div>

      <div className="action-panel__feedback">
        <div>
          <p className="wallet-status__label">
            {actionState.vote.feedbackTitle ?? "Review"}
          </p>
          <p className="wallet-status__value">
            {actionState.vote.feedbackMessage ??
              actionState.eligibility.description}
          </p>
          {actionState.vote.existingVote ? (
            <p className="wallet-status__label">
              Existing vote: {actionState.vote.existingVote}
            </p>
          ) : null}
        </div>
        <StatusBadge
          label={actionState.vote.status}
          tone={getToneFromStatus(actionState.vote.status)}
        />
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button button--primary"
          disabled={buttonDisabled}
          onClick={handleSubmit}
        >
          {buttonLabel}
        </button>
      </div>

      <p className="wallet-status__label">
        Mock-safe flow: no wallet signature, relayer submission, or on-chain
        transaction occurs in Phase 4.
      </p>
    </div>
  );
}
