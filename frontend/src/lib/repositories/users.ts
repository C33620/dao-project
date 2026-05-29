import "server-only";

import { db } from "@/lib/db";
import type { UserProfile } from "@/types/user";
import { Prisma, UserRole } from "@prisma/client";

export type UserDocument = {
  _id: string;
  email: string;
  displayName: string;
  wallets: string[];
  primaryWallet: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedInAt: Date;
};

export type DuplicateEmailReportItem = {
  email: string;
  count: number;
  issuers: string[];
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapUserRoleToProfileRole(role: UserRole): UserProfile["role"] {
  switch (role) {
    case UserRole.ADMIN:
      return "admin";
    case UserRole.DELEGATE:
      return "delegate";
    case UserRole.VIEWER:
      return "viewer";
    case UserRole.MEMBER:
    default:
      return "member";
  }
}

function mapPrismaUserToUserProfile(user: {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}): UserProfile {
  return {
    id: user.id,
    displayName: user.name ?? user.email.split("@")[0] ?? "Member",
    email: user.email,
    role: mapUserRoleToProfileRole(user.role),
  };
}

export function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function upsertUserFromVerifiedAuth(input: {
  issuer: string;
  email: string;
  displayName: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const trimmedDisplayName = input.displayName.trim();

  await db.user.upsert({
    where: { issuer: input.issuer },
    update: {
      email: normalizedEmail,
      normalizedEmail,
      name: trimmedDisplayName,
    },
    create: {
      issuer: input.issuer,
      email: normalizedEmail,
      normalizedEmail,
      name: trimmedDisplayName,
    },
  });
}

export async function getUserByIssuer(
  issuer: string,
): Promise<UserProfile | null> {
  const user = await db.user.findUnique({
    where: { issuer },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!user) {
    return null;
  }

  return mapPrismaUserToUserProfile(user);
}

export async function getUserDocumentByIssuer(issuer: string) {
  return db.user.findUnique({
    where: { issuer },
  });
}

export async function getUserDocumentByEmail(email: string) {
  return db.user.findUnique({
    where: { normalizedEmail: normalizeEmail(email) },
  });
}

export async function updateUserProfileByIssuer(input: {
  issuer: string;
  displayName: string;
  email: string;
}): Promise<UserProfile | null> {
  const normalizedEmail = normalizeEmail(input.email);
  const trimmedDisplayName = input.displayName.trim();

  const existingUser = await db.user.findUnique({
    where: { issuer: input.issuer },
    select: { id: true },
  });

  if (!existingUser) {
    return null;
  }

  const user = await db.user.update({
    where: { issuer: input.issuer },
    data: {
      email: normalizedEmail,
      normalizedEmail,
      name: trimmedDisplayName,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return mapPrismaUserToUserProfile(user);
}

export async function deleteUserByIssuer(issuer: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { issuer },
    select: { id: true },
  });

  if (!user) {
    return false;
  }

  await db.$transaction([
    db.inviteCode.deleteMany({
      where: { createdByUserId: user.id },
    }),
    db.inviteCode.updateMany({
      where: { redeemedByUserId: user.id },
      data: { redeemedByUserId: null },
    }),
    db.user.updateMany({
      where: { invitedByUserId: user.id },
      data: { invitedByUserId: null },
    }),
    db.user.delete({
      where: { id: user.id },
    }),
  ]);

  return true;
}

export async function countUsers(): Promise<number> {
  return db.user.count();
}

export async function findDuplicateNormalizedEmails(): Promise<
  DuplicateEmailReportItem[]
> {
  const users = await db.user.findMany({
    select: {
      issuer: true,
      normalizedEmail: true,
    },
  });

  const counts = new Map<string, { count: number; issuers: string[] }>();

  for (const user of users) {
    const email = normalizeEmail(user.normalizedEmail);

    if (!email) {
      continue;
    }

    const existing = counts.get(email);

    if (existing) {
      existing.count += 1;
      if (user.issuer) {
        existing.issuers.push(user.issuer);
      }
    } else {
      counts.set(email, {
        count: 1,
        issuers: user.issuer ? [user.issuer] : [],
      });
    }
  }

  return Array.from(counts.entries())
    .filter(([, value]) => value.count > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([email, value]) => ({
      email,
      count: value.count,
      issuers: value.issuers,
    }));
}
