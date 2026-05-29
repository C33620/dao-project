import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSession } from "@/lib/services/session";
import { AccountSetupStatus, TreasuryDistributionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE = "govboard_session";

function applyNoStoreHeaders(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

function getAccountSetupPayload(input: {
  accountSetupStatus: AccountSetupStatus | null | undefined;
  initialAllocationStatus: TreasuryDistributionStatus | null | undefined;
}) {
  if (
    input.initialAllocationStatus === TreasuryDistributionStatus.SUCCEEDED ||
    input.accountSetupStatus === AccountSetupStatus.READY
  ) {
    return {
      status: "ready" as const,
      message: "Your account is ready.",
    };
  }

  if (
    input.initialAllocationStatus === TreasuryDistributionStatus.FAILED_FINAL ||
    input.accountSetupStatus === AccountSetupStatus.NEEDS_ATTENTION
  ) {
    return {
      status: "needs_attention" as const,
      message: "We’re still finishing your account setup.",
    };
  }

  return {
    status: "finalizing" as const,
    message: "We’re finalizing your account.",
  };
}

export async function GET() {
  try {
    const session = await getSession();
    const user = await getCurrentUser();

    let accountSetup = null;
    let accountState = null;

    if (user) {
      const setupUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          accountSetupStatus: true,
          accountSetupUpdatedAt: true,
          walletAddress: true,
          walletChain: true,
          walletProvider: true,
          walletResolutionStatus: true,
          walletResolvedAt: true,
          walletResolutionError: true,
          initialAllocationStatus: true,
          initialAllocationAt: true,
          initialAllocationTxHash: true,
        },
      });

      accountSetup = getAccountSetupPayload({
        accountSetupStatus: setupUser?.accountSetupStatus,
        initialAllocationStatus: setupUser?.initialAllocationStatus,
      });

      accountState = setupUser
        ? {
            walletAddress: setupUser.walletAddress,
            walletChain: setupUser.walletChain,
            walletProvider: setupUser.walletProvider,
            walletResolutionStatus: setupUser.walletResolutionStatus,
            walletResolvedAt: setupUser.walletResolvedAt,
            walletResolutionError: setupUser.walletResolutionError,
            initialAllocationStatus: setupUser.initialAllocationStatus,
            initialAllocationAt: setupUser.initialAllocationAt,
            initialAllocationTxHash: setupUser.initialAllocationTxHash,
            accountSetupUpdatedAt: setupUser.accountSetupUpdatedAt,
          }
        : null;
    }

    const response = NextResponse.json(
      user
        ? {
            authenticated: true,
            user: {
              id: user.id,
              displayName: user.displayName,
              email: user.email,
              role: user.role,
            },
            accountSetup,
            accountState,
          }
        : {
            authenticated: false,
            user: null,
            accountSetup: null,
            accountState: null,
          },
    );

    if (session && !user) {
      clearSessionCookie(response);
    }

    return applyNoStoreHeaders(response);
  } catch (error) {
    console.error("[SESSION_ROUTE] GET_ERROR", error);

    const response = NextResponse.json(
      {
        authenticated: false,
        user: null,
        accountSetup: null,
        accountState: null,
      },
      { status: 200 },
    );

    clearSessionCookie(response);
    return applyNoStoreHeaders(response);
  }
}
