import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import governorAbi from "@/abi/MyGovernor.json";
import { getBlockchainClient } from "@/lib/blockchain/client";
import { db } from "@/lib/db";
import {
  GOVERNANCE_PROPOSALS_TAG,
  getProposalById,
  getProposalExecutionPayload,
} from "@/lib/services/proposals";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";

type Intent = "queue" | "execute";

type RouteContext = {
  params: Promise<{ proposalId: string }>;
};

type FinalizeBody = {
  intent?: Intent;
  txHash?: string;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { proposalId } = await context.params;
  const body = (await request.json().catch(() => null)) as FinalizeBody | null;

  if (!body?.intent || !body?.txHash) {
    return jsonError("INVALID_REQUEST", 400);
  }

  const [proposal, payload] = await Promise.all([
    getProposalById(proposalId),
    getProposalExecutionPayload(proposalId),
  ]);

  if (!proposal || !payload) {
    return jsonError("PROPOSAL_NOT_FOUND", 404);
  }

  const client = getBlockchainClient();

  const receipt = await client
    .getTransactionReceipt({ hash: body.txHash as `0x${string}` })
    .catch(() => null);

  if (!receipt || receipt.status !== "success") {
    return jsonError("TRANSACTION_NOT_CONFIRMED", 409);
  }

  const [rawState, eta, needsQueuing] = await client.multicall({
    contracts: [
      {
        address: MY_GOVERNOR_ADDRESS,
        abi: governorAbi,
        functionName: "state",
        args: [BigInt(proposalId)],
      },
      {
        address: MY_GOVERNOR_ADDRESS,
        abi: governorAbi,
        functionName: "proposalEta",
        args: [BigInt(proposalId)],
      },
      {
        address: MY_GOVERNOR_ADDRESS,
        abi: governorAbi,
        functionName: "proposalNeedsQueuing",
        args: [BigInt(proposalId)],
      },
    ],
    allowFailure: false,
  });

  const governorState = Number(rawState);

  if (body.intent === "queue") {
    const isQueuedNow = governorState === 5;
    const stillNeedsQueuing = Boolean(needsQueuing);

    if (!isQueuedNow && stillNeedsQueuing) {
      return jsonError("PROPOSAL_NOT_QUEUED", 409);
    }

    await db.proposalRecord.update({
      where: { proposalId },
      data: {
        queuedAt: new Date(),
        executableAt:
          typeof eta === "bigint" && eta > BigInt(0)
            ? new Date(Number(eta) * 1000)
            : null,
      },
    });
  }

  if (body.intent === "execute") {
    const isExecutedNow = governorState === 7;

    if (!isExecutedNow) {
      return jsonError("PROPOSAL_NOT_EXECUTED", 409);
    }

    await db.proposalRecord.update({
      where: { proposalId },
      data: {
        executedAt: new Date(),
      },
    });
  }

  revalidateTag(GOVERNANCE_PROPOSALS_TAG, "max");

  return NextResponse.json({ ok: true });
}
