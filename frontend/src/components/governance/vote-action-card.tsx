"use client";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import myGovernorAbi from "@/abi/MyGovernor.json";
import { StatusBadge } from "@/components/ui/status-badge";
import { getMagicClient } from "@/lib/auth/magic-client";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
} from "@/lib/web3/contracts";
import type {
  ProposalActionState,
  ProposalDetail,
  StatusTone,
  VoteSupport,
} from "@/types/governance";
import { BrowserProvider, Contract } from "ethers";
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

function toGovernorSupport(support: VoteSupport): number {
  switch (support) {
    case "against":
      return 0;
    case "for":
      return 1;
    case "abstain":
      return 2;
  }
}

async function submitVoteOnchain(
  proposalId: string,
  support: VoteSupport,
): Promise<void> {
  const magic = getMagicClient();
  const provider = new BrowserProvider(magic.rpcProvider);
  const signer = await provider.getSigner();

  const governorContract = new Contract(
    MY_GOVERNOR_ADDRESS,
    myGovernorAbi,
    signer,
  );

  const tx = await governorContract.castVote(
    BigInt(proposalId),
    toGovernorSupport(support),
  );

  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error("Vote transaction receipt not found.");
  }
}

async function enableVotingPowerOnchain(): Promise<void> {
  const magic = getMagicClient();
  const provider = new BrowserProvider(magic.rpcProvider);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();

  const governanceTokenContract = new Contract(
    GOVERNANCE_TOKEN_ADDRESS,
    governanceTokenAbi,
    signer,
  );

  const tx = await governanceTokenContract.delegate(signerAddress);
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error("Delegation transaction receipt not found.");
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

  const needsDelegation = actionState.eligibility.reason === "delegated_away";

  const buttonDisabled = needsDelegation
    ? isPending
    : isPending || !actionState.eligibility.canVote || !selectedSupport;

  const buttonLabel = isPending
    ? needsDelegation
      ? "Enabling vote..."
      : "Submitting vote..."
    : needsDelegation
    ? "Enable vote"
    : actionState.vote.submitLabel;

  function handleEnableVote() {
    setActionState((current) => ({
      ...current,
      vote: {
        ...current.vote,
        status: "submitting",
        submitLabel: "Enabling vote...",
        feedbackTitle: "Action needed in wallet",
        feedbackMessage:
          "Confirm self-delegation in your wallet to enable voting power.",
      },
    }));

    startTransition(async () => {
      try {
        await enableVotingPowerOnchain();

        setActionState((current) => ({
          ...current,
          eligibility: {
            canVote: true,
            title: "Voting enabled",
            description:
              "Your voting power has been enabled. You can now cast your vote.",
          },
          vote: {
            ...current.vote,
            status: "review",
            submitLabel: "Cast vote",
            feedbackTitle: "Voting enabled",
            feedbackMessage:
              "Your self-delegation was confirmed. Review your vote and submit.",
          },
        }));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "We could not enable voting power.";

        setActionState((current) => ({
          ...current,
          vote: {
            ...current.vote,
            status: "error",
            submitLabel: "Enable vote",
            feedbackTitle: "Enable vote failed",
            feedbackMessage: message,
          },
        }));
      }
    });
  }

  function handleSubmitVote() {
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
        submitLabel: "Submitting vote...",
        feedbackTitle: "Action needed in wallet",
        feedbackMessage: "Confirm your vote in your wallet to continue.",
      },
    }));

    startTransition(async () => {
      try {
        await submitVoteOnchain(proposal.id, selectedSupport);

        setActionState((current) => ({
          ...current,
          summary: "Your vote has been submitted onchain.",
          eligibility: {
            canVote: false,
            reason: "already_voted",
            title: "Vote submitted",
            description:
              "Your vote was confirmed and recorded for this proposal.",
          },
          vote: {
            status: "success",
            selectedSupport,
            existingVote: selectedSupport,
            submitLabel: "Voted",
            feedbackTitle: "Vote recorded",
            feedbackMessage: `Your ${selectedSupport} vote was submitted successfully.`,
          },
        }));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "We could not submit your vote.";

        setActionState((current) => ({
          ...current,
          vote: {
            ...current.vote,
            status: "error",
            selectedSupport,
            submitLabel: "Try again",
            feedbackTitle: "Vote failed",
            feedbackMessage: message,
          },
        }));
      }
    });
  }

  function handlePrimaryAction() {
    if (needsDelegation) {
      handleEnableVote();
      return;
    }

    handleSubmitVote();
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
              disabled={isPending || actionState.vote.status === "success"}
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
          onClick={handlePrimaryAction}
        >
          {buttonLabel}
        </button>
      </div>

      <p className="wallet-status__label">
        {needsDelegation
          ? "Enable voting by self-delegating your governance power first."
          : "Your vote is submitted directly to the governor contract and recorded onchain after wallet confirmation."}
      </p>
    </div>
  );
}
