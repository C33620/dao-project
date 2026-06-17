"use client";

import governanceTokenAbi from "@/abi/GovernanceToken.json";
import myGovernorAbi from "@/abi/MyGovernor.json";
import { getMagicClient } from "@/lib/auth/magic-client";
import {
  buildPersistedProposalAction,
  buildProposalDescription,
  buildProposalSummary,
  buildProposalTitle,
  getProposalCategoryLabel,
  getProposalReturnHref,
  PROPOSAL_CATEGORY_OPTIONS,
  type ProposalOrigin,
} from "@/lib/governance/create-proposal";
import {
  deriveProposalId,
  extractProposalIdFromReceipt,
  getReceiptProvider,
  waitForReceiptWithFallback,
} from "@/lib/governance/proposal-submission-chain";
import {
  attachProposalSubmissionTx,
  createProposalSubmission,
  finalizeProposalSubmission,
  type ProposalKind,
  type ProposalSubmissionPayload,
} from "@/lib/governance/proposal-submission-client";
import {
  getRpcErrorData,
  normalizeSubmissionError,
} from "@/lib/governance/proposal-submission-errors";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
} from "@/lib/web3/contracts";
import type { ProposalCategory } from "@/types/governance";
import { BrowserProvider, Contract, Interface } from "ethers";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReadContract } from "wagmi";

type CreateProposalMode = "standard" | "cancel";

type CancelTargetOption = {
  proposalId: string;
  title: string;
  category: ProposalCategory;
  executedAt?: string;
};

type CreateProposalClientProps = {
  origin: ProposalOrigin;
  walletAddress: `0x${string}` | null;
  accountReadiness: {
    isCheckingAccount: boolean;
    isAccountReadyFromAppState: boolean;
  };
  mode?: CreateProposalMode;
  cancelTargetOptions?: CancelTargetOption[];
};

type SubmissionStage =
  | "idle"
  | "review"
  | "wallet-governor"
  | "creating-proposal"
  | "saving-metadata"
  | "error";

type DelegationStage = "idle" | "wallet" | "pending" | "error";

type StoredProposalLifecycle = {
  proposalId: bigint;
  state?: bigint;
  snapshot?: bigint;
  deadline?: bigint;
};

type ProposalStatus =
  | "pending"
  | "active"
  | "succeeded"
  | "defeated"
  | "queued"
  | "executed"
  | "canceled"
  | "expired";

type ProposalListItem = {
  id: string;
  title: string;
  category: ProposalCategory;
  status: ProposalStatus;
  executedAt?: string | null;
  isCanceled?: boolean;
  kind?: ProposalKind;
  cancelVisibilityState?: "visible" | "hidden";
};

function isProposalCategory(value: unknown): value is ProposalCategory {
  return (
    value === "COFFEE_MEETUP" ||
    value === "HACK_DAY" ||
    value === "WORKSHOP" ||
    value === "OTHER"
  );
}

function isProposalListItem(value: unknown): value is ProposalListItem {
  if (!value || typeof value !== "object") return false;

  const proposal = value as Record<string, unknown>;

  return (
    typeof proposal.id === "string" &&
    typeof proposal.title === "string" &&
    isProposalCategory(proposal.category) &&
    typeof proposal.status === "string" &&
    [
      "pending",
      "active",
      "succeeded",
      "defeated",
      "queued",
      "executed",
      "canceled",
      "expired",
    ].includes(proposal.status) &&
    (proposal.executedAt === undefined ||
      proposal.executedAt === null ||
      typeof proposal.executedAt === "string") &&
    (proposal.isCanceled === undefined ||
      typeof proposal.isCanceled === "boolean")
  );
}

