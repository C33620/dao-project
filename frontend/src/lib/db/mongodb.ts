import "server-only";

import type {
  DuplicateEmailReportItem,
  UserDocument,
} from "@/lib/repositories/users";
import { Collection, Db, MongoClient } from "mongodb";

let mongoClientPromise: Promise<MongoClient> | null = null;
let usersCollectionInitPromise: Promise<void> | null = null;

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return uri;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(getMongoUri()).connect();
  }

  return mongoClientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db();
}

async function findDuplicateNormalizedEmailsInCollection(
  users: Collection<UserDocument>,
): Promise<DuplicateEmailReportItem[]> {
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

async function ensureUsersCollectionIndexes(
  users: Collection<UserDocument>,
): Promise<void> {
  const duplicates = await findDuplicateNormalizedEmailsInCollection(users);

  if (duplicates.length > 0) {
    const details = duplicates
      .map(
        (item) => `${item.email} (${item.count}): ${item.issuers.join(", ")}`,
      )
      .join("; ");

    throw new Error(
      `Cannot enforce unique user emails because duplicate normalized emails already exist: ${details}`,
    );
  }

  await users.createIndex(
    { email: 1 },
    { unique: true, name: "users_email_unique" },
  );
}

export async function getUsersCollection(options?: {
  skipIndexSetup?: boolean;
}): Promise<Collection<UserDocument>> {
  const db = await getMongoDb();
  const users = db.collection<UserDocument>("users");

  if (!options?.skipIndexSetup) {
    if (!usersCollectionInitPromise) {
      usersCollectionInitPromise = ensureUsersCollectionIndexes(users);
    }

    await usersCollectionInitPromise;
  }

  return users;
}
