import { getProposals } from "@/lib/services/proposals";
import { NextResponse } from "next/server";

export async function GET() {
  const proposals = await getProposals("all");

  return NextResponse.json({
    data: proposals,
    meta: {
      source: "mock-governance-seed",
      count: proposals.length,
    },
  });
}
