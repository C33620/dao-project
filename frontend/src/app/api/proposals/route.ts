import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProposals } from "@/lib/services/proposals";
import {
  MY_GOVERNOR_ADDRESS,
  PROPOSAL_REGISTRY_ADDRESS,
} from "@/lib/web3/contracts";
import { ProposalCategory } from "@prisma/client";
import { NextResponse } from "next/server";

type CreateProposalMetadataBody = {
  proposalId: string;
  title: string;
  excerpt: string;
  description: string;
  category: ProposalCategory;
  proposerAddress: string;
  governorTxHash?: string | null;
};

function isProposalCategory(value: unknown): value is ProposalCategory {
  return (
    value === "COFFEE_MEETUP" ||
    value === "HACK_DAY" ||
    value === "WORKSHOP" ||
    value === "OTHER"
  );
}

export async function GET() {
  const proposals = await getProposals("all");

  return NextResponse.json({
    data: proposals,
    meta: {
      source: "database",
      count: proposals.length,
    },
  });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as CreateProposalMetadataBody;

    if (
      typeof body.proposalId !== "string" ||
      body.proposalId.trim().length === 0 ||
      typeof body.title !== "string" ||
      body.title.trim().length === 0 ||
      typeof body.excerpt !== "string" ||
      typeof body.description !== "string" ||
      body.description.trim().length === 0 ||
      typeof body.proposerAddress !== "string" ||
      !body.proposerAddress.startsWith("0x") ||
      !isProposalCategory(body.category)
    ) {
      return NextResponse.json(
        { error: "Invalid proposal metadata." },
        { status: 400 },
      );
    }

    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const proposerLabel =
      currentUser?.name?.trim() ||
      currentUser?.email?.trim() ||
      body.proposerAddress;

    const proposal = await db.proposalRecord.upsert({
      where: {
        proposalId: body.proposalId.trim(),
      },
      update: {
        title: body.title.trim(),
        excerpt: body.excerpt.trim(),
        description: body.description.trim(),
        category: body.category,
        proposerAddress: body.proposerAddress,
        proposerLabel,
        proposerUserId: currentUser?.id ?? null,
        governorAddress: MY_GOVERNOR_ADDRESS,
        registryAddress: PROPOSAL_REGISTRY_ADDRESS,
        governorTxHash: body.governorTxHash?.trim() || null,
      },
      create: {
        proposalId: body.proposalId.trim(),
        title: body.title.trim(),
        excerpt: body.excerpt.trim(),
        description: body.description.trim(),
        category: body.category,
        proposerAddress: body.proposerAddress,
        proposerLabel,
        proposerUserId: currentUser?.id ?? null,
        governorAddress: MY_GOVERNOR_ADDRESS,
        registryAddress: PROPOSAL_REGISTRY_ADDRESS,
        governorTxHash: body.governorTxHash?.trim() || null,
      },
    });

    return NextResponse.json({
      data: {
        id: proposal.id,
        proposalId: proposal.proposalId,
      },
    });
  } catch (error) {
    console.error("PROPOSAL_METADATA_POST_ERROR", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
