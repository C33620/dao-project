import { GOVERNANCE_PROPOSALS_TAG } from "@/lib/services/proposals";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST() {
  revalidateTag(GOVERNANCE_PROPOSALS_TAG, { expire: 0 });

  return NextResponse.json({
    ok: true,
    revalidated: true,
    tag: GOVERNANCE_PROPOSALS_TAG,
  });
}
