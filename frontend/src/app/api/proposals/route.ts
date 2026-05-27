import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "proposals",
    status: "not_implemented",
  });
}
