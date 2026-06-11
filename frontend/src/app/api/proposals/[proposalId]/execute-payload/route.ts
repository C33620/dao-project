import { NextResponse } from "next/server";

import { getProposalExecutionPayload } from "@/lib/services/proposals";

type RouteContext = {
  params: Promise<{ proposalId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { proposalId } = await context.params;
  const payload = await getProposalExecutionPayload(proposalId);

  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "EXECUTION_PAYLOAD_NOT_FOUND" },
      { status: 404 },
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
