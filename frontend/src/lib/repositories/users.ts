import "server-only";

import { getUsersCollection } from "@/lib/db/mongodb";
import type { UserProfile } from "@/types/user";
import { MongoServerError } from "mongodb";

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

function mapUserDocumentToUserProfile(document: UserDocument): UserProfile {
  return {
    id: document._id,
    displayName: document.displayName,
    email: document.email,
    walletAddress: document.primaryWallet ?? undefined,
    role: "member",
  };
}

export function isMongoDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

export async function upsertUserFromVerifiedAuth(input: {
  issuer: string;
  email: string;
  displayName: string;
}) {
  const users = await getUsersCollection();
  const now = new Date();
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();

  await users.updateOne(
    { _id: input.issuer },
    {
      $set: {
        email,
        updatedAt: now,
        lastSignedInAt: now,
      },
      $setOnInsert: {
        _id: input.issuer,
        displayName,
        wallets: [],
        primaryWallet: null,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

export async function getUserByIssuer(
  issuer: string,
): Promise<UserProfile | null> {
  const users = await getUsersCollection();
  const document = await users.findOne({ _id: issuer });

  if (!document) {
    return null;
  }

  return mapUserDocumentToUserProfile(document);
}

export async function getUserDocumentByIssuer(
  issuer: string,
): Promise<UserDocument | null> {
  const users = await getUsersCollection();
  return users.findOne({ _id: issuer });
}

export async function getUserDocumentByEmail(
  email: string,
): Promise<UserDocument | null> {
  const users = await getUsersCollection();
  return users.findOne({ email: normalizeEmail(email) });
}

export async function updateUserProfileByIssuer(input: {
  issuer: string;
  displayName: string;
  email: string;
}): Promise<UserProfile | null> {
  const users = await getUsersCollection();
  const now = new Date();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedDisplayName = input.displayName.trim();

  await users.updateOne(
    { _id: input.issuer },
    {
      $set: {
        displayName: normalizedDisplayName,
        email: normalizedEmail,
        updatedAt: now,
      },
    },
  );

  return getUserByIssuer(input.issuer);
}

export async function deleteUserByIssuer(issuer: string): Promise<boolean> {
  const users = await getUsersCollection();
  const result = await users.deleteOne({ _id: issuer });
  return result.deletedCount === 1;
}

export async function countUsers(): Promise<number> {
  const users = await getUsersCollection();
  return users.countDocuments({});
}

export async function findDuplicateNormalizedEmails(): Promise<
  DuplicateEmailReportItem[]
> {
  const users = await getUsersCollection({ skipIndexSetup: true });

  const duplicates = await users
    .aggregate<{
      _id: string;
      count: number;
      issuers: string[];
    }>([
      {
        $project: {
          _id: 1,
          normalizedEmail: {
            $toLower: {
              $trim: {
                input: "$email",
              },
            },
          },
        },
      },
      {
        $match: {
          normalizedEmail: { $ne: "" },
        },
      },
      {
        $group: {
          _id: "$normalizedEmail",
          count: { $sum: 1 },
          issuers: { $push: "$_id" },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ])
    .toArray();

  return duplicates.map((item) => ({
    email: item._id,
    count: item.count,
    issuers: item.issuers,
  }));
}
