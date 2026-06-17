import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBodySafely, validateBody } from "@/lib/api/route-utils";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MY_GOVERNOR_ADDRESS } from "@/lib/web3/contracts";
import type { ProposalCategory } from "@/types/governance";

const proposalCategorySchema = z.custom<ProposalCategory>(
  (value) => typeof value === "string" && value.trim().length > 0,
  {
    message: "Category is required.",
  },
);

const createProposalSubmissionSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1, "Idempotency key is required."),
    title: z.string().trim().min(1, "Title is required."),
    excerpt: z.string().trim().min(1, "Excerpt is required."),
    description: z.string().trim().min(1, "Description is required."),
    descriptionHash: z
      .string()
      .trim()
      .regex(
        /^0x[a-fA-F0-9]+$/,
        "Description hash must be a valid hex string.",
      ),
    category: proposalCategorySchema,
    proposerAddress: z
      .string()
      .trim()
      .regex(
        /^0x[a-fA-F0-9]{40}$/,
        "Proposer address must be a valid address.",
      ),
    targets: z
      .array(
        z
          .string()
          .trim()
          .regex(/^0x[a-fA-F0-9]{40}$/, "Each target must be a valid address."),
      )
      .min(1, "At least one target is required."),
    values: z
      .array(z.string().trim().min(1, "Each value must be a non-empty string."))
      .min(1, "At least one value is required."),
    calldatas: z
      .array(
        z
          .string()
          .trim()
          .regex(/^0x[a-fA-F0-9]*$/, "Each calldata entry must be valid hex."),
      )
      .min(1, "At least one calldata entry is required."),
    proposalKind: z.enum(["standard", "cancel"]).optional(),
    canceledProposalId: z.string().trim().min(1).nullable().optional(),
    canceledProposalTitle: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.targets.length !== value.values.length ||
      value.targets.length !== value.calldatas.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targets, values, and calldatas must have the same length.",
        path: ["targets"],
      });
    }

    const proposalKind = value.proposalKind ?? "standard";

    if (proposalKind === "cancel" && !value.canceledProposalId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "canceledProposalId is required for cancel proposals.",
        path: ["canceledProposalId"],
      });
    }
  });

type CreateProposalSubmissionBody = z.infer<
  typeof createProposalSubmissionSchema
>;

const UNRESOLVED_STATUSES = [
  "DRAFT",
  "WALLET_PENDING",
  "TX_SUBMITTED",
  "FINALIZING",
  "FAILED_RETRYABLE",
] as const;

function normalizePayload(body: CreateProposalSubmissionBody) {
  return {
    idempotencyKey: body.idempotencyKey.trim(),
    title: body.title.trim(),
    excerpt: body.excerpt.trim(),
    description: body.description.trim(),
    descriptionHash: body.descriptionHash.trim().toLowerCase(),
    category: body.category,
    proposerAddress: body.proposerAddress.toLowerCase(),
    targets: body.targets.map((target) => target.toLowerCase()),
    values: body.values.map((value) => value.trim()),
    calldatas: body.calldatas.map((calldata) => calldata.trim().toLowerCase()),
    proposalKind: body.proposalKind ?? "standard",
    canceledProposalId: body.canceledProposalId?.trim() ?? null,
    canceledProposalTitle: body.canceledProposalTitle?.trim() ?? null,
  };
}

function sameSubmissionPayload(
  existing: {
    title: string;
    excerpt: string;
    description: string;
    descriptionHash: string;
    category: ProposalCategory;
    proposerAddress: string;
    targets: unknown;
    values: unknown;
    calldatas: unknown;
    proposalKind: string;
    canceledProposalId: string | null;
    canceledProposalTitle: string | null;
  },
  next: ReturnType<typeof normalizePayload>,
) {
  return (
    existing.title === next.title &&
    existing.excerpt === next.excerpt &&
    existing.description === next.description &&
    existing.descriptionHash === next.descriptionHash &&
    existing.category === next.category &&
    existing.proposerAddress.toLowerCase() === next.proposerAddress &&
    JSON.stringify(existing.targets ?? null) === JSON.stringify(next.targets) &&
    JSON.stringify(existing.values ?? null) === JSON.stringify(next.values) &&
    JSON.stringify(existing.calldatas ?? null) ===
      JSON.stringify(next.calldatas) &&
    existing.proposalKind === next.proposalKind &&
    existing.canceledProposalId === next.canceledProposalId &&
    existing.canceledProposalTitle === next.canceledProposalTitle
  );
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const parsed = await parseJsonBodySafely(request);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const validated = validateBody(createProposalSubmissionSchema, parsed.data);
    if (validated.response) {
      return validated.response;
    }

    const normalized = normalizePayload(validated.data!);

    const existingByKey = await db.proposalSubmission.findUnique({
      where: { idempotencyKey: normalized.idempotencyKey },
    });

    if (existingByKey) {
      if (
        existingByKey.proposerUserId !== user.id ||
        !sameSubmissionPayload(existingByKey, normalized)
      ) {
        return NextResponse.json(
          {
            error:
              "This idempotency key is already in use for a different submission.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        data: {
          submissionId: existingByKey.id,
          status: existingByKey.status,
          governorTxHash: existingByKey.governorTxHash,
          proposalId: existingByKey.proposalId,
          idempotent: true,
          reusedExisting: true,
        },
      });
    }

    const unresolvedCandidates = await db.proposalSubmission.findMany({
      where: {
        proposerUserId: user.id,
        status: { in: [...UNRESOLVED_STATUSES] },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    const matchingUnresolved = unresolvedCandidates.find((candidate) =>
      sameSubmissionPayload(candidate, normalized),
    );

    if (matchingUnresolved) {
      return NextResponse.json({
        data: {
          submissionId: matchingUnresolved.id,
          status: matchingUnresolved.status,
          governorTxHash: matchingUnresolved.governorTxHash,
          proposalId: matchingUnresolved.proposalId,
          idempotent: true,
          reusedExisting: true,
        },
      });
    }

    const proposerLabel =
      user.displayName.trim().length > 0
        ? user.displayName.trim()
        : user.walletAddress?.trim() || normalized.proposerAddress;

    const created = await db.proposalSubmission.create({
      data: {
        idempotencyKey: normalized.idempotencyKey,
        proposerUserId: user.id,
        proposerAddress: normalized.proposerAddress,
        proposerLabel,
        proposalKind: normalized.proposalKind,
        category: normalized.category,
        title: normalized.title,
        excerpt: normalized.excerpt,
        description: normalized.description,
        descriptionHash: normalized.descriptionHash,
        canceledProposalId: normalized.canceledProposalId,
        canceledProposalTitle: normalized.canceledProposalTitle,
        targets: normalized.targets,
        values: normalized.values,
        calldatas: normalized.calldatas,
        governorAddress: MY_GOVERNOR_ADDRESS,
        status: "WALLET_PENDING",
      },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json({
      data: {
        submissionId: created.id,
        status: created.status,
        reusedExisting: false,
      },
    });
  } catch (error) {
    console.error("CREATE_PROPOSAL_SUBMISSION_ERROR", error);

    return NextResponse.json(
      { error: "Failed to create proposal submission." },
      { status: 500 },
    );
  }
}
