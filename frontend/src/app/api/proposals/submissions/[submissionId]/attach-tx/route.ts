import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseJsonBodySafely, validateBody } from "@/lib/api/route-utils";

const attachTxSchema = z.object({
  txHash: z.string().trim().min(1, "Transaction hash is required."),
});

type RouteContext = {
  params: Promise<{
    submissionId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser();
    const { submissionId } = await context.params;

    const parsed = await parseJsonBodySafely(request);

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const validated = validateBody(attachTxSchema, parsed.data);

    if (validated.response) {
      return validated.response;
    }

    const txHash = validated.data!.txHash.trim().toLowerCase();

    const submission = await db.proposalSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        proposerUserId: true,
        governorTxHash: true,
        status: true,
        submittedAt: true,
      },
    });

    if (!submission || submission.proposerUserId !== user.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (submission.governorTxHash === txHash) {
      return NextResponse.json({
        data: {
          id: submission.id,
          status: submission.status,
          governorTxHash: submission.governorTxHash,
          idempotent: true,
        },
      });
    }

    if (submission.governorTxHash && submission.governorTxHash !== txHash) {
      return NextResponse.json(
        { error: "A different transaction hash is already attached." },
        { status: 409 },
      );
    }

    const updated = await db.proposalSubmission.update({
      where: { id: submissionId },
      data: {
        governorTxHash: txHash,
        status: "TX_SUBMITTED",
        submittedAt: submission.submittedAt ?? new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      select: {
        id: true,
        status: true,
        governorTxHash: true,
      },
    });

    return NextResponse.json({
      data: updated,
    });
  } catch (error) {
    console.error("ATTACH_PROPOSAL_TX_ERROR", error);

    return NextResponse.json(
      { error: "Failed to attach proposal transaction hash." },
      { status: 500 },
    );
  }
}
