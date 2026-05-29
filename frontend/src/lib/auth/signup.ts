import {
  buildInviteExpiryDate,
  generateInviteCode,
  normalizeInviteCode,
  resolveInviteAvailability,
} from "@/lib/auth/invite";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { InviteCodeStatus, Prisma } from "@prisma/client";

export class SignupError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type SignupInput = {
  email: string;
  password: string;
  name?: string;
  inviteCode: string;
};

function validateSignupInput(input: SignupInput) {
  const email = input.email.trim();
  const normalizedEmail = normalizeEmail(email);
  const inviteCode = normalizeInviteCode(input.inviteCode);
  const name = input.name?.trim() || null;

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new SignupError("INVALID_EMAIL", "Please enter a valid email.");
  }

  if (!input.password || input.password.length < 8) {
    throw new SignupError(
      "INVALID_PASSWORD",
      "Password must be at least 8 characters.",
    );
  }

  if (!inviteCode) {
    throw new SignupError("INVITE_REQUIRED", "Invite code is required.");
  }

  return {
    email,
    normalizedEmail,
    password: input.password,
    inviteCode,
    name,
  };
}

export async function signupWithInvite(input: SignupInput) {
  const parsed = validateSignupInput(input);

  const existingUser = await db.user.findUnique({
    where: { normalizedEmail: parsed.normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new SignupError("SIGNUP_FAILED", "We couldn’t complete signup.");
  }

  const invite = await db.inviteCode.findUnique({
    where: { code: parsed.inviteCode },
    select: {
      id: true,
      code: true,
      status: true,
      expiresAt: true,
      createdByUserId: true,
    },
  });

  if (!invite) {
    throw new SignupError("INVALID_INVITE", "Invite code is invalid.");
  }

  const effectiveStatus = resolveInviteAvailability(
    invite.status,
    invite.expiresAt,
  );

  if (
    effectiveStatus === InviteCodeStatus.EXPIRED &&
    invite.status === InviteCodeStatus.AVAILABLE
  ) {
    await db.inviteCode.update({
      where: { id: invite.id },
      data: { status: InviteCodeStatus.EXPIRED },
    });

    throw new SignupError(
      "INVITE_UNAVAILABLE",
      "Invite code is no longer available.",
    );
  }

  if (effectiveStatus !== InviteCodeStatus.AVAILABLE) {
    throw new SignupError(
      "INVITE_UNAVAILABLE",
      "Invite code is no longer available.",
    );
  }

  const passwordHash = await hashPassword(parsed.password);

  try {
    const user = await db.user.create({
      data: {
        email: parsed.email,
        normalizedEmail: parsed.normalizedEmail,
        passwordHash,
        name: parsed.name,
        invitedByUserId: invite.createdByUserId,
      },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        name: true,
        invitedByUserId: true,
      },
    });

    const redeemed = await db.inviteCode.updateMany({
      where: {
        id: invite.id,
        status: InviteCodeStatus.AVAILABLE,
        redeemedByUserId: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: {
        status: InviteCodeStatus.REDEEMED,
        redeemedAt: new Date(),
        redeemedByUserId: user.id,
      },
    });

    if (redeemed.count !== 1) {
      await db.user.delete({ where: { id: user.id } });
      throw new SignupError(
        "INVITE_ALREADY_USED",
        "Invite code is no longer available.",
      );
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateInviteCode();

      try {
        await db.inviteCode.create({
          data: {
            code: candidate,
            status: InviteCodeStatus.AVAILABLE,
            expiresAt: buildInviteExpiryDate(),
            createdByUserId: user.id,
          },
        });

        return { user };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new SignupError(
      "INVITE_GENERATION_FAILED",
      "We couldn’t complete signup.",
    );
  } catch (error) {
    if (error instanceof SignupError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new SignupError("SIGNUP_FAILED", "We couldn’t complete signup.");
    }

    throw new SignupError("SIGNUP_FAILED", "We couldn’t complete signup.");
  }
}
