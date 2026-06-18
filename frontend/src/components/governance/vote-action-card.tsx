"use client";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
  SEPOLIA_CHAIN_ID,
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

function getErrorCode(error: unknown): number | string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (typeof (error as { code?: unknown }).code === "number" ||
      typeof (error as { code?: unknown }).code === "string")
  ) {
    return (error as { code: number | string }).code;
  }

  return undefined;
}

function getReadableWalletError(error: unknown, fallback: string): string {
  const code = getErrorCode(error);

  if (code === 4001 || code === "ACTION_REJECTED") {
    return "You canceled the wallet request.";
  }

  if (code === 4902) {
    return "Sepolia is not available in this wallet.";
  }

  if (typeof error === "object" && error !== null) {
    if ("shortMessage" in error && typeof error.shortMessage === "string") {
      return error.shortMessage;
    }

    if ("reason" in error && typeof error.reason === "string") {
      return error.reason;
    }

    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }

  return fallback;
}

async function revalidateGovernanceCache(): Promise<void> {
  try {
    await fetch("/api/revalidate-governance", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch {
    // Ignore revalidation failures in the client.
    // The onchain transaction result is more important than cache refresh.
  }
}

async function getBrowserProvider() {
  const magic = getMagicClient();
  return new BrowserProvider(magic.rpcProvider);
}

async function ensureSepoliaNetwork(provider: BrowserProvider): Promise<void> {
  const network = await provider.getNetwork();

  if (Number(network.chainId) === SEPOLIA_CHAIN_ID) {
    return;
  }

  try {
    await provider.send("wallet_switchEthereumChain", [
      { chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` },
    ]);
  } catch (error) {
    throw new Error(
      getReadableWalletError(
        error,
        "Please switch your wallet to Sepolia before continuing.",
      ),
    );
  }

  const refreshedNetwork = await provider.getNetwork();

  if (Number(refreshedNetwork.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("Wallet is not connected to Sepolia.");
  }
}

async function submitVoteOnchain(
  proposalId: string,
  support: VoteSupport,
): Promise<string> {
  const provider = await getBrowserProvider();
  await ensureSepoliaNetwork(provider);

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
  const provider = await getBrowserProvider();
  const receipt = await provider.waitForTransaction(txHash);

  if (!receipt) {
    throw new Error("Vote transaction receipt not found.");
  }

  if (receipt.status !== 1) {
    throw new Error("Vote transaction failed onchain.");
  }
}

async function enableVotingPowerOnchain(): Promise<string> {
  const provider = await getBrowserProvider();
  await ensureSepoliaNetwork(provider);

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
  const provider = await getBrowserProvider();
  const receipt = await provider.waitForTransaction(txHash);

  if (!receipt) {
    throw new Error("Delegation transaction receipt not found.");
  }

  if (receipt.status !== 1) {
    throw new Error("Delegation transaction failed onchain.");
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

  const needsDelegation =
    actionState.eligibility.reason === "delegated_away" ||
    actionState.eligibility.reason === "no_voting_power";

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
        ? "Confirm delegation..."
        : "Enabling vote..."
      : txPhase === "awaiting_wallet"
      ? "Confirm vote..."
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
    if (isBusy) {
      return;
    }

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
            "Your self-delegation was confirmed. You can now submit your vote.",
        },
        vote: {
          ...current.vote,
          status: "review",
          submitLabel: "Submit vote",
          feedbackTitle: "Voting enabled",
          feedbackMessage:
            "Your voting power is active. Review your choice and submit.",
        },
      }));

      setTxPhase("idle");
      router.refresh();
    } catch (error) {
      setTxPhase("error");
      setActionState((current) => ({
        ...current,
        vote: {
          ...current.vote,
          status: "error",
          submitLabel: "Enable vote",
          feedbackTitle: "Enable vote failed",
          feedbackMessage: getReadableWalletError(
            error,
            "We could not enable voting power.",
          ),
        },
      }));
    }
  }

  async function handleSubmitVote() {
    if (isBusy) {
      return;
    }

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
        feedbackMessage: "Confirm your vote in the wallet to continue.",
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

      setTxPhase("success");
      onVoteSuccess?.(proposal.id);
      void revalidateGovernanceCache();
      router.refresh();
    } catch (error) {
      setTxPhase("error");
      setActionState((current) => ({
        ...current,
        vote: {
          ...current.vote,
          status: "error",
          selectedSupport,
          submitLabel: "Try again",
          feedbackTitle: "Vote failed",
          feedbackMessage: getReadableWalletError(
            error,
            "We could not submit your vote.",
          ),
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
