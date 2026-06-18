import { NextResponse } from "next/server";

import {
  getProposalById,
  getProposalExecutionPayload,
} from "@/lib/services/proposals";

type RouteContext = {
  params: Promise<{ proposalId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { proposalId } = await context.params;

  const [proposal, payload] = await Promise.all([
    getProposalById(proposalId),
    getProposalExecutionPayload(proposalId),
  ]);

  if (!proposal || !payload) {
    return NextResponse.json(
      { ok: false, error: "QUEUE_PAYLOAD_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (!proposal.governance.canQueue) {
    return NextResponse.json(
      { ok: false, error: "PROPOSAL_NOT_QUEUEABLE" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    payload: {
      proposalId: payload.proposalId,
      description: payload.description,
      descriptionHash: payload.descriptionHash,
      targets: payload.targets,
      values: payload.values.map((value) => value.toString()),
      calldatas: payload.calldatas,
    },
  });
}
