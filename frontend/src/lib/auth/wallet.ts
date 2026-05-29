import { db } from "@/lib/db";
import { Magic } from "@magic-sdk/admin";
import {
  AccountSetupEventType,
  AccountSetupStatus,
  Prisma,
} from "@prisma/client";

const magic = new Magic(process.env.MAGIC_SECRET_KEY ?? "");

type ResolveUserWalletForSignupInput = {
  userId: string;
  issuer: string;
  email: string;
  didToken?: string;
};

export type WalletResolutionResult =
  | {
      status: "resolved";
      walletAddress: string;
      provider: "magic";
      chain: "sepolia";
    }
  | {
      status: "pending";
      reason: string;
    }
  | {
      status: "unavailable";
      reason: string;
    };

function normalizeWalletAddress(value: string) {
  return value.trim();
}

async function createSetupEvent(input: {
  userId: string;
  type: AccountSetupEventType;
  status: AccountSetupStatus;
  message?: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await db.accountSetupEvent.create({
    data: {
      userId: input.userId,
      type: input.type,
      status: input.status,
      message: input.message,
      metadata: input.metadata,
    },
  });
}

export async function getStoredWalletForUser(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      walletAddress: true,
      walletChain: true,
      walletProvider: true,
      walletResolutionStatus: true,
      walletResolvedAt: true,
      walletResolutionError: true,
      accountSetupStatus: true,
      accountSetupUpdatedAt: true,
    },
  });
}

export async function resolveUserWalletForSignup(
  input: ResolveUserWalletForSignupInput,
): Promise<WalletResolutionResult> {
  const existingUser = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      walletAddress: true,
      walletChain: true,
      walletProvider: true,
    },
  });

  if (existingUser?.walletAddress) {
    return {
      status: "resolved",
      walletAddress: existingUser.walletAddress,
      provider: (existingUser.walletProvider as "magic") ?? "magic",
      chain: (existingUser.walletChain as "sepolia") ?? "sepolia",
    };
  }

  await createSetupEvent({
    userId: input.userId,
    type: AccountSetupEventType.WALLET_RESOLUTION_REQUESTED,
    status: AccountSetupStatus.PENDING,
    message: "Wallet resolution started.",
    metadata: {
      source: "magic-auth-linked",
      issuer: input.issuer,
      email: input.email,
      hasDidToken: Boolean(input.didToken),
    },
  });

  try {
    let metadata:
      | {
          issuer?: string | null;
          email?: string | null;
          publicAddress?: string | null;
        }
      | undefined;

    if (input.didToken) {
      metadata = (await magic.users.getMetadataByToken(input.didToken)) as {
        issuer?: string | null;
        email?: string | null;
        publicAddress?: string | null;
      };
    } else {
      metadata = (await magic.users.getMetadataByIssuer(input.issuer)) as {
        issuer?: string | null;
        email?: string | null;
        publicAddress?: string | null;
      };
    }

    const walletAddress = metadata?.publicAddress
      ? normalizeWalletAddress(metadata.publicAddress)
      : null;

    if (!walletAddress) {
      const now = new Date();

      await db.user.update({
        where: { id: input.userId },
        data: {
          walletResolutionStatus: AccountSetupStatus.PENDING,
          walletResolutionError: "Wallet address not yet available from Magic.",
          accountSetupStatus: AccountSetupStatus.PENDING,
          accountSetupUpdatedAt: now,
        },
      });

      await createSetupEvent({
        userId: input.userId,
        type: AccountSetupEventType.WALLET_RESOLUTION_PENDING,
        status: AccountSetupStatus.PENDING,
        message: "Wallet address was not yet available.",
        metadata: {
          source: "magic-auth-linked",
          issuer: metadata?.issuer ?? input.issuer,
          email: metadata?.email ?? input.email,
        },
      });

      return {
        status: "pending",
        reason: "Wallet address not yet available from Magic.",
      };
    }

    const now = new Date();

    await db.user.update({
      where: { id: input.userId },
      data: {
        walletAddress,
        walletChain: "sepolia",
        walletProvider: "magic",
        walletResolutionStatus: AccountSetupStatus.READY,
        walletResolvedAt: now,
        walletResolutionError: null,
        accountSetupStatus: AccountSetupStatus.PENDING,
        accountSetupUpdatedAt: now,
      },
    });

    await createSetupEvent({
      userId: input.userId,
      type: AccountSetupEventType.WALLET_RESOLUTION_SUCCEEDED,
      status: AccountSetupStatus.READY,
      message: "Wallet resolved successfully.",
      metadata: {
        source: "magic-auth-linked",
        issuer: metadata?.issuer ?? input.issuer,
        email: metadata?.email ?? input.email,
        walletAddress,
        walletChain: "sepolia",
        walletProvider: "magic",
      },
    });

    return {
      status: "resolved",
      walletAddress,
      provider: "magic",
      chain: "sepolia",
    };
  } catch (error) {
    const now = new Date();
    const reason =
      error instanceof Error
        ? error.message
        : "Unexpected wallet resolution failure.";

    await db.user.update({
      where: { id: input.userId },
      data: {
        walletResolutionStatus: AccountSetupStatus.NEEDS_ATTENTION,
        walletResolutionError: reason,
        accountSetupStatus: AccountSetupStatus.NEEDS_ATTENTION,
        accountSetupUpdatedAt: now,
      },
    });

    await createSetupEvent({
      userId: input.userId,
      type: AccountSetupEventType.WALLET_RESOLUTION_FAILED,
      status: AccountSetupStatus.NEEDS_ATTENTION,
      message: "Wallet resolution failed.",
      metadata: {
        source: "magic-auth-linked",
        issuer: input.issuer,
        email: input.email,
        error: reason,
      },
    });

    return {
      status: "unavailable",
      reason,
    };
  }
}
