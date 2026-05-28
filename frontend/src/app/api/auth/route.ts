import {
  getUserDocumentByEmail,
  getUserDocumentByIssuer,
  isMongoDuplicateKeyError,
  normalizeEmail,
  upsertUserFromVerifiedAuth,
} from "@/lib/repositories/users";
import { Magic } from "@magic-sdk/admin";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "govboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type AuthRequestBody = {
  action?: "precheck" | "verify" | "sign-out";
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
    email: normalizeEmail(input.email),
    displayName: input.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "auth",
    status: "ready",
    capabilities: ["precheck", "verify", "sign-out"],
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

  if (body.action === "precheck") {
    const normalizedEmail = body.email ? normalizeEmail(body.email) : "";

    if (!normalizedEmail) {
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 },
      );
    }

    if (body.isNewUser) {
      const existingUserByEmail = await getUserDocumentByEmail(normalizedEmail);

      if (existingUserByEmail) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "An account with this email already exists. Sign in instead.",
          },
          { status: 409 },
        );
      }
    }

    return NextResponse.json({ ok: true });
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
    await magic.token.validate(body.didToken);

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

    const existingUserByIssuer = await getUserDocumentByIssuer(metadata.issuer);
    const existingUserByEmail = await getUserDocumentByEmail(verifiedEmail);

    if (
      body.isNewUser &&
      !existingUserByIssuer &&
      existingUserByEmail &&
      existingUserByEmail._id !== metadata.issuer
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "An account with this email already exists. Sign in instead.",
        },
        { status: 409 },
      );
    }

    await upsertUserFromVerifiedAuth({
      issuer: metadata.issuer,
      email: verifiedEmail,
      displayName,
    });

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
  } catch (error) {
    console.error("AUTH_VERIFY_ERROR", error);

    if (isMongoDuplicateKeyError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "An account with this email already exists. Sign in instead.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "We could not verify your sign-in.",
      },
      { status: 401 },
    );
  }
}
