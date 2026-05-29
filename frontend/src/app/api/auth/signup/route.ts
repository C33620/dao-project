import { normalizeInviteCode } from "@/lib/auth/invite";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { SignupError, signupWithInvite } from "@/lib/auth/signup";
import { assertRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name : "";
    const inviteCode =
      typeof body.inviteCode === "string" ? body.inviteCode : "";
    const ip = getClientIp(request);

    assertRateLimit(getRateLimitKey(["signup:ip", ip]), {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (email) {
      assertRateLimit(
        getRateLimitKey(["signup:email", normalizeEmail(email)]),
        {
          limit: 5,
          windowMs: 10 * 60 * 1000,
        },
      );
    }

    if (inviteCode) {
      assertRateLimit(
        getRateLimitKey(["signup:invite", normalizeInviteCode(inviteCode)]),
        {
          limit: 10,
          windowMs: 10 * 60 * 1000,
        },
      );
    }

    const result = await signupWithInvite({
      email,
      password,
      name,
      inviteCode,
    });

    return NextResponse.json(
      {
        ok: true,
        user: result.user,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Please try again shortly." },
        { status: 429 },
      );
    }

    if (error instanceof SignupError) {
      const status =
        error.code === "INVALID_EMAIL" ||
        error.code === "INVALID_PASSWORD" ||
        error.code === "INVITE_REQUIRED"
          ? 400
          : error.code === "INVALID_INVITE" ||
            error.code === "INVITE_UNAVAILABLE" ||
            error.code === "INVITE_ALREADY_USED"
          ? 409
          : 400;

      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status },
      );
    }

    return NextResponse.json(
      { ok: false, error: "We couldn’t complete signup." },
      { status: 500 },
    );
  }
}
