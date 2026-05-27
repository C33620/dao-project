import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "funding",
    status: "not_implemented",
  });
}
