import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "gas",
    status: "not_implemented",
  });
}
