import { Magic } from "@magic-sdk/admin";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "govboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type AuthRequestBody = {
  action?: "verify" | "sign-out";
  didToken?: string;
  email?: string;
  name?: string;
  isNewUser?: boolean;
};

const magic = new Magic(process.env.MAGIC_SECRET_KEY ?? "");

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

async function createSignedSessionToken(input: {
  issuer: string;
  email: string;
  displayName: string;
}) {
  return new SignJWT({
    sub: input.issuer,
    email: input.email,
    displayName: input.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "auth",
    status: "ready",
    capabilities: ["verify", "sign-out"],
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AuthRequestBody;

  if (body.action === "sign-out") {
    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: SESSION_COOKIE,
      value: "",
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  }

  if (body.action !== "verify") {
    return NextResponse.json(
      { ok: false, error: "Unsupported auth action." },
      { status: 400 },
    );
  }

  if (!process.env.MAGIC_SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "Auth is not configured yet." },
      { status: 500 },
    );
  }

  if (!body.didToken) {
    return NextResponse.json(
      { ok: false, error: "Verification token is required." },
      { status: 400 },
    );
  }

  if (body.isNewUser && !body.name?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Name is required for new accounts." },
      { status: 400 },
    );
  }

  try {
    magic.token.validate(body.didToken);

    const metadata = await magic.users.getMetadataByToken(body.didToken);

    if (!metadata.email || !metadata.issuer) {
      return NextResponse.json(
        { ok: false, error: "We could not verify this account." },
        { status: 401 },
      );
    }

    const verifiedEmail = normalizeEmail(metadata.email);
    const providedEmail = body.email ? normalizeEmail(body.email) : null;

    if (providedEmail && providedEmail !== verifiedEmail) {
      return NextResponse.json(
        { ok: false, error: "Email verification did not match." },
        { status: 401 },
      );
    }

    const displayName =
      body.name?.trim() || verifiedEmail.split("@")[0] || "Member";

    const sessionToken = await createSignedSessionToken({
      issuer: metadata.issuer,
      email: verifiedEmail,
      displayName,
    });

    const response = NextResponse.json({
      ok: true,
      message: "Signed in successfully.",
    });

    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "We could not verify your sign-in." },
      { status: 401 },
    );
  }
}
