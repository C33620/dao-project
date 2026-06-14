import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProposals } from "@/lib/services/proposals";
import {
  MY_GOVERNOR_ADDRESS,
  PROPOSAL_REGISTRY_ADDRESS,
} from "@/lib/web3/contracts";
import { ProposalCategory } from "@prisma/client";
import { NextResponse } from "next/server";

type ProposalKind = "standard" | "cancel";

type CreateProposalMetadataBody = {
  proposalId: string;
  title: string;
  excerpt: string;
  description: string;
  descriptionHash: string;
  category: ProposalCategory;
  proposerAddress: string;
  governorTxHash?: string | null;
  targets: string[];
  values: string[];
  calldatas: string[];

  proposalKind?: ProposalKind;
  canceledProposalId?: string | null;
  canceledProposalTitle?: string | null;
};

function isProposalCategory(value: unknown): value is ProposalCategory {
  return (
    value === "COFFEE_MEETUP" ||
    value === "HACK_DAY" ||
    value === "WORKSHOP" ||
    value === "OTHER"
  );
}

function isProposalKind(value: unknown): value is ProposalKind {
  return value === "standard" || value === "cancel";
}

function isHexString(value: unknown) {
  return typeof value === "string" && value.startsWith("0x");
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export async function GET() {
  const proposals = await getProposals("all");

  return NextResponse.json({
    data: proposals,
    meta: {
      source: "database+governor",
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
    const proposalKind: ProposalKind = isProposalKind(body.proposalKind)
      ? body.proposalKind
      : "standard";

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
      !isProposalCategory(body.category) ||
      !isHexString(body.descriptionHash) ||
      !isStringArray(body.targets) ||
      !isStringArray(body.values) ||
      !isStringArray(body.calldatas)
    ) {
      return NextResponse.json(
        { error: "Invalid proposal metadata." },
        { status: 400 },
      );
    }

    if (
      proposalKind === "cancel" &&
      (typeof body.canceledProposalId !== "string" ||
        body.canceledProposalId.trim().length === 0 ||
        typeof body.canceledProposalTitle !== "string" ||
        body.canceledProposalTitle.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "Invalid cancellation proposal metadata." },
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
        descriptionHash: body.descriptionHash.trim(),
        category: body.category,
        proposerAddress: body.proposerAddress,
        proposerLabel,
        proposerUserId: currentUser?.id ?? null,
        governorAddress: MY_GOVERNOR_ADDRESS,
        registryAddress: PROPOSAL_REGISTRY_ADDRESS,
        governorTxHash: body.governorTxHash?.trim() || null,
        targets: body.targets,
        values: body.values,
        calldatas: body.calldatas,

        proposalKind,
        canceledProposalId:
          proposalKind === "cancel"
            ? body.canceledProposalId?.trim() ?? null
            : null,
        canceledProposalTitle:
          proposalKind === "cancel"
            ? body.canceledProposalTitle?.trim() ?? null
            : null,
        cancelHighlightUntil: null,
        cancelHiddenAt: null,
      },
      create: {
        proposalId: body.proposalId.trim(),
        title: body.title.trim(),
        excerpt: body.excerpt.trim(),
        description: body.description.trim(),
        descriptionHash: body.descriptionHash.trim(),
        category: body.category,
        proposerAddress: body.proposerAddress,
        proposerLabel,
        proposerUserId: currentUser?.id ?? null,
        governorAddress: MY_GOVERNOR_ADDRESS,
        registryAddress: PROPOSAL_REGISTRY_ADDRESS,
        governorTxHash: body.governorTxHash?.trim() || null,
        targets: body.targets,
        values: body.values,
        calldatas: body.calldatas,

        proposalKind,
        canceledProposalId:
          proposalKind === "cancel"
            ? body.canceledProposalId?.trim() ?? null
            : null,
        canceledProposalTitle:
          proposalKind === "cancel"
            ? body.canceledProposalTitle?.trim() ?? null
            : null,
        cancelHighlightUntil: null,
        cancelHiddenAt: null,
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
