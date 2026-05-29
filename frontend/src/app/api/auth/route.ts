import {
  buildInviteExpiryDate,
  generateInviteCode,
  normalizeInviteCode,
  resolveInviteAvailability,
} from "@/lib/auth/invite";
import { db } from "@/lib/db";
import { Magic } from "@magic-sdk/admin";
import { InviteCodeStatus, Prisma } from "@prisma/client";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "govboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type AuthRequestBody = {
  action?: "precheck" | "verify" | "sign-out";
  didToken?: string;
  email?: string;
  name?: string;
  inviteCode?: string;
  isNewUser?: boolean;
};

const magic = new Magic(process.env.MAGIC_SECRET_KEY ?? "");

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

function logDebug(label: string, payload?: unknown) {
  console.log(`[AUTH_ROUTE] ${label}`, payload ?? "");
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

async function createInviteForUser(userId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateInviteCode();

    try {
      await db.inviteCode.create({
        data: {
          code: candidate,
          status: InviteCodeStatus.AVAILABLE,
          expiresAt: buildInviteExpiryDate(),
          createdByUserId: userId,
        },
      });

      logDebug("INVITE_CREATED", { userId, code: candidate });
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        logDebug("INVITE_CODE_COLLISION", { attempt, userId });
        continue;
      }

      throw error;
    }
  }

  throw new Error("INVITE_GENERATION_FAILED");
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

  logDebug("REQUEST_RECEIVED", {
    action: body.action,
    email: body.email ?? null,
    isNewUser: Boolean(body.isNewUser),
    hasDidToken: Boolean(body.didToken),
    hasInviteCode: Boolean(body.inviteCode),
  });

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

    logDebug("SIGN_OUT_SUCCESS");
    return response;
  }

  if (body.action === "precheck") {
    const normalizedEmail = body.email ? normalizeEmail(body.email) : "";

    if (!normalizedEmail) {
      logDebug("PRECHECK_FAILED_MISSING_EMAIL");
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 },
      );
    }

    const totalUsers = await db.user.count();
    logDebug("PRECHECK_TOTAL_USERS", { totalUsers });

    if (body.isNewUser) {
      const existingUser = await db.user.findUnique({
        where: { normalizedEmail },
        select: { id: true },
      });

      if (existingUser) {
        logDebug("PRECHECK_EXISTING_USER_FOUND", {
          normalizedEmail,
          userId: existingUser.id,
        });

        return NextResponse.json(
          {
            ok: false,
            error:
              "An account with this email already exists. Sign in instead.",
          },
          { status: 409 },
        );
      }

      if (totalUsers > 0 && !normalizeInviteCode(body.inviteCode ?? "")) {
        logDebug("PRECHECK_MISSING_INVITE_CODE");
        return NextResponse.json(
          { ok: false, error: "Activation code is required." },
          { status: 400 },
        );
      }
    }

    logDebug("PRECHECK_SUCCESS", {
      requiresInviteCode: totalUsers > 0,
    });

    return NextResponse.json({
      ok: true,
      requiresInviteCode: totalUsers > 0,
    });
  }

  if (body.action !== "verify") {
    logDebug("FAILED_UNSUPPORTED_ACTION", { action: body.action });
    return NextResponse.json(
      { ok: false, error: "Unsupported auth action." },
      { status: 400 },
    );
  }

  if (!process.env.MAGIC_SECRET_KEY) {
    logDebug("FAILED_MISSING_MAGIC_SECRET");
    return NextResponse.json(
      { ok: false, error: "Auth is not configured yet." },
      { status: 500 },
    );
  }

  if (!body.didToken) {
    logDebug("FAILED_MISSING_DID_TOKEN");
    return NextResponse.json(
      { ok: false, error: "Verification token is required." },
      { status: 400 },
    );
  }

  try {
    await magic.token.validate(body.didToken);
    const metadata = await magic.users.getMetadataByToken(body.didToken);

    logDebug("MAGIC_METADATA", {
      issuer: metadata.issuer ?? null,
      email: metadata.email ?? null,
    });

    if (!metadata.email || !metadata.issuer) {
      logDebug("FAILED_INVALID_MAGIC_METADATA");
      return NextResponse.json(
        { ok: false, error: "We could not verify this account." },
        { status: 401 },
      );
    }

    const verifiedEmail = normalizeEmail(metadata.email);
    const providedEmail = body.email ? normalizeEmail(body.email) : null;

    if (providedEmail && providedEmail !== verifiedEmail) {
      logDebug("FAILED_EMAIL_MISMATCH", {
        providedEmail,
        verifiedEmail,
      });

      return NextResponse.json(
        { ok: false, error: "Email verification did not match." },
        { status: 401 },
      );
    }

    const displayName =
      body.name?.trim() || verifiedEmail.split("@")[0] || "Member";

    let user = await db.user.findFirst({
      where: {
        OR: [{ issuer: metadata.issuer }, { normalizedEmail: verifiedEmail }],
      },
      select: {
        id: true,
        issuer: true,
        email: true,
        normalizedEmail: true,
        name: true,
      },
    });

    logDebug("USER_LOOKUP_RESULT", {
      found: Boolean(user),
      userId: user?.id ?? null,
      issuer: user?.issuer ?? null,
    });

    if (!user && body.isNewUser) {
      const totalUsers = await db.user.count();
      logDebug("NEW_USER_BRANCH", {
        totalUsers,
        firstUser: totalUsers === 0,
      });

      if (totalUsers === 0) {
        const createdUser = await db.user.create({
          data: {
            issuer: metadata.issuer,
            email: verifiedEmail,
            normalizedEmail: verifiedEmail,
            name: displayName,
          },
          select: {
            id: true,
            issuer: true,
            email: true,
            normalizedEmail: true,
            name: true,
          },
        });

        logDebug("FIRST_USER_CREATED", {
          userId: createdUser.id,
          email: createdUser.email,
        });

        await createInviteForUser(createdUser.id);
        user = createdUser;
      } else {
        const submittedInviteCode = normalizeInviteCode(body.inviteCode ?? "");

        if (!submittedInviteCode) {
          logDebug("FAILED_MISSING_ACTIVATION_CODE");
          return NextResponse.json(
            { ok: false, error: "Activation code is required." },
            { status: 400 },
          );
        }

        const invite = await db.inviteCode.findUnique({
          where: { code: submittedInviteCode },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            createdByUserId: true,
            redeemedByUserId: true,
          },
        });

        logDebug("INVITE_LOOKUP_RESULT", {
          code: submittedInviteCode,
          found: Boolean(invite),
          inviteId: invite?.id ?? null,
          status: invite?.status ?? null,
        });

        if (!invite) {
          return NextResponse.json(
            { ok: false, error: "Activation code is invalid." },
            { status: 400 },
          );
        }

        const effectiveStatus = resolveInviteAvailability(
          invite.status,
          invite.expiresAt,
        );

        logDebug("INVITE_STATUS_RESOLVED", {
          inviteId: invite.id,
          storedStatus: invite.status,
          effectiveStatus,
          expiresAt: invite.expiresAt,
        });

        if (
          effectiveStatus === InviteCodeStatus.EXPIRED &&
          invite.status === InviteCodeStatus.AVAILABLE
        ) {
          await db.inviteCode.update({
            where: { id: invite.id },
            data: { status: InviteCodeStatus.EXPIRED },
          });

          logDebug("INVITE_MARKED_EXPIRED", { inviteId: invite.id });
        }

        if (effectiveStatus !== InviteCodeStatus.AVAILABLE) {
          logDebug("FAILED_INVITE_NOT_AVAILABLE", {
            inviteId: invite.id,
            effectiveStatus,
          });

          return NextResponse.json(
            { ok: false, error: "Activation code is no longer available." },
            { status: 400 },
          );
        }

        try {
          const createdUser = await db.$transaction(async (tx) => {
            const freshInvite = await tx.inviteCode.findUnique({
              where: { id: invite.id },
              select: {
                id: true,
                status: true,
                expiresAt: true,
                createdByUserId: true,
                redeemedByUserId: true,
              },
            });

            if (!freshInvite) {
              throw new Error("INVITE_NOT_FOUND");
            }

            const freshStatus = resolveInviteAvailability(
              freshInvite.status,
              freshInvite.expiresAt,
            );

            if (
              freshStatus !== InviteCodeStatus.AVAILABLE ||
              freshInvite.redeemedByUserId
            ) {
              throw new Error("INVITE_NOT_AVAILABLE");
            }

            const newUser = await tx.user.create({
              data: {
                issuer: metadata.issuer,
                email: verifiedEmail,
                normalizedEmail: verifiedEmail,
                name: displayName,
                invitedByUserId: freshInvite.createdByUserId,
              },
              select: {
                id: true,
                issuer: true,
                email: true,
                normalizedEmail: true,
                name: true,
              },
            });

            await tx.inviteCode.update({
              where: { id: freshInvite.id },
              data: {
                status: InviteCodeStatus.REDEEMED,
                redeemedAt: new Date(),
                redeemedByUserId: newUser.id,
              },
            });

            return newUser;
          });

          logDebug("INVITED_USER_CREATED", {
            userId: createdUser.id,
            invitedByUserId: invite.createdByUserId,
          });

          await createInviteForUser(createdUser.id);
          user = createdUser;
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message === "INVITE_NOT_FOUND" ||
              error.message === "INVITE_NOT_AVAILABLE")
          ) {
            logDebug("INVITE_REDEEM_FAILED", {
              inviteId: invite.id,
              reason: error.message,
            });

            return NextResponse.json(
              { ok: false, error: "Activation code is no longer available." },
              { status: 409 },
            );
          }

          throw error;
        }
      }
    }

    if (!user) {
      logDebug("FAILED_NO_ACCOUNT_FOUND_AFTER_VERIFY", {
        verifiedEmail,
        issuer: metadata.issuer,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "No account found for this email. Create an account first.",
        },
        { status: 404 },
      );
    }

    if (!user.issuer) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          issuer: metadata.issuer,
          email: verifiedEmail,
          normalizedEmail: verifiedEmail,
          name: user.name ?? displayName,
        },
        select: {
          id: true,
          issuer: true,
          email: true,
          normalizedEmail: true,
          name: true,
        },
      });

      logDebug("USER_ISSUER_BACKFILLED", {
        userId: user.id,
        issuer: user.issuer,
      });
    }

    const sessionToken = await createSignedSessionToken({
      issuer: metadata.issuer,
      email: verifiedEmail,
      displayName: user.name ?? displayName,
    });

    logDebug("SESSION_CREATED", {
      userId: user.id,
      issuer: metadata.issuer,
    });

    const response = NextResponse.json({
      ok: true,
      message: body.isNewUser
        ? "Account created successfully."
        : "Signed in successfully.",
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
    console.error("[AUTH_ROUTE] AUTH_VERIFY_ERROR", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
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
