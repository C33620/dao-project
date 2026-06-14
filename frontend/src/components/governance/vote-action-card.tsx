"use client";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
} from "@/lib/web3/contracts";
import type {
  ProposalActionState,
  ProposalDetail,
  VoteSupport,
} from "@/types/governance";
import { BrowserProvider, Contract } from "ethers";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type VoteActionCardProps = {
  proposal: ProposalDetail;
  initialActionState: ProposalActionState;
  onVoteSuccess?: (proposalId: string) => void;
};

type TxPhase =
  | "idle"
  | "awaiting_wallet"
  | "pending_chain"
  | "success"
  | "error";

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

async function revalidateGovernanceCache(): Promise<void> {
  const response = await fetch("/api/revalidate-governance", {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to revalidate governance cache.");
  }
}

async function submitVoteOnchain(
  proposalId: string,
  support: VoteSupport,
): Promise<string> {
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

  if (!tx?.hash) {
    throw new Error("Vote transaction was not created.");
  }

  return tx.hash;
}

async function waitForVoteReceipt(txHash: string): Promise<void> {
  const magic = getMagicClient();
  const provider = new BrowserProvider(magic.rpcProvider);
  const receipt = await provider.waitForTransaction(txHash);

  if (!receipt) {
    throw new Error("Vote transaction receipt not found.");
  }
}

async function enableVotingPowerOnchain(): Promise<string> {
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

  if (!tx?.hash) {
    throw new Error("Delegation transaction was not created.");
  }

  return tx.hash;
}

async function waitForDelegationReceipt(txHash: string): Promise<void> {
  const magic = getMagicClient();
  const provider = new BrowserProvider(magic.rpcProvider);
  const receipt = await provider.waitForTransaction(txHash);

  if (!receipt) {
    throw new Error("Delegation transaction receipt not found.");
  }
}

function parseDisplayDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatTimeLeft(targetDate: Date | null, nowMs: number): string | null {
  if (!targetDate) {
    return null;
  }

  const diffMs = targetDate.getTime() - nowMs;

  if (diffMs <= 0) {
    return "Closed";
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
}

export function VoteActionCard({
  proposal,
  initialActionState,
  onVoteSuccess,
}: VoteActionCardProps) {
  const router = useRouter();
  const [actionState, setActionState] = useState(initialActionState);
  const [selectedSupport] = useState<VoteSupport | undefined>(
    initialActionState.vote.selectedSupport,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");

  const selectedSupportLabel =
    selectedSupport === "for"
      ? "Yes"
      : selectedSupport === "against"
      ? "No"
      : selectedSupport === "abstain"
      ? "Abstain"
      : null;

  const needsDelegation = actionState.eligibility.reason === "delegated_away";

  const hasAlreadyVoted =
    actionState.eligibility.reason === "already_voted" ||
    actionState.vote.status === "success" ||
    actionState.vote.existingVote !== undefined;

  const isBusy = txPhase === "awaiting_wallet" || txPhase === "pending_chain";

  const buttonDisabled =
    isBusy ||
    hasAlreadyVoted ||
    (!needsDelegation &&
      (!actionState.eligibility.canVote || !selectedSupport));

  const buttonLabel = isBusy
    ? needsDelegation
      ? txPhase === "awaiting_wallet"
        ? "Confirm vote submission..."
        : "Enabling vote..."
      : txPhase === "awaiting_wallet"
      ? "Confirm vote submission..."
      : "Submitting vote..."
    : hasAlreadyVoted
    ? "Voted"
    : needsDelegation
    ? "Enable vote"
    : "Submit vote";

  const votingEndsDate = useMemo(
    () => parseDisplayDate(proposal.votingEndsAt),
    [proposal.votingEndsAt],
  );

  const votingClosesLabel = useMemo(() => {
    if (proposal.status !== "active") {
      return null;
    }

    return formatTimeLeft(votingEndsDate, nowMs);
  }, [proposal.status, votingEndsDate, nowMs]);

  useEffect(() => {
    if (proposal.status !== "active" || !votingEndsDate) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [proposal.status, votingEndsDate]);

  async function handleEnableVote() {
    setTxPhase("awaiting_wallet");

    setActionState((current) => ({
      ...current,
      vote: {
        ...current.vote,
        status: "submitting",
        submitLabel: "Enabling vote...",
        feedbackTitle: "Action needed in wallet",
        feedbackMessage: "Confirm self-delegation to enable voting power.",
      },
    }));

    try {
      const txHash = await enableVotingPowerOnchain();

      setTxPhase("pending_chain");
      setActionState((current) => ({
        ...current,
        vote: {
          ...current.vote,
          status: "submitting",
          submitLabel: "Enabling vote...",
          feedbackTitle: "Transaction submitted",
          feedbackMessage: "Delegation submitted. Waiting for confirmation...",
        },
      }));

      await waitForDelegationReceipt(txHash);
      await revalidateGovernanceCache();

      setActionState((current) => ({
        ...current,
        eligibility: {
          canVote: true,
          title: "Voting enabled",
          description:
            "Your voting power has been enabled. You can now submit your vote.",
        },
        vote: {
          ...current.vote,
          status: "review",
          submitLabel: "Submit vote",
          feedbackTitle: "Voting enabled",
          feedbackMessage:
            "Your self-delegation was confirmed. Review your vote and submit.",
        },
      }));

      setTxPhase("idle");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not enable voting power.";

      setTxPhase("error");
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
  }

  async function handleSubmitVote() {
    if (!selectedSupport) {
      setActionState((current) => ({
        ...current,
        vote: {
          ...current.vote,
          status: "error",
          feedbackTitle: "Selection required",
          feedbackMessage: "Choose Yes or No before submitting.",
        },
      }));
      return;
    }

    setTxPhase("awaiting_wallet");

    setActionState((current) => ({
      ...current,
      vote: {
        ...current.vote,
        status: "submitting",
        selectedSupport,
        submitLabel: "Submitting vote...",
        feedbackTitle: "Action needed",
        feedbackMessage: "Confirm your vote to continue.",
      },
    }));

    try {
      const txHash = await submitVoteOnchain(proposal.id, selectedSupport);

      setTxPhase("pending_chain");
      setActionState((current) => ({
        ...current,
        vote: {
          ...current.vote,
          status: "submitting",
          selectedSupport,
          submitLabel: "Submitting vote...",
          feedbackTitle: "Transaction submitted",
          feedbackMessage:
            "Vote submitted. Waiting for onchain confirmation...",
        },
      }));

      await waitForVoteReceipt(txHash);

      setActionState((current) => ({
        ...current,
        summary: "Your vote has been submitted.",
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

      await revalidateGovernanceCache();
      router.refresh();
      setTxPhase("idle");
      onVoteSuccess?.(proposal.id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not submit your vote.";

      setTxPhase("error");
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
  }

  function handlePrimaryAction() {
    if (needsDelegation) {
      void handleEnableVote();
      return;
    }

    void handleSubmitVote();
  }

  return (
    <div className="action-panel action-panel--interactive">
      <div className="action-panel__row">
        <span>Current state</span>
        <strong>{actionState.summary}</strong>
      </div>

      {votingClosesLabel ? (
        <div className="action-panel__row">
          <span>Voting closes</span>
          <strong>{votingClosesLabel}</strong>
        </div>
      ) : null}

      {selectedSupportLabel ? (
        <div className="action-panel__row">
          <span>Vote chosen</span>
          <strong>{selectedSupportLabel}</strong>
        </div>
      ) : null}

      <div className="button-row">
        <button
          type="button"
          className="button-2 button--primary"
          disabled={buttonDisabled}
          onClick={handlePrimaryAction}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
