"use client";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import myGovernorAbi from "@/abi/MyGovernor.json";
import proposalRegistryAbi from "@/abi/ProposalRegistry.json";
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
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

type CreateProposalClientProps = {
  origin: ProposalOrigin;
};

type SubmissionStage =
  | "idle"
  | "review"
  | "wallet-governor"
  | "creating-proposal"
  | "wallet-registry"
  | "saving-details"
  | "success"
  | "error";

function isBigIntOrNumber(value: unknown): value is bigint | number {
  return typeof value === "bigint" || typeof value === "number";
}

export default function CreateProposalClient({
  origin,
}: CreateProposalClientProps) {
  const { address, isConnected } = useAccount();
  const [proposalText, setProposalText] = useState("");
  const [details, setDetails] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissionStage, setSubmissionStage] =
    useState<SubmissionStage>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [createdProposalId, setCreatedProposalId] = useState<bigint | null>(
    null,
  );

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
    data: delegatedTo,
    isLoading: isLoadingDelegate,
    isError: isDelegateError,
  } = useReadContract({
    abi: governanceTokenAbi,
    address: GOVERNANCE_TOKEN_ADDRESS,
    functionName: "delegates",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  const {
    data: votes,
    isLoading: isLoadingVotes,
    isError: isVotesError,
  } = useReadContract({
    abi: governanceTokenAbi,
    address: GOVERNANCE_TOKEN_ADDRESS,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  const readinessState = useMemo(() => {
    if (!isConnected || !address) {
      return {
        label: "Setup required",
        description:
          "We need to finish preparing your account before you can create a proposal.",
        canContinue: false,
      };
    }

    if (isLoadingThreshold || isLoadingDelegate || isLoadingVotes) {
      return {
        label: "Checking your account",
        description: "We are getting everything ready for proposal creation.",
        canContinue: false,
      };
    }

    if (
      isThresholdError ||
      isDelegateError ||
      isVotesError ||
      !isBigIntOrNumber(proposalThreshold) ||
      !isBigIntOrNumber(votes)
    ) {
      return {
        label: "Proposal creation is unavailable right now",
        description: "Please try again in a moment.",
        canContinue: false,
      };
    }

    const hasDelegate = Boolean(
      delegatedTo &&
        typeof delegatedTo === "string" &&
        delegatedTo !== "0x0000000000000000000000000000000000000000",
    );

    const hasEnoughVotes = votes >= proposalThreshold;

    if (!hasDelegate || !hasEnoughVotes) {
      return {
        label: "Setup required",
        description:
          "We need to finish preparing your account before you can create a proposal.",
        canContinue: false,
      };
    }

    return {
      label: "Ready to create",
      description: "Write your proposal, review it, and continue when ready.",
      canContinue: true,
    };
  }, [
    address,
    delegatedTo,
    isConnected,
    isDelegateError,
    isLoadingDelegate,
    isLoadingThreshold,
    isLoadingVotes,
    isThresholdError,
    isVotesError,
    proposalThreshold,
    votes,
  ]);

  const proposalTitle = buildProposalTitle(proposalText);
  const proposalSummary = buildProposalSummary(details);
  const proposalDescription = buildProposalDescription({
    proposalText,
    details,
  });

  const action = useMemo(() => buildProposalAction(), []);

  const governorWrite = useWriteContract();
  const registryWrite = useWriteContract();

  const governorReceipt = useWaitForTransactionReceipt({
    hash: governorWrite.data,
  });

  const registryReceipt = useWaitForTransactionReceipt({
    hash: registryWrite.data,
  });

  const isSubmitting =
    governorWrite.isPending ||
    governorReceipt.isLoading ||
    registryWrite.isPending ||
    registryReceipt.isLoading;

  function deriveProposalId() {
    return undefined;
  }

  function handleOpenReview() {
    if (!readinessState.canContinue) {
      return;
    }

    setSubmissionError(null);
    setSubmissionStage("review");
    setIsReviewOpen(true);
  }

  function handleCloseReview() {
    if (isSubmitting) {
      return;
    }

    setIsReviewOpen(false);
    setSubmissionStage("idle");
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
      setSubmissionStage("error");
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We could not create your proposal.",
      );
    }
  }

  if (governorReceipt.isSuccess && createdProposalId === null && address) {
    const proposalId = deriveProposalId();

    if (typeof proposalId === "bigint") {
      setCreatedProposalId(proposalId);
      setSubmissionStage("wallet-registry");

      if (!registryWrite.data && !registryWrite.isPending) {
        registryWrite.writeContract({
          abi: proposalRegistryAbi,
          address: PROPOSAL_REGISTRY_ADDRESS,
          functionName: "recordEntry",
          args: [proposalId, proposalDescription, address],
        });
        setSubmissionStage("saving-details");
      }
    }
  }

  if (registryReceipt.isSuccess) {
    if (submissionStage !== "success") {
      setSubmissionStage("success");
      setIsReviewOpen(false);
    }
  }

  if (submissionStage === "success") {
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

          {submissionError ? (
            <p style={{ color: "rgb(185, 28, 28)" }}>{submissionError}</p>
          ) : null}

          {submissionStage === "wallet-governor" ||
          submissionStage === "wallet-registry" ? (
            <p style={{ color: "rgba(15, 23, 42, 0.72)" }}>
              Action needed in wallet.
            </p>
          ) : null}

          {submissionStage === "creating-proposal" ? (
            <p style={{ color: "rgba(15, 23, 42, 0.72)" }}>
              Creating your proposal.
            </p>
          ) : null}

          {submissionStage === "saving-details" ? (
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

            <button
              type="button"
              className="button button--primary"
              onClick={handleOpenReview}
              disabled={
                !readinessState.canContinue ||
                proposalText.trim().length === 0 ||
                isSubmitting
              }
            >
              Review proposal
            </button>
          </div>
        </div>
      </div>

      {isReviewOpen ? (
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

            {submissionStage === "wallet-governor" ||
            submissionStage === "wallet-registry" ? (
              <p style={{ color: "rgba(15, 23, 42, 0.72)", margin: 0 }}>
                Action needed in wallet.
              </p>
            ) : null}

            {submissionStage === "creating-proposal" ? (
              <p style={{ color: "rgba(15, 23, 42, 0.72)", margin: 0 }}>
                Creating your proposal.
              </p>
            ) : null}

            {submissionStage === "saving-details" ? (
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
                disabled={isSubmitting}
              >
                Back and edit
              </button>

              <button
                type="button"
                className="button button--primary"
                onClick={handleSubmitGovernorProposal}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Continuing..." : "Accept and continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
