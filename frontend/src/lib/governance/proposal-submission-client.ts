import type { ProposalCategory } from "@/types/governance";

export type ProposalKind = "standard" | "cancel";

export type ProposalSubmissionPayload = {
  idempotencyKey: string;
  title: string;
  excerpt: string;
  description: string;
  descriptionHash: `0x${string}`;
  category: ProposalCategory;
  proposerAddress: `0x${string}`;
  proposalKind: ProposalKind;
  canceledProposalId?: string | null;
  canceledProposalTitle?: string | null;
  targets: `0x${string}`[];
  values: string[];
  calldatas: `0x${string}`[];
};

type CreateSubmissionResponse = {
  data?: {
    submissionId: string;
    status: string;
  };
  error?: string;
};

type AttachSubmissionTxResponse = {
  data?: {
    id: string;
    status: string;
    governorTxHash: string;
    idempotent?: boolean;
  };
  error?: string;
};

type FinalizeSubmissionResponse = {
  data?: {
    status?: string;
    proposalId?: string;
    governorTxHash?: string;
    idempotent?: boolean;
  };
  error?: string;
};

export async function createProposalSubmission(
  payload: ProposalSubmissionPayload,
): Promise<string> {
  const response = await fetch("/api/proposals/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response
    .json()
    .catch(() => null)) as CreateSubmissionResponse | null;

  if (!response.ok || !result?.data?.submissionId) {
    throw new Error(result?.error || "Could not start proposal submission.");
  }

  return result.data.submissionId;
}

export async function attachProposalSubmissionTx(
  submissionId: string,
  txHash: string,
) {
  console.log("ATTACH_PROPOSAL_TX_REQUEST", {
    submissionId,
    txHash,
  });

  const response = await fetch(
    `/api/proposals/submissions/${submissionId}/attach-tx`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        txHash,
      }),
    },
  );

  const result = (await response
    .json()
    .catch(() => null)) as AttachSubmissionTxResponse | null;

  console.log("ATTACH_PROPOSAL_TX_RESPONSE", {
    ok: response.ok,
    status: response.status,
    result,
  });

  if (!response.ok) {
    throw new Error(
      result?.error ?? "Failed to attach proposal transaction hash.",
    );
  }

  return result?.data ?? null;
}

export async function finalizeProposalSubmission(
  submissionId: string,
  proposalId: string,
) {
  const response = await fetch(
    `/api/proposals/submissions/${submissionId}/finalize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        proposalId,
      }),
    },
  );

  const result = (await response
    .json()
    .catch(() => null)) as FinalizeSubmissionResponse | null;

  if (!response.ok) {
    const status = result?.data?.status;

    if (status === "pending_confirmation" || status === "retryable_error") {
      throw new Error(
        result?.error || "Proposal finalization is not ready yet.",
      );
    }

    throw new Error(result?.error || "Could not finalize proposal.");
  }

  return result?.data ?? null;
}
