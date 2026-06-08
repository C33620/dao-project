import { getProposalById } from "@/lib/services/proposals";
import { getProposalActionState } from "@/lib/services/votes";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const [proposal, actionState] = await Promise.all([
    getProposalById(id),
    getProposalActionState(id),
  ]);

  if (!proposal || !actionState) {
    return NextResponse.json(
      { message: "Proposal not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    proposal,
    actionState,
  });
}
