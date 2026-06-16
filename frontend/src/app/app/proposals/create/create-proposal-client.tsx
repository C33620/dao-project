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
  GOVERNANCE_TOKEN_ADDRESS,
  MY_GOVERNOR_ADDRESS,
} from "@/lib/web3/contracts";
import type { ProposalCategory } from "@/types/governance";
import {
  BrowserProvider,
  Contract,
  Interface,
  JsonRpcProvider,
  type TransactionReceipt,
} from "ethers";
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
  if (!value || typeof value !== "object") {
    return false;
  }

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
    ].includes(proposal.status)
  );
}

function isBigIntOrNumber(value: unknown): value is bigint | number {
  return typeof value === "bigint" || typeof value === "number";
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && value.startsWith("0x");
}

function isBigInt(value: unknown): value is bigint {
  return typeof value === "bigint";
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function extractProposalIdFromReceipt(receipt: unknown): bigint | null {
  if (!receipt || typeof receipt !== "object" || !("logs" in receipt)) {
    return null;
  }

  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const governorInterface = new Interface(myGovernorAbi);

  for (const log of logs) {
    if (
      !log ||
      typeof log !== "object" ||
      !("address" in log) ||
      !("topics" in log) ||
      !("data" in log)
    ) {
      continue;
    }

    if (
      typeof log.address !== "string" ||
      log.address.toLowerCase() !== MY_GOVERNOR_ADDRESS.toLowerCase()
    ) {
      continue;
    }

    if (!Array.isArray(log.topics)) {
      continue;
    }

    try {
      const parsedLog = governorInterface.parseLog({
        topics: log.topics as string[],
        data: typeof log.data === "string" ? log.data : "0x",
      });

      if (parsedLog?.name !== "ProposalCreated") {
        continue;
      }

      const proposalId = parsedLog.args?.proposalId ?? parsedLog.args?.[0];

      if (isBigInt(proposalId)) {
        return proposalId;
      }
    } catch (error) {
      console.error("PROPOSAL_CREATED_EVENT_DECODE_ERROR", error);
    }
  }

  return null;
}

function getReceiptProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Sepolia RPC URL is not configured on the frontend.");
  }

  return new JsonRpcProvider(rpcUrl);
}

async function waitForReceiptWithFallback(
  txHash: string,
  provider: JsonRpcProvider,
  timeoutMs = 90_000,
  attempts = 6,
  delayMs = 5_000,
): Promise<TransactionReceipt> {
  const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs);

  if (receipt) {
    return receipt;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const fallbackReceipt = await provider.getTransactionReceipt(txHash);

    if (fallbackReceipt) {
      return fallbackReceipt as TransactionReceipt;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `Transaction was submitted but no receipt was found yet. Hash: ${txHash}`,
  );
}

async function deriveProposalId({
  targets,
  values,
  calldatas,
  descriptionHash,
}: {
  targets: readonly `0x${string}`[];
  values: readonly bigint[];
  calldatas: readonly `0x${string}`[];
  descriptionHash: `0x${string}`;
}): Promise<bigint | null> {
  try {
    const magic = getMagicClient();
    const provider = new BrowserProvider(magic.rpcProvider);
    const governorContract = new Contract(
      MY_GOVERNOR_ADDRESS,
      myGovernorAbi,
      provider,
    );

    if (typeof governorContract.getProposalId === "function") {
      const proposalId = await governorContract.getProposalId(
        targets,
        values,
        calldatas,
        descriptionHash,
      );

      if (isBigInt(proposalId)) {
        return proposalId;
      }
    }

    if (typeof governorContract.hashProposal === "function") {
      const proposalId = await governorContract.hashProposal(
        targets,
        values,
        calldatas,
        descriptionHash,
      );

      if (isBigInt(proposalId)) {
        return proposalId;
      }
    }
  } catch (error) {
    console.error("PROPOSAL_ID_DERIVATION_ERROR", error);
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Something went wrong.";
}

function getNestedRpcMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  if (
    "error" in error &&
    error.error &&
    typeof error.error === "object" &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }

  if (
    "info" in error &&
    error.info &&
    typeof error.info === "object" &&
    "error" in error.info &&
    error.info.error &&
    typeof error.info.error === "object" &&
    "message" in error.info.error &&
    typeof error.info.error.message === "string"
  ) {
    return error.info.error.message;
  }

  return null;
}

function normalizeSubmissionError(error: unknown): string {
  const directMessage = getErrorMessage(error).toLowerCase();
  const nestedMessage = getNestedRpcMessage(error)?.toLowerCase() ?? "";
  const combined = `${directMessage} ${nestedMessage}`;

  if (
    combined.includes("replacement fee too low") ||
    combined.includes("replacement transaction underpriced") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "REPLACEMENT_UNDERPRICED")
  ) {
    return "A previous wallet transaction appears to still be active in the provider. Please wait a moment and try again.";
  }

  if (combined.includes("gapped-nonce tx from delegated accounts")) {
    return "This wallet still has unresolved delegated-account transaction state. Please wait for the previous transaction to settle before trying again.";
  }

  if (
    combined.includes(
      "in-flight transaction limit reached for delegated accounts",
    )
  ) {
    return "This wallet already has an in-flight delegated transaction. Please wait for it to confirm before submitting another proposal.";
  }

  if (combined.includes("already has a pending transaction")) {
    return "This wallet already has a pending transaction. Please wait for it to confirm before submitting another proposal.";
  }

  if (combined.includes("user rejected") || combined.includes("user denied")) {
    return "The wallet confirmation was cancelled.";
  }

  if (combined.includes("insufficient funds")) {
    return getErrorMessage(error);
  }

  return getErrorMessage(error);
}

