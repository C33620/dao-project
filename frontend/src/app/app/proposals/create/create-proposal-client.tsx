"use client";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import myGovernorAbi from "@/abi/MyGovernor.json";
import {
  blocksToApproxHours,
  buildVotingPeriodProposalAction,
  buildVotingPeriodProposalDescription,
  getProposalReturnHref,
  hoursToBlocks,
  type ProposalOrigin,
} from "@/lib/governance/create-proposal";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
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

type ComposerStep = "draft" | "review" | "submitted";

function isBigIntOrNumber(value: unknown): value is bigint | number {
  return typeof value === "bigint" || typeof value === "number";
}

export default function CreateProposalClient({
  origin,
}: CreateProposalClientProps) {
  const { address, isConnected } = useAccount();
  const [title, setTitle] = useState("Adjust voting period");
  const [summary, setSummary] = useState("");
  const [hours, setHours] = useState("10");
  const [step, setStep] = useState<ComposerStep>("draft");
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const returnHref = getProposalReturnHref(origin);

  const {
    data: currentVotingPeriod,
    isLoading: isLoadingVotingPeriod,
    isError: isVotingPeriodError,
  } = useReadContract({
    abi: myGovernorAbi,
    address: MY_GOVERNOR_ADDRESS,
    functionName: "votingPeriod",
  });

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

  const nextVotingPeriodBlocks = useMemo(() => {
    const parsedHours = Number(hours);
    return hoursToBlocks(parsedHours);
  }, [hours]);

  const nextVotingPeriodApproxHours = useMemo(() => {
    return blocksToApproxHours(nextVotingPeriodBlocks);
  }, [nextVotingPeriodBlocks]);

  const currentVotingPeriodApproxHours = useMemo(() => {
    if (!isBigIntOrNumber(currentVotingPeriod)) {
      return null;
    }

    return blocksToApproxHours(currentVotingPeriod);
  }, [currentVotingPeriod]);

  const readinessState = useMemo(() => {
    if (!isConnected || !address) {
      return {
        label: "Setup required",
        description:
          "We need to finish preparing your account before you can create a proposal.",
        canContinue: false,
      };
    }

    if (
      isLoadingVotingPeriod ||
      isLoadingThreshold ||
      isLoadingDelegate ||
      isLoadingVotes
    ) {
      return {
        label: "We need to finish preparing your account",
        description: "We are checking whether proposal creation is ready.",
        canContinue: false,
      };
    }

    if (
      isVotingPeriodError ||
      isThresholdError ||
      isDelegateError ||
      isVotesError ||
      !isBigIntOrNumber(currentVotingPeriod) ||
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
      description: "You can review the change and submit your proposal.",
      canContinue: true,
    };
  }, [
    address,
    currentVotingPeriod,
    delegatedTo,
    isConnected,
    isDelegateError,
    isLoadingDelegate,
    isLoadingThreshold,
    isLoadingVotes,
    isLoadingVotingPeriod,
    isThresholdError,
    isVotesError,
    isVotingPeriodError,
    proposalThreshold,
    votes,
  ]);

  const {
    data: hash,
    isPending: isWritePending,
    writeContract,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  const isSubmitting = isWritePending || isConfirming;

  function handleReview() {
    if (!readinessState.canContinue) {
      return;
    }

    setSubmissionError(null);
    setStep("review");
  }

  function handleBackToDraft() {
    setStep("draft");
  }

  function handleSubmitProposal() {
    try {
      setSubmissionError(null);

      const action = buildVotingPeriodProposalAction(nextVotingPeriodBlocks);
      const description = buildVotingPeriodProposalDescription({
        title,
        summary,
        newVotingPeriodBlocks: nextVotingPeriodBlocks,
        newVotingPeriodHours: nextVotingPeriodApproxHours,
      });

      writeContract({
        abi: myGovernorAbi,
        address: MY_GOVERNOR_ADDRESS,
        functionName: "propose",
        args: [action.targets, action.values, action.calldatas, description],
      });
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We could not submit your proposal.",
      );
    }
  }

  if (isConfirmed) {
    return (
      <div className="dashboard-section-stack">
        <div className="empty-state empty-state--compact">
          <div className="empty-state__icon" aria-hidden="true">
            ✓
          </div>
          <h2>Proposal submitted</h2>
          <p>
            Your proposal has been sent successfully and should appear after the
            network confirms it.
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
    <div className="dashboard-section-stack">
      <div className="dashboard-cta-card">
        <div className="dashboard-cta-card__content">
          <p className="section-kicker">{readinessState.label}</p>
          <h2 className="dashboard-cta-card__title">
            Change how long voting stays open
          </h2>
          <p className="dashboard-cta-card__description">
            {readinessState.description}
          </p>
        </div>
      </div>

      {step === "draft" ? (
        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Proposal title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              style={{
                minHeight: 48,
                padding: "0 14px",
                borderRadius: 12,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "white",
                fontSize: 16,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>New voting duration</span>
            <input
              type="number"
              min={1}
              step={0.5}
              inputMode="decimal"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              style={{
                minHeight: 48,
                padding: "0 14px",
                borderRadius: 12,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "white",
                fontSize: 16,
              }}
            />
            <span style={{ color: "rgba(15, 23, 42, 0.72)", fontSize: 14 }}>
              We will convert this to blocks when your proposal is submitted.
            </span>
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Why this change?</span>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Explain why this voting duration would work better for the group."
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

          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 16,
              borderRadius: 16,
              background: "rgba(15, 23, 42, 0.04)",
            }}
          >
            <p style={{ fontWeight: 600 }}>Preview</p>
            <p>
              Current voting duration:{" "}
              {currentVotingPeriodApproxHours === null
                ? "Loading..."
                : `about ${currentVotingPeriodApproxHours} hours`}
            </p>
            <p>
              New voting duration: about {nextVotingPeriodApproxHours} hours
            </p>
          </div>

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
              onClick={handleReview}
              disabled={
                !readinessState.canContinue ||
                title.trim().length === 0 ||
                summary.trim().length === 0 ||
                Number(hours) <= 0
              }
            >
              Review proposal
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
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
                Proposal title
              </p>
              <p style={{ fontWeight: 600 }}>{title}</p>
            </div>

            <div>
              <p style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.72)" }}>
                Current voting duration
              </p>
              <p>
                {currentVotingPeriodApproxHours === null
                  ? "Loading..."
                  : `about ${currentVotingPeriodApproxHours} hours`}
              </p>
            </div>

            <div>
              <p style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.72)" }}>
                New voting duration
              </p>
              <p>
                about {nextVotingPeriodApproxHours} hours (
                {nextVotingPeriodBlocks} blocks)
              </p>
            </div>

            <div>
              <p style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.72)" }}>
                Summary
              </p>
              <p>{summary}</p>
            </div>
          </div>

          {submissionError ? (
            <p style={{ color: "rgb(185, 28, 28)" }}>{submissionError}</p>
          ) : null}

          {hash ? (
            <p style={{ color: "rgba(15, 23, 42, 0.72)" }}>
              {isConfirming
                ? "Submitting your proposal..."
                : "Waiting for network confirmation..."}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="button button--secondary"
              onClick={handleBackToDraft}
              disabled={isSubmitting}
            >
              Back
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={handleSubmitProposal}
              disabled={isSubmitting || !readinessState.canContinue}
            >
              {isSubmitting ? "Submitting your proposal" : "Submit proposal"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
