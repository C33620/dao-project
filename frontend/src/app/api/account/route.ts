import {
  deleteUserByIssuer,
  isMongoDuplicateKeyError,
  normalizeEmail,
  updateUserProfileByIssuer,
} from "@/lib/repositories/users";
import { getSession } from "@/lib/services/session";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "govboard_session";

type PatchAccountRequestBody = {
  displayName?: string;
  email?: string;
};

type DeleteAccountRequestBody = {
  confirmation?: string;
};

function validateDisplayName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 80) {
    return null;
  }

  return trimmed;
}

function validateEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeEmail(value);

  if (!normalized) {
    return null;
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);

  if (!isValidEmail) {
    return null;
  }

  return normalized;
}

function buildUnauthorizedResponse() {
  return NextResponse.json(
    { ok: false, error: "You must be signed in." },
    { status: 401 },
  );
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return buildUnauthorizedResponse();
  }

  let body: PatchAccountRequestBody;

  try {
    body = (await request.json()) as PatchAccountRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "We could not update your profile." },
      { status: 400 },
    );
  }

  const allowedKeys = ["displayName", "email"];
  const bodyKeys = Object.keys(body ?? {});
  const hasOnlyAllowedKeys = bodyKeys.every((key) => allowedKeys.includes(key));

  if (!hasOnlyAllowedKeys) {
    return NextResponse.json(
      { ok: false, error: "We could not update your profile." },
      { status: 400 },
    );
  }

  const displayName = validateDisplayName(body.displayName);
  const email = validateEmail(body.email);

  if (!displayName) {
    return NextResponse.json(
      { ok: false, error: "Enter your name." },
      { status: 400 },
    );
  }

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email." },
      { status: 400 },
    );
  }

  try {
    const user = await updateUserProfileByIssuer({
      issuer: session.issuer,
      displayName,
      email,
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "We could not update your profile." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Profile updated.",
      user,
    });
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return NextResponse.json(
        { ok: false, error: "That email is already in use." },
        { status: 409 },
      );
    }

    console.error("ACCOUNT_PATCH_ERROR", error);

    return NextResponse.json(
      { ok: false, error: "We could not update your profile." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return buildUnauthorizedResponse();
  }

  let body: DeleteAccountRequestBody;

  try {
    body = (await request.json()) as DeleteAccountRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "We could not delete your account." },
      { status: 400 },
    );
  }

  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { ok: false, error: "Type DELETE to confirm." },
      { status: 400 },
    );
  }

  try {
    await deleteUserByIssuer(session.issuer);

    const response = NextResponse.json({
      ok: true,
      redirectTo: "/",
    });

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
  } catch (error) {
    console.error("ACCOUNT_DELETE_ERROR", error);

    return NextResponse.json(
      { ok: false, error: "We could not delete your account." },
      { status: 500 },
    );
  }
}
