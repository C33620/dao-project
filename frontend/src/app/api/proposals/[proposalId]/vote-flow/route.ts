import { getProposalById } from "@/lib/services/proposals";
import { getProposalActionState } from "@/lib/services/votes";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    proposalId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { proposalId } = await context.params;

  const [proposal, actionState] = await Promise.all([
    getProposalById(proposalId),
    getProposalActionState(proposalId),
  ]);

  if (!proposal || !actionState) {
    return NextResponse.json(
      {
        message: "Proposal not found.",
        debug: {
          proposalId,
          hasProposal: Boolean(proposal),
          hasActionState: Boolean(actionState),
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    proposal,
    actionState,
  });
}
