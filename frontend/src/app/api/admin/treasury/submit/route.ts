import { getCurrentUser } from "@/lib/auth";
import { markInitialAllocationSubmitted } from "@/lib/treasury/distribute";
import { NextRequest, NextResponse } from "next/server";

type SubmitTreasuryBody = {
  distributionId?: string;
  txHash?: string;
};

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized." },
    { status: 401 },
  );
}

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function isTransactionHash(value: string) {
  return /^0x([A-Fa-f0-9]{64})$/.test(value);
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorized();
  }

  if (currentUser.role !== "admin") {
    return forbidden();
  }

  const body = (await request.json()) as SubmitTreasuryBody;

  const distributionId = body.distributionId?.trim();
  const txHash = body.txHash?.trim();

  if (!distributionId) {
    return badRequest("distributionId is required.");
  }

  if (!txHash) {
    return badRequest("txHash is required.");
  }

  if (!isTransactionHash(txHash)) {
    return badRequest("txHash must be a valid transaction hash.");
  }

  try {
    const distribution = await markInitialAllocationSubmitted({
      distributionId,
      adminUserId: currentUser.id,
      txHash,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: distribution.id,
        status: distribution.status,
        txHash: distribution.txHash,
        submittedAt: distribution.submittedAt,
        updatedAt: distribution.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DISTRIBUTION_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Treasury distribution not found." },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "DISTRIBUTION_NOT_SUBMITTABLE"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "This treasury distribution cannot be marked submitted.",
        },
        { status: 409 },
      );
    }

    console.error("[ADMIN_TREASURY_SUBMIT_ROUTE] POST_ERROR", error);

    return NextResponse.json(
      { ok: false, error: "Could not record treasury submission." },
      { status: 500 },
    );
  }
}