function isBigIntOrNumber(value: unknown): value is bigint | number {
  return typeof value === "bigint" || typeof value === "number";
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && value.startsWith("0x");
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function InlineMessage({
  message,
  tone = "error",
  margin = 0,
}: {
  message: string;
  tone?: "error" | "info";
  margin?: number;
}) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      style={{
        margin,
        padding: "12px 14px",
        borderRadius: 12,
        border: isError
          ? "1px solid rgba(185, 28, 28, 0.18)"
          : "1px solid rgba(15, 23, 42, 0.10)",
        background: isError
          ? "rgba(254, 242, 242, 0.92)"
          : "rgba(15, 23, 42, 0.04)",
        color: isError ? "rgb(153, 27, 27)" : "rgba(15, 23, 42, 0.78)",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

export default function CreateProposalClient({
  origin,
  walletAddress,
  accountReadiness,
  mode = "standard",
  cancelTargetOptions = [],
}: CreateProposalClientProps) {
  const router = useRouter();
  const accountAddress = walletAddress;

  const [proposalText, setProposalText] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<ProposalCategory | "">("");
  const [selectedCanceledProposalId, setSelectedCanceledProposalId] =
    useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissionStage, setSubmissionStage] =
    useState<SubmissionStage>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [delegationStage, setDelegationStage] =
    useState<DelegationStage>("idle");
  const [delegationError, setDelegationError] = useState<string | null>(null);
  const [storedProposalLifecycle, setStoredProposalLifecycle] =
    useState<StoredProposalLifecycle | null>(null);
  const [hasMetadataWriteStarted, setHasMetadataWriteStarted] = useState(false);
  const [hasCreatedProposalId, setHasCreatedProposalId] = useState(false);
  const [governorTxHash, setGovernorTxHash] = useState<string | null>(null);
  const [resolvedCancelTargetOptions, setResolvedCancelTargetOptions] =
    useState<CancelTargetOption[]>(cancelTargetOptions);
  const [isLoadingCancelTargetOptions, setIsLoadingCancelTargetOptions] =
    useState(mode === "cancel" && cancelTargetOptions.length === 0);

  const createdProposalIdRef = useRef<bigint | null>(null);
  const submissionIdRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);
  const delegationLockRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (mode !== "cancel" || cancelTargetOptions.length > 0) {
      return;
    }

    let isActive = true;

    async function loadCancelTargetOptions() {
      try {
        setIsLoadingCancelTargetOptions(true);

        const response = await fetch("/api/proposals", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load executed proposals.");
        }

        const result: unknown = await response.json();
        const proposals: ProposalListItem[] =
          result &&
          typeof result === "object" &&
          "data" in result &&
          Array.isArray(result.data)
            ? result.data.filter(isProposalListItem)
            : [];

        const executedOptions: CancelTargetOption[] = proposals
          .filter(
            (proposal) =>
              proposal.status === "executed" &&
              proposal.kind !== "cancel" &&
              !proposal.isCanceled &&
              proposal.cancelVisibilityState !== "hidden",
          )
          .map((proposal) => ({
            proposalId: proposal.id,
            title: proposal.title,
            category: proposal.category,
            executedAt: proposal.executedAt ?? undefined,
          }));

        if (isActive) {
          setResolvedCancelTargetOptions(executedOptions);
        }
      } catch (error) {
        console.error("LOAD_CANCEL_TARGET_OPTIONS_ERROR", error);

        if (isActive) {
          setResolvedCancelTargetOptions([]);
        }
      } finally {
        if (isActive) {
          setIsLoadingCancelTargetOptions(false);
        }
      }
    }

    void loadCancelTargetOptions();

    return () => {
      isActive = false;
    };
  }, [mode, cancelTargetOptions]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetSubmissionStage = (value: SubmissionStage) => {
    if (isMountedRef.current) {
      setSubmissionStage(value);
    }
  };

  const safeSetSubmissionError = (value: string | null) => {
    if (isMountedRef.current) {
      setSubmissionError(value);
    }
  };

  const safeSetDelegationStage = (value: DelegationStage) => {
    if (isMountedRef.current) {
      setDelegationStage(value);
    }
  };

  const safeSetDelegationError = (value: string | null) => {
    if (isMountedRef.current) {
      setDelegationError(value);
    }
  };

  const safeSetStoredProposalLifecycle = (
    value: StoredProposalLifecycle | null,
  ) => {
    if (isMountedRef.current) {
      setStoredProposalLifecycle(value);
    }
  };

  const safeSetHasMetadataWriteStarted = (value: boolean) => {
    if (isMountedRef.current) {
      setHasMetadataWriteStarted(value);
    }
  };

  const safeSetHasCreatedProposalId = (value: boolean) => {
    if (isMountedRef.current) {
      setHasCreatedProposalId(value);
    }
  };

  const safeSetGovernorTxHash = (value: string | null) => {
    if (isMountedRef.current) {
      setGovernorTxHash(value);
    }
  };

  const safeSetIsReviewOpen = (value: boolean) => {
    if (isMountedRef.current) {
      setIsReviewOpen(value);
    }
  };

  const returnHref = getProposalReturnHref(origin);
  const proposalKind: ProposalKind = mode === "cancel" ? "cancel" : "standard";

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

  const selectedCanceledProposal = useMemo(
    () =>
      resolvedCancelTargetOptions.find(
        (item) => item.proposalId === selectedCanceledProposalId,
      ) ?? null,
    [resolvedCancelTargetOptions, selectedCanceledProposalId],
  );

  const effectiveCategory =
    mode === "cancel" ? selectedCanceledProposal?.category ?? "" : category;

  const proposalTitle = buildProposalTitle(proposalText);
  const proposalSummary = buildProposalSummary(details);
  const proposalDescription = buildProposalDescription({
    proposalText,
    details,
  });

  const hasCancelSelection =
    mode === "cancel" ? Boolean(selectedCanceledProposalId) : true;

  const hasResolvedCancelSelection =
    mode === "cancel" ? Boolean(selectedCanceledProposal) : true;

  const action = useMemo(
    () =>
      buildPersistedProposalAction({
        mode,
        description: proposalDescription,
      }),
    [mode, proposalDescription],
  );

  const isSubmittingProposal =
    submissionStage === "wallet-governor" ||
    submissionStage === "creating-proposal" ||
    submissionStage === "saving-metadata";

  const isDelegationBusy =
    delegationStage === "wallet" || delegationStage === "pending";

  const isSubmissionSuccess =
    submissionStage === "idle" &&
    !isReviewOpen &&
    hasMetadataWriteStarted &&
    !submissionError &&
    hasCreatedProposalId;

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

    if (!accountReadiness.isAccountReadyFromAppState || !accountAddress) {
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
      description:
        mode === "cancel"
          ? "Choose an executed proposal, explain the cancellation, and continue when ready."
          : "Write your proposal, review it, and continue when ready.",
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
    mode,
    proposalThreshold,
    votes,
  ]);

  function resetSubmissionFlow() {
    safeSetSubmissionError(null);
    safeSetStoredProposalLifecycle(null);
    safeSetHasMetadataWriteStarted(false);
    safeSetHasCreatedProposalId(false);
    safeSetGovernorTxHash(null);
    createdProposalIdRef.current = null;
    submissionIdRef.current = null;
  }

  function handleOpenReview() {
    const hasRequiredSelection =
      mode === "cancel"
        ? Boolean(selectedCanceledProposalId)
        : Boolean(category);

    if (!hasRequiredSelection) {
      setSubmissionError(
        mode === "cancel"
          ? "Select an executed proposal first."
          : "Select a category first.",
      );
      return;
    }

    if (!readinessState.canReview) {
      setSubmissionError(
        `${readinessState.label}. ${readinessState.description}`,
      );
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
    if (!accountAddress || isDelegationBusy || delegationLockRef.current) {
      return;
    }

    delegationLockRef.current = true;

    try {
      safeSetDelegationError(null);
      safeSetDelegationStage("wallet");

      const magic = getMagicClient();
      const provider = new BrowserProvider(magic.rpcProvider);
      const signer = await provider.getSigner();
      const receiptProvider = getReceiptProvider();

      const governanceTokenContract = new Contract(
        GOVERNANCE_TOKEN_ADDRESS,
        governanceTokenAbi,
        signer,
      );

      safeSetDelegationStage("pending");

      const tx = await governanceTokenContract.delegate(accountAddress);

      await waitForReceiptWithFallback(tx.hash, receiptProvider, 90_000);

      async function waitForVotingPowerRefresh() {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const [balanceResult, delegatesResult, votesResult] =
            await Promise.all([
              refetchBalance(),
              refetchDelegates(),
              refetchVotes(),
            ]);

          const nextBalance = balanceResult.data;
          const nextDelegate = delegatesResult.data;
          const nextVotes = votesResult.data;

          const hasBalance =
            (typeof nextBalance === "bigint" ||
              typeof nextBalance === "number") &&
            nextBalance > 0;

          const isSelfDelegated =
            typeof nextDelegate === "string" &&
            accountAddress !== null &&
            nextDelegate.toLowerCase() === accountAddress.toLowerCase();

          const hasVotes =
            (typeof nextVotes === "bigint" || typeof nextVotes === "number") &&
            (typeof proposalThreshold === "bigint" ||
              typeof proposalThreshold === "number") &&
            nextVotes >= proposalThreshold;

          if (hasBalance && isSelfDelegated && hasVotes) {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      await waitForVotingPowerRefresh();
      await Promise.all([refetchBalance(), refetchDelegates(), refetchVotes()]);

      safeSetDelegationStage("idle");
    } catch (error) {
      console.error("SELF_DELEGATION_WRITE_ERROR", error);
      safeSetDelegationStage("error");
      safeSetDelegationError(normalizeSubmissionError(error));
    } finally {
      delegationLockRef.current = false;
    }
  }

  async function handleSubmitGovernorProposal() {
    if (!accountAddress || !effectiveCategory) {
      return;
    }

    if (submitLockRef.current) {
      return;
    }

    if (mode === "cancel" && !selectedCanceledProposal) {
      safeSetSubmissionError("Select an executed proposal to cancel.");
      return;
    }

    submitLockRef.current = true;

    let submittedTxHash: string | null = null;

    try {
      resetSubmissionFlow();

      const submissionPayload: ProposalSubmissionPayload = {
        idempotencyKey:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${accountAddress}-${Date.now()}`,
        title: proposalTitle,
        excerpt: proposalSummary || proposalTitle,
        description: proposalDescription,
        descriptionHash: action.descriptionHash,
        category: effectiveCategory,
        proposerAddress: accountAddress,
        proposalKind,
        canceledProposalId:
          mode === "cancel"
            ? selectedCanceledProposal?.proposalId ?? null
            : null,
        canceledProposalTitle:
          mode === "cancel" ? selectedCanceledProposal?.title ?? null : null,
        targets: action.targets,
        values: action.values.map((value) => value.toString()),
        calldatas: action.calldatas,
      };

      const submissionId = await createProposalSubmission(submissionPayload);
      submissionIdRef.current = submissionId;

      safeSetSubmissionStage("wallet-governor");

      const magic = getMagicClient();
      const provider = new BrowserProvider(magic.rpcProvider);
      const signer = await provider.getSigner();
      const receiptProvider = getReceiptProvider();

      const governorContract = new Contract(
        MY_GOVERNOR_ADDRESS,
        myGovernorAbi,
        signer,
      );

      console.log("PROPOSAL_DEBUG", {
        proposalKind,
        proposalThreshold,
        balance,
        votes,
        delegatedTo,
        submissionId,
        targets: action.targets,
        values: action.values,
        calldatas: action.calldatas,
        description: proposalDescription,
        descriptionHash: action.descriptionHash,
        canceledProposalId: selectedCanceledProposal?.proposalId ?? null,
      });

      const latestNonce = await receiptProvider.getTransactionCount(
        accountAddress,
        "latest",
      );

      const pendingNonce = await receiptProvider.getTransactionCount(
        accountAddress,
        "pending",
      );

      if (pendingNonce > latestNonce) {
        console.warn("PENDING_NONCE_DETECTED", {
          accountAddress,
          latestNonce: latestNonce.toString(),
          pendingNonce: pendingNonce.toString(),
          submissionId,
        });
      }

      const feeData = await receiptProvider.getFeeData();

      const txData = governorContract.interface.encodeFunctionData("propose", [
        action.targets,
        action.values,
        action.calldatas,
        proposalDescription,
      ]);

      const estimatedGas = await receiptProvider.estimateGas({
        from: accountAddress,
        to: MY_GOVERNOR_ADDRESS,
        data: txData,
        value: BigInt(0),
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
      });

      const nativeBalance = await receiptProvider.getBalance(accountAddress);
      const maxFeePerGas =
        feeData.maxFeePerGas ?? feeData.gasPrice ?? BigInt(0);
      const estimatedNetworkCost = estimatedGas * maxFeePerGas;

      if (nativeBalance < estimatedNetworkCost) {
        throw new Error(
          "You do not have enough Sepolia ETH to pay gas for this transaction. Contact an admin.",
        );
      }

      const governorTx = await signer.sendTransaction({
        to: MY_GOVERNOR_ADDRESS,
        data: txData,
        value: BigInt(0),
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
      });

      submittedTxHash = governorTx.hash ?? null;

      console.log("GOVERNOR_TX_SUBMITTED", { hash: submittedTxHash });

      if (!submittedTxHash) {
        throw new Error(
          "Missing transaction hash from submitted governor transaction.",
        );
      }

      safeSetGovernorTxHash(submittedTxHash);

      await attachProposalSubmissionTx(submissionId, submittedTxHash);

      safeSetSubmissionStage("creating-proposal");

      const receiptResult = await waitForReceiptWithFallback(
        submittedTxHash,
        receiptProvider,
        90_000,
      );

      if (receiptResult.status === "pending") {
        safeSetSubmissionStage("error");
        safeSetSubmissionError(
          "Your transaction was submitted, but confirmation is taking longer than expected. Do not resubmit. Refresh later or use the existing submission to finalize once the network catches up.",
        );
        return;
      }

      const governorReceipt = receiptResult.receipt;

      let proposalId = extractProposalIdFromReceipt(governorReceipt);

      if (!proposalId) {
        proposalId = await deriveProposalId({
          targets: action.targets,
          values: action.values,
          calldatas: action.calldatas,
          descriptionHash: action.descriptionHash,
        });
      }

      if (typeof proposalId !== "bigint") {
        throw new Error("Unable to determine the canonical proposal ID.");
      }

      createdProposalIdRef.current = proposalId;
      safeSetHasCreatedProposalId(true);
      safeSetStoredProposalLifecycle({ proposalId });
      safeSetHasMetadataWriteStarted(true);
      safeSetSubmissionStage("saving-metadata");

      await finalizeProposalSubmission(submissionId, proposalId.toString());

      await fetch("/api/revalidate-governance", {
        method: "POST",
      });

      safeSetIsReviewOpen(false);
      safeSetSubmissionStage("idle");

      const destination = `${returnHref}?created=${proposalId.toString()}`;
      router.replace(destination);
      router.refresh();
    } catch (error) {
      console.error("GOVERNOR_PROPOSAL_SUBMISSION_ERROR", error);

      const hasBroadcastedTx = Boolean(submittedTxHash);
      const hasResolvedProposalId = Boolean(createdProposalIdRef.current);

      if (hasBroadcastedTx || hasResolvedProposalId) {
        safeSetSubmissionStage("error");
        safeSetSubmissionError(
          `The blockchain transaction may already have been submitted, but the final save step did not complete cleanly. ${
            createdProposalIdRef.current
              ? `Proposal ID: ${createdProposalIdRef.current.toString()}. `
              : ""
          }Please do not resubmit immediately.`,
        );
        return;
      }

      const maybeData = getRpcErrorData(error);

      if (maybeData) {
        try {
          const decodedGovernorError = new Interface(myGovernorAbi).parseError(
            maybeData,
          );
          console.error(
            "DECODED_GOVERNOR_ERROR_NAME",
            decodedGovernorError?.name,
          );
          console.error(
            "DECODED_GOVERNOR_ERROR_ARGS",
            decodedGovernorError?.args,
          );
          console.error(
            "DECODED_GOVERNOR_ERROR_SIGNATURE",
            decodedGovernorError?.signature,
          );
        } catch (decodeGovernorError) {
          console.error("FAILED_TO_DECODE_GOVERNOR_ERROR", decodeGovernorError);
        }

        try {
          const decodedTokenError = new Interface(
            governanceTokenAbi,
          ).parseError(maybeData);
          console.error("DECODED_TOKEN_ERROR", decodedTokenError);
        } catch (decodeTokenError) {
          console.error("FAILED_TO_DECODE_TOKEN_ERROR", decodeTokenError);
        }
      }

      safeSetSubmissionStage("error");
      safeSetSubmissionError(normalizeSubmissionError(error));
    } finally {
      submitLockRef.current = false;
    }
  }

  if (isSubmissionSuccess) {
    return (
      <div className="dashboard-section-stack">
        <div className="empty-state empty-state--compact">
          <div className="empty-state__icon" aria-hidden="true" />
          <h2>Proposal submitted</h2>
          <p>
            Your proposal has been created and its details were saved
            successfully. It will appear in the proposals list in a pending
            state.
          </p>
          <div className="dashboard-cta-card__actions">
            <Link href={returnHref} className="button button--primary">
              Back to previous page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showDelegationHelper =
    delegationStage === "wallet" || delegationStage === "pending";
  const showSubmissionWalletHelper = submissionStage === "wallet-governor";
  const showSavingMetadataHelper = submissionStage === "saving-metadata";

  const reviewHeading =
    mode === "cancel" ? "Review cancellation proposal" : "Review your proposal";

  const reviewButtonLabel = isSubmittingProposal
    ? "Continuing..."
    : "Accept and continue";

  const isReviewDisabled =
    !readinessState.canReview ||
    proposalText.trim().length === 0 ||
    isSubmittingProposal ||
    isDelegationBusy ||
    (mode === "cancel" ? !hasCancelSelection : !category);

  return (
    <>
      <div className="dashboard-section-stack">
        <div className="dashboard-cta-card">
          <div className="dashboard-cta-card__content">
            <p className="section-kicker">{readinessState.label}</p>
            <h2 className="dashboard-cta-card__title">
              {mode === "cancel"
                ? "Create a cancellation proposal"
                : "Create a proposal"}
            </h2>
            <p className="dashboard-cta-card__description">
              {readinessState.description}
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {mode === "cancel" ? (
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>
                Executed proposal to cancel
              </span>
              <select
                value={selectedCanceledProposalId}
                onChange={(event) =>
                  setSelectedCanceledProposalId(event.target.value)
                }
                required
                disabled={isLoadingCancelTargetOptions}
                aria-invalid={Boolean(
                  submissionError && !selectedCanceledProposalId,
                )}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  background: "white",
                  fontSize: 16,
                }}
              >
                <option value="">
                  {isLoadingCancelTargetOptions
                    ? "Loading executed proposals..."
                    : "Select an executed proposal"}
                </option>
                {resolvedCancelTargetOptions.map((option) => (
                  <option key={option.proposalId} value={option.proposalId}>
                    {option.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Category</span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ProposalCategory | "")
                }
                required
                aria-invalid={Boolean(submissionError && !category)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  background: "white",
                  fontSize: 16,
                }}
              >
                <option value="">Select a category</option>
                {PROPOSAL_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === "cancel" &&
          hasResolvedCancelSelection &&
          selectedCanceledProposal ? (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 16,
                borderRadius: 16,
                border: "1px solid rgba(155, 48, 72, 0.18)",
                background: "rgba(250, 237, 241, 0.72)",
              }}
            >
              <p
                className="section-kicker"
                style={{ margin: 0, color: "rgb(155, 48, 72)" }}
              >
                Selected proposal
              </p>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {selectedCanceledProposal.title}
              </p>
              <p style={{ margin: 0, color: "rgba(15, 23, 42, 0.72)" }}>
                Category:{" "}
                {getProposalCategoryLabel(selectedCanceledProposal.category)}
                {selectedCanceledProposal.executedAt
                  ? ` · Executed ${selectedCanceledProposal.executedAt}`
                  : ""}
              </p>
            </div>
          ) : null}

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>
              {mode === "cancel"
                ? "Why should the group cancel this proposal?"
                : "What would you like the group to consider?"}
            </span>
            <textarea
              value={proposalText}
              onChange={(event) => setProposalText(event.target.value)}
              rows={4}
              maxLength={160}
              placeholder={
                mode === "cancel"
                  ? "Write a short and clear cancellation title."
                  : "Write a short and clear proposal title."
              }
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
              placeholder={
                mode === "cancel"
                  ? "Add context that explains why this executed proposal should be canceled."
                  : "Add any context that would help the group understand this proposal."
              }
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

          {delegationError ? <InlineMessage message={delegationError} /> : null}
          {submissionError ? <InlineMessage message={submissionError} /> : null}

          {showDelegationHelper ? (
            <InlineMessage tone="info" message="Action needed to continue." />
          ) : null}

          {showSubmissionWalletHelper ? (
            <InlineMessage
              tone="info"
              message="Action needed in confirmation modal."
            />
          ) : null}

          {submissionStage === "creating-proposal" ? (
            <InlineMessage tone="info" message="Creating your proposal." />
          ) : null}

          {showSavingMetadataHelper ? (
            <InlineMessage tone="info" message="Saving proposal details." />
          ) : null}

          {storedProposalLifecycle?.proposalId ? (
            <InlineMessage tone="info" message="Proposal ready" />
          ) : null}

          {governorTxHash ? (
            <InlineMessage tone="info" message="Proposal submitted." />
          ) : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={returnHref} className="button button--secondary">
              Cancel
            </Link>

            {readinessState.needsDelegation ? (
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
                disabled={isReviewDisabled}
              >
                Review proposal
              </button>
            )}
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
                {reviewHeading}
              </h2>
              <p style={{ margin: 0, color: "rgba(15, 23, 42, 0.72)" }}>
                Check everything here first. After you continue, we will ask you
                to confirm.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                padding: 16,
                borderRadius: 16,
                background:
                  mode === "cancel"
                    ? "rgba(250, 237, 241, 0.72)"
                    : "rgba(15, 23, 42, 0.04)",
              }}
            >
              <div>
                <p style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.72)" }}>
                  Category
                </p>
                <p style={{ fontWeight: 600, margin: 0 }}>
                  {effectiveCategory
                    ? getProposalCategoryLabel(effectiveCategory)
                    : ""}
                </p>
              </div>

              {mode === "cancel" &&
              hasResolvedCancelSelection &&
              selectedCanceledProposal ? (
                <div>
                  <p style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.72)" }}>
                    Executed proposal to cancel
                  </p>
                  <p style={{ fontWeight: 600, margin: 0 }}>
                    {selectedCanceledProposal.title}
                  </p>
                </div>
              ) : null}

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

            <div>
              {submissionError ? (
                <InlineMessage message={submissionError} margin={0} />
              ) : null}

              {showSubmissionWalletHelper ? (
                <InlineMessage
                  tone="info"
                  message="Action needed in confirmation modal."
                  margin={0}
                />
              ) : null}

              {submissionStage === "creating-proposal" ? (
                <InlineMessage
                  tone="info"
                  message="Creating your proposal."
                  margin={0}
                />
              ) : null}

              {showSavingMetadataHelper ? (
                <InlineMessage
                  tone="info"
                  message="Saving proposal details."
                  margin={0}
                />
              ) : null}
            </div>

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
                onClick={() => {
                  void handleSubmitGovernorProposal();
                }}
                disabled={
                  isSubmittingProposal ||
                  !effectiveCategory ||
                  (mode === "cancel" && !hasResolvedCancelSelection)
                }
              >
                {reviewButtonLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
