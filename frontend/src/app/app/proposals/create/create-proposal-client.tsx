"use client";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import myGovernorAbi from "@/abi/MyGovernor.json";
import proposalRegistryAbi from "@/abi/ProposalRegistry.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import {
  buildProposalAction,
  buildProposalDescription,
  buildProposalSummary,
  buildProposalTitle,
  getProposalReturnHref,
  type ProposalOrigin,
} from "@/lib/governance/create-proposal";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
  PROPOSAL_REGISTRY_ADDRESS,
} from "@/lib/web3/contracts";
import { BrowserProvider, Contract } from "ethers";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

type CreateProposalClientProps = {
  origin: ProposalOrigin;
  walletAddress: `0x${string}` | null;
  accountReadiness: {
    isCheckingAccount: boolean;
    isAccountReadyFromAppState: boolean;
  };
};

type SubmissionStage =
  | "idle"
  | "review"
  | "wallet-governor"
  | "creating-proposal"
  | "saving-details"
  | "error";

type DelegationStage = "idle" | "wallet" | "pending" | "error";

function isBigIntOrNumber(value: unknown): value is bigint | number {
  return typeof value === "bigint" || typeof value === "number";
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && value.startsWith("0x");
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function CreateProposalClient({
  origin,
  walletAddress,
  accountReadiness,
}: CreateProposalClientProps) {
  const accountAddress = walletAddress;

  const [proposalText, setProposalText] = useState("");
  const [details, setDetails] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissionStage, setSubmissionStage] =
    useState<SubmissionStage>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [delegationStage, setDelegationStage] =
    useState<DelegationStage>("idle");
  const [delegationError, setDelegationError] = useState<string | null>(null);

  const createdProposalIdRef = useRef<bigint | null>(null);
  const didStartRegistryWriteRef = useRef(false);

  const returnHref = getProposalReturnHref(origin);

  const {
    data: proposalThreshold,
    isLoading: isLoadingThreshold,
    isError: isThresholdError,
  } = useReadContract({
    abi: myGovernorAbi,
    address: MY_GOVERNOR_ADDRESS,
    functionName: "proposalThreshold",
  });

  const {
    data: balance,
    isLoading: isLoadingBalance,
    isError: isBalanceError,
    refetch: refetchBalance,
  } = useReadContract({
    abi: governanceTokenAbi,
    address: GOVERNANCE_TOKEN_ADDRESS,
    functionName: "balanceOf",
    args: accountAddress ? [accountAddress] : undefined,
    query: {
      enabled: Boolean(accountAddress),
    },
  });

  const {
    data: delegatedTo,
    isLoading: isLoadingDelegate,
    isError: isDelegateError,
    refetch: refetchDelegates,
  } = useReadContract({
    abi: governanceTokenAbi,
    address: GOVERNANCE_TOKEN_ADDRESS,
    functionName: "delegates",
    args: accountAddress ? [accountAddress] : undefined,
    query: {
      enabled: Boolean(accountAddress),
    },
  });

  const {
    data: votes,
    isLoading: isLoadingVotes,
    isError: isVotesError,
    refetch: refetchVotes,
  } = useReadContract({
    abi: governanceTokenAbi,
    address: GOVERNANCE_TOKEN_ADDRESS,
    functionName: "getVotes",
    args: accountAddress ? [accountAddress] : undefined,
    query: {
      enabled: Boolean(accountAddress),
    },
  });

  const governorWrite = useWriteContract();
  const registryWrite = useWriteContract();

  const governorReceipt = useWaitForTransactionReceipt({
    hash: governorWrite.data,
  });

  const registryReceipt = useWaitForTransactionReceipt({
    hash: registryWrite.data,
  });

  const proposalTitle = buildProposalTitle(proposalText);
  const proposalSummary = buildProposalSummary(details);
  const proposalDescription = buildProposalDescription({
    proposalText,
    details,
  });

  const action = useMemo(() => buildProposalAction(), []);

  const isSubmittingProposal =
    governorWrite.isPending ||
    governorReceipt.isLoading ||
    registryWrite.isPending ||
    registryReceipt.isLoading;

  const isDelegationBusy =
    delegationStage === "wallet" || delegationStage === "pending";

  const isSubmissionSuccess = registryReceipt.isSuccess;

  const isAwaitingRegistryWallet =
    governorReceipt.isSuccess &&
    !registryWrite.data &&
    !registryWrite.isPending &&
    !registryReceipt.isLoading &&
    !registryReceipt.isSuccess &&
    didStartRegistryWriteRef.current;

  const readinessState = useMemo(() => {
    if (accountReadiness.isCheckingAccount) {
      return {
        label: "Checking your account",
        description:
          "We’re checking whether your account is ready for proposals.",
        canReview: false,
        needsDelegation: false,
      };
    }

    if (!accountReadiness.isAccountReadyFromAppState) {
      return {
        label: "Setup required",
        description: "We’re still preparing your account for governance.",
        canReview: false,
        needsDelegation: false,
      };
    }

    if (!accountAddress) {
      return {
        label: "Setup required",
        description: "We’re still preparing your account for governance.",
        canReview: false,
        needsDelegation: false,
      };
    }

    if (
      isLoadingThreshold ||
      isLoadingBalance ||
      isLoadingDelegate ||
      isLoadingVotes
    ) {
      return {
        label: "Checking your account",
        description:
          "We’re checking whether your account is ready for proposals.",
        canReview: false,
        needsDelegation: false,
      };
    }

    if (
      isThresholdError ||
      isBalanceError ||
      isDelegateError ||
      isVotesError ||
      !isBigIntOrNumber(proposalThreshold) ||
      !isBigIntOrNumber(balance) ||
      !isBigIntOrNumber(votes)
    ) {
      return {
        label: "Checking your account",
        description:
          "We’re checking whether your account is ready for proposals.",
        canReview: false,
        needsDelegation: false,
      };
    }

    const hasBalance = balance > 0;
    const isSelfDelegated =
      isAddress(delegatedTo) &&
      delegatedTo !== ZERO_ADDRESS &&
      delegatedTo.toLowerCase() === accountAddress.toLowerCase();
    const hasEnoughVotes = votes >= proposalThreshold;

    if (!hasBalance) {
      return {
        label: "Setup required",
        description:
          "Your voting power is on the way. If it does not arrive soon, please contact an admin.",
        canReview: false,
        needsDelegation: false,
      };
    }

    if (!isSelfDelegated) {
      return {
        label: "Setup required",
        description: "Enable proposals by activating your voting power.",
        canReview: false,
        needsDelegation: true,
      };
    }

    if (!hasEnoughVotes) {
      return {
        label: "Setup required",
        description:
          "Your account is almost ready for proposals, but voting power has not reached the proposal threshold yet.",
        canReview: false,
        needsDelegation: false,
      };
    }

    return {
      label: "Ready to create",
      description: "Write your proposal, review it, and continue when ready.",
      canReview: true,
      needsDelegation: false,
    };
  }, [
    accountAddress,
    accountReadiness.isAccountReadyFromAppState,
    accountReadiness.isCheckingAccount,
    balance,
    delegatedTo,
    isBalanceError,
    isDelegateError,
    isLoadingBalance,
    isLoadingDelegate,
    isLoadingThreshold,
    isLoadingVotes,
    isThresholdError,
    isVotesError,
    proposalThreshold,
    votes,
  ]);

  useEffect(() => {
    if (
      !governorReceipt.isSuccess ||
      createdProposalIdRef.current !== null ||
      !accountAddress ||
      didStartRegistryWriteRef.current
    ) {
      return;
    }

    const proposalId = undefined;

    if (typeof proposalId !== "bigint") {
      return;
    }

    createdProposalIdRef.current = proposalId;
    didStartRegistryWriteRef.current = true;

    try {
      registryWrite.writeContract({
        abi: proposalRegistryAbi,
        address: PROPOSAL_REGISTRY_ADDRESS,
        functionName: "recordEntry",
        args: [proposalId, proposalDescription, accountAddress],
      });
    } catch (error) {
      console.error("PROPOSAL_REGISTRY_WRITE_ERROR", error);

      queueMicrotask(() => {
        setSubmissionStage("error");
        setSubmissionError(
          error instanceof Error
            ? error.message
            : "We could not save your proposal details.",
        );
      });
    }
  }, [
    accountAddress,
    governorReceipt.isSuccess,
    proposalDescription,
    registryWrite,
  ]);

  function handleOpenReview() {
    if (!readinessState.canReview) {
      return;
    }

    setSubmissionError(null);
    setSubmissionStage("review");
    setIsReviewOpen(true);
  }

  function handleCloseReview() {
    if (isSubmittingProposal) {
      return;
    }

    setIsReviewOpen(false);
    setSubmissionStage("idle");
  }

  async function handleEnableProposal() {
    if (!accountAddress || isDelegationBusy) {
      return;
    }

    try {
      setDelegationError(null);
      setDelegationStage("wallet");

      const magic = getMagicClient();
      const provider = new BrowserProvider(magic.rpcProvider);
      const signer = await provider.getSigner();

      const governanceTokenContract = new Contract(
        GOVERNANCE_TOKEN_ADDRESS,
        governanceTokenAbi,
        signer,
      );

      setDelegationStage("pending");

      const tx = await governanceTokenContract.delegate(accountAddress);
      await tx.wait();

      await Promise.all([refetchBalance(), refetchDelegates(), refetchVotes()]);

      setDelegationStage("idle");
    } catch (error) {
      console.error("SELF_DELEGATION_WRITE_ERROR", error);
      setDelegationStage("error");
      setDelegationError("Something went wrong.");
    }
  }

  function handleSubmitGovernorProposal() {
    try {
      setSubmissionError(null);
      setSubmissionStage("wallet-governor");

      governorWrite.writeContract({
        abi: myGovernorAbi,
        address: MY_GOVERNOR_ADDRESS,
        functionName: "propose",
        args: [
          action.targets,
          action.values,
          action.calldatas,
          proposalDescription,
        ],
      });

      setSubmissionStage("creating-proposal");
    } catch (error) {
      console.error("GOVERNOR_PROPOSAL_WRITE_ERROR", error);
      setSubmissionStage("error");
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We could not create your proposal.",
      );
    }
  }

  if (isSubmissionSuccess) {
    return (
      <div className="dashboard-section-stack">
        <div className="empty-state empty-state--compact">
          <div className="empty-state__icon" aria-hidden="true">
            ✓
          </div>
          <h2>Proposal submitted</h2>
          <p>
            Your proposal has been created and its details were saved
            successfully.
          </p>
        </div>

        <div className="dashboard-cta-card__actions">
          <Link href={returnHref} className="button button--primary">
            Back to previous page
          </Link>
        </div>
      </div>
    );
  }

  const showDelegationHelper =
    delegationStage === "wallet" || delegationStage === "pending";

  const showSubmissionWalletHelper =
    submissionStage === "wallet-governor" || isAwaitingRegistryWallet;

  const showSavingDetailsHelper = submissionStage === "saving-details";

  const primaryButton = readinessState.needsDelegation ? (
    <button
      type="button"
      className="button button--primary"
      onClick={() => {
        void handleEnableProposal();
      }}
      disabled={isDelegationBusy || !accountAddress}
    >
      Enable proposal
    </button>
  ) : (
    <button
      type="button"
      className="button button--primary"
      onClick={handleOpenReview}
      disabled={
        !readinessState.canReview ||
        proposalText.trim().length === 0 ||
        isSubmittingProposal ||
        isDelegationBusy
      }
    >
      Review proposal
    </button>
  );

  return (
    <>
      <div className="dashboard-section-stack">
        <div className="dashboard-cta-card">
          <div className="dashboard-cta-card__content">
            <p className="section-kicker">{readinessState.label}</p>
            <h2 className="dashboard-cta-card__title">Create a proposal</h2>
            <p className="dashboard-cta-card__description">
              {readinessState.description}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>
              What would you like the group to consider?
            </span>
            <textarea
              value={proposalText}
              onChange={(event) => setProposalText(event.target.value)}
              rows={4}
              maxLength={160}
              placeholder="Example: Workshop on Saturday 12 March"
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "white",
                fontSize: 16,
                resize: "vertical",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Add more context (optional)</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Add any context that would help the group understand this proposal."
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "white",
                fontSize: 16,
                resize: "vertical",
              }}
            />
          </label>

          {delegationError ? (
            <p style={{ color: "rgb(185, 28, 28)" }}>{delegationError}</p>
          ) : null}

          {submissionError ? (
            <p style={{ color: "rgb(185, 28, 28)" }}>{submissionError}</p>
          ) : null}

          {showDelegationHelper ? (
            <p style={{ color: "rgba(15, 23, 42, 0.72)" }}>
              Action needed to continue.
            </p>
          ) : null}

          {showSubmissionWalletHelper ? (
            <p style={{ color: "rgba(15, 23, 42, 0.72)" }}>
              Action needed in wallet.
            </p>
          ) : null}

          {submissionStage === "creating-proposal" ? (
            <p style={{ color: "rgba(15, 23, 42, 0.72)" }}>
              Creating your proposal.
            </p>
          ) : null}

          {showSavingDetailsHelper ? (
            <p style={{ color: "rgba(15, 23, 42, 0.72)" }}>
              Saving proposal details.
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link href={returnHref} className="button button--secondary">
              Cancel
            </Link>

            {primaryButton}
          </div>
        </div>
      </div>

      {isReviewOpen && !isSubmissionSuccess ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="proposal-review-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              background: "white",
              borderRadius: 20,
              padding: 24,
              display: "grid",
              gap: 16,
              boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <p className="section-kicker" style={{ margin: 0 }}>
                Review
              </p>
              <h2 id="proposal-review-title" style={{ margin: 0 }}>
                Review your proposal
              </h2>
              <p style={{ margin: 0, color: "rgba(15, 23, 42, 0.72)" }}>
                Check everything here first. After you continue, we will ask you
                to confirm in your wallet.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                padding: 16,
                borderRadius: 16,
                background: "rgba(15, 23, 42, 0.04)",
              }}
            >
              <div>
                <p style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.72)" }}>
                  Proposal
                </p>
                <p style={{ fontWeight: 600, margin: 0 }}>{proposalTitle}</p>
              </div>

              {proposalSummary ? (
                <div>
                  <p style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.72)" }}>
                    Context
                  </p>
                  <p style={{ margin: 0 }}>{proposalSummary}</p>
                </div>
              ) : null}
            </div>

            {submissionError ? (
              <p style={{ color: "rgb(185, 28, 28)", margin: 0 }}>
                {submissionError}
              </p>
            ) : null}

            {showSubmissionWalletHelper ? (
              <p style={{ color: "rgba(15, 23, 42, 0.72)", margin: 0 }}>
                Action needed in wallet.
              </p>
            ) : null}

            {submissionStage === "creating-proposal" ? (
              <p style={{ color: "rgba(15, 23, 42, 0.72)", margin: 0 }}>
                Creating your proposal.
              </p>
            ) : null}

            {showSavingDetailsHelper ? (
              <p style={{ color: "rgba(15, 23, 42, 0.72)", margin: 0 }}>
                Saving proposal details.
              </p>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: "flex-start",
              }}
            >
              <button
                type="button"
                className="button button--secondary"
                onClick={handleCloseReview}
                disabled={isSubmittingProposal}
              >
                Back and edit
              </button>

              <button
                type="button"
                className="button button--primary"
                onClick={handleSubmitGovernorProposal}
                disabled={isSubmittingProposal}
              >
                {isSubmittingProposal ? "Continuing..." : "Accept and continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