function getRpcErrorData(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("data" in error && typeof error.data === "string") {
    return error.data;
  }

  if (
    "info" in error &&
    error.info &&
    typeof error.info === "object" &&
    "error" in error.info &&
    error.info.error &&
    typeof error.info.error === "object" &&
    "data" in error.info.error &&
    typeof error.info.error.data === "string"
  ) {
    return error.info.error.data;
  }

  return null;
}

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
  const [governorTxHash, setGovernorTxHash] = useState<string | null>(null);

  const createdProposalIdRef = useRef<bigint | null>(null);
  const submitLockRef = useRef(false);
  const delegationLockRef = useRef(false);
  const isMountedRef = useRef(true);
  const router = useRouter();

  const [resolvedCancelTargetOptions, setResolvedCancelTargetOptions] =
    useState<CancelTargetOption[]>(cancelTargetOptions);
  const [isLoadingCancelTargetOptions, setIsLoadingCancelTargetOptions] =
    useState(mode === "cancel" && cancelTargetOptions.length === 0);

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
          .filter((proposal) => proposal.status === "executed")
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

  const safeSetGovernorTxHash = (value: string | null) => {
    if (isMountedRef.current) {
      setGovernorTxHash(value);
    }
  };

  const returnHref = getProposalReturnHref(origin);
  const proposalKind = mode === "cancel" ? "cancel" : "standard";

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

    safeSetGovernorTxHash(null);
    createdProposalIdRef.current = null;
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

    setSubmissionError(null);
    setSubmissionStage("review");
    setIsReviewOpen(true);
  }
  function handleCloseReview() {
    if (isSubmittingProposal) {
      return;
    }

    safeSetSubmissionStage("idle");
    setIsReviewOpen(false);
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
      setSubmissionError("Select an executed proposal to cancel.");
      return;
    }

    submitLockRef.current = true;

    try {
      resetSubmissionFlow();
      setSubmissionStage("wallet-governor");

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
        throw new Error(
          "This wallet already has a pending transaction. Please wait for it to confirm before submitting another proposal.",
        );
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
          `insufficient funds for gas * price + value: have ${nativeBalance.toString()} want ${estimatedNetworkCost.toString()}`,
        );
      }

      const governorTx = await signer.sendTransaction({
        to: MY_GOVERNOR_ADDRESS,
        data: txData,
        value: BigInt(0),
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
      });

      console.log("GOVERNOR_TX_SUBMITTED", { hash: governorTx.hash });

      setGovernorTxHash(governorTx.hash ?? null);
      setSubmissionStage("creating-proposal");

      const governorReceipt = await waitForReceiptWithFallback(
        governorTx.hash,
        receiptProvider,
        90_000,
      );

      let proposalId = extractProposalIdFromReceipt(governorReceipt);

      if (!proposalId) {
        proposalId = await deriveProposalId({
          targets: action.targets,
          values: action.values,
          calldatas: action.calldatas,
          descriptionHash: action.descriptionHash,
        });
      }

      if (!isBigInt(proposalId)) {
        throw new Error("Unable to determine the canonical proposal ID.");
      }

      createdProposalIdRef.current = proposalId;

      setStoredProposalLifecycle({ proposalId });

      setSubmissionStage("saving-metadata");

      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proposalId: proposalId.toString(),
          title: proposalTitle,
          excerpt: proposalSummary || proposalTitle,
          description: proposalDescription,
          descriptionHash: action.descriptionHash,
          category: effectiveCategory,
          proposerAddress: accountAddress,
          governorTxHash: governorTx.hash ?? null,
          targets: action.targets,
          values: action.values.map((value) => value.toString()),
          calldatas: action.calldatas,
          proposalKind,
          canceledProposalId:
            mode === "cancel"
              ? selectedCanceledProposal?.proposalId ?? null
              : null,
          canceledProposalTitle:
            mode === "cancel" ? selectedCanceledProposal?.title ?? null : null,
        }),
      });
      if (!response.ok) {
        throw new Error("Proposal metadata request failed.");
      }

      setIsReviewOpen(false);

      void fetch("/api/revalidate-governance", {
        method: "POST",
      });

      window.location.assign(`${returnHref}?created=${proposalId.toString()}`);
      return;
    } catch (error) {
      console.error("GOVERNOR_PROPOSAL_SUBMISSION_ERROR", error);

      if (governorTxHash || createdProposalIdRef.current) {
        setSubmissionStage("error");
        setSubmissionError(
          `The blockchain transaction may already have succeeded, but the final save step did not complete cleanly. ${
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

      setSubmissionStage("error");
      setSubmissionError(normalizeSubmissionError(error));
    } finally {
      submitLockRef.current = false;
    }
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

        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
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
            <InlineMessage
              tone="info"
              message={`Proposal ID ready: ${storedProposalLifecycle.proposalId.toString()}`}
            />
          ) : null}

          {governorTxHash ? (
            <InlineMessage tone="info" message="Proposal submitted." />
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
              onClick={() => router.back()}
              className="button button--secondary"
            >
              Cancel
            </button>

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
