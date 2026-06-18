import { GOVERNANCE_PROPOSALS_TAG } from "@/lib/services/proposals";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized." },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");

  if (!process.env.REVALIDATE_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Revalidation secret is not configured." },
      { status: 500 },
    );
  }

  if (secret !== process.env.REVALIDATE_SECRET) {
    return unauthorized();
  }

  revalidateTag(GOVERNANCE_PROPOSALS_TAG, "max");

  return NextResponse.json({
    ok: true,
    revalidated: true,
    tag: GOVERNANCE_PROPOSALS_TAG,
  });
}
