import governorAbi from "@/abi/MyGovernor.json";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog, type Hex } from "viem";

import { requireUser } from "@/lib/auth";
import { getBlockchainClient } from "@/lib/blockchain/client";
import { db } from "@/lib/db";
import { GOVERNANCE_PROPOSALS_TAG } from "@/lib/services/proposals";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";

type RouteContext = {
  params: Promise<{
    submissionId: string;
  }>;
};

function normalizeAddress(value: string) {
  return value.toLowerCase();
}

function extractProposalIdFromReceipt(
  receipt: Awaited<
    ReturnType<ReturnType<typeof getBlockchainClient>["getTransactionReceipt"]>
  >,
) {
  for (const log of receipt.logs) {
    if (
      normalizeAddress(log.address) !== normalizeAddress(MY_GOVERNOR_ADDRESS)
    ) {
      continue;
    }

    try {
      const parsed = decodeEventLog({
        abi: governorAbi,
        data: log.data,
        topics: log.topics,
        strict: false,
      });

      if (parsed.eventName !== "ProposalCreated") {
        continue;
      }

      const args = parsed.args as { proposalId?: bigint } | undefined;
      if (typeof args?.proposalId === "bigint") {
        return args.proposalId;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser();
    const { submissionId } = await context.params;

    const submission = await db.proposalSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.proposerUserId !== user.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (!submission.governorTxHash) {
      return NextResponse.json(
        { error: "No transaction hash is attached to this submission yet." },
        { status: 400 },
      );
    }

    if (submission.status === "FINALIZED" && submission.proposalId) {
      return NextResponse.json({
        data: {
          status: "finalized",
          proposalId: submission.proposalId,
          governorTxHash: submission.governorTxHash,
        },
      });
    }

    await db.proposalSubmission.update({
      where: { id: submission.id },
      data: {
        status: "FINALIZING",
        attemptCount: { increment: 1 },
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    const client = getBlockchainClient();

    let receipt: Awaited<
      ReturnType<typeof client.getTransactionReceipt>
    > | null = null;

    try {
      receipt = await client.getTransactionReceipt({
        hash: submission.governorTxHash as Hex,
      });
    } catch {
      receipt = null;
    }

    if (!receipt) {
      await db.proposalSubmission.update({
        where: { id: submission.id },
        data: {
          status: "TX_SUBMITTED",
          lastErrorCode: "RECEIPT_PENDING",
          lastErrorMessage: "Transaction receipt is not available yet.",
        },
      });

      return NextResponse.json({
        data: {
          status: "pending_confirmation",
          governorTxHash: submission.governorTxHash,
        },
      });
    }

    const proposalId = extractProposalIdFromReceipt(receipt);

    if (!proposalId) {
      await db.proposalSubmission.update({
        where: { id: submission.id },
        data: {
          status: "FAILED_RETRYABLE",
          confirmedAt: new Date(),
          lastErrorCode: "PROPOSAL_ID_NOT_FOUND",
          lastErrorMessage:
            "Receipt found, but ProposalCreated was not decoded.",
        },
      });

      return NextResponse.json(
        {
          error:
            "Transaction confirmed but proposal ID could not be derived yet.",
          data: {
            status: "retryable_error",
            governorTxHash: submission.governorTxHash,
          },
        },
        { status: 409 },
      );
    }

    await db.proposalRecord.upsert({
      where: { proposalId: proposalId.toString() },
      update: {
        title: submission.title,
        excerpt: submission.excerpt,
        description: submission.description,
        descriptionHash: submission.descriptionHash,
        category: submission.category,
        proposerLabel: submission.proposerLabel,
        proposerAddress: submission.proposerAddress,
        governorTxHash: submission.governorTxHash,
        governorAddress: submission.governorAddress,
        targets: submission.targets,
        values: submission.values,
        calldatas: submission.calldatas,
        proposalKind: submission.proposalKind,
        canceledProposalId: submission.canceledProposalId,
        canceledProposalTitle: submission.canceledProposalTitle,
      },
      create: {
        proposalId: proposalId.toString(),
        title: submission.title,
        excerpt: submission.excerpt,
        description: submission.description,
        descriptionHash: submission.descriptionHash,
        category: submission.category,
        proposerLabel: submission.proposerLabel,
        proposerAddress: submission.proposerAddress,
        governorTxHash: submission.governorTxHash,
        governorAddress: submission.governorAddress,
        targets: submission.targets,
        values: submission.values,
        calldatas: submission.calldatas,
        proposalKind: submission.proposalKind,
        canceledProposalId: submission.canceledProposalId,
        canceledProposalTitle: submission.canceledProposalTitle,
      },
    });

    await db.proposalSubmission.update({
      where: { id: submission.id },
      data: {
        proposalId: proposalId.toString(),
        status: "FINALIZED",
        confirmedAt: submission.confirmedAt ?? new Date(),
        finalizedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    revalidateTag(GOVERNANCE_PROPOSALS_TAG, "max");

    return NextResponse.json({
      data: {
        status: "finalized",
        proposalId: proposalId.toString(),
        governorTxHash: submission.governorTxHash,
      },
    });
  } catch (error) {
    console.error("FINALIZE_PROPOSAL_SUBMISSION_ERROR", error);

    return NextResponse.json(
      { error: "Failed to finalize proposal submission." },
      { status: 500 },
    );
  }
}
