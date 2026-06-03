import {
  createCloseAttempt,
  getActiveCloseAttemptByIssuer,
} from "@/lib/repositories/accountCloseAttempts";
import { getUserDocumentByIssuer } from "@/lib/repositories/users";
import { getSession } from "@/lib/services/session";
import { isAddress } from "ethers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ClosePrepareRequestBody = {
  confirmation?: string;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 },
    );
  }

  let body: ClosePrepareRequestBody;
  try {
    body = (await request.json()) as ClosePrepareRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "We could not prepare account closure." },
      { status: 400 },
    );
  }

  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { ok: false, error: "Type DELETE to confirm." },
      { status: 400 },
    );
  }

  const user = await getUserDocumentByIssuer(session.issuer);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "We could not prepare account closure." },
      { status: 404 },
    );
  }

  if (!user.walletAddress || !isAddress(user.walletAddress)) {
    return NextResponse.json(
      {
        ok: false,
        error: "A valid wallet address is required before closing the account.",
      },
      { status: 400 },
    );
  }

  const recipientAddress = process.env.MASTER_WALLET_ADDRESS;
  const delegateContractAddress =
    process.env.CLOSE_ACCOUNT_DELEGATE_CONTRACT_ADDRESS;
  const relayerAddress = process.env.RELAYER_ADDRESS;
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");

  if (!recipientAddress || !isAddress(recipientAddress)) {
    return NextResponse.json(
      { ok: false, error: "Master wallet configuration is invalid." },
      { status: 500 },
    );
  }

  if (!delegateContractAddress || !isAddress(delegateContractAddress)) {
    return NextResponse.json(
      { ok: false, error: "Delegate contract configuration is invalid." },
      { status: 500 },
    );
  }

  if (!relayerAddress || !isAddress(relayerAddress)) {
    return NextResponse.json(
      { ok: false, error: "Relayer configuration is invalid." },
      { status: 500 },
    );
  }

  const existing = await getActiveCloseAttemptByIssuer(session.issuer);
  if (existing) {
    if (!existing.relayerAddress || !existing.closeDeadline) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stored close attempt is incomplete. Please start again.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      attemptKey: existing.attemptKey,
      walletAddress: existing.walletAddress,
      chainId: existing.chainId,
      expiresAt: existing.expiresAt.toISOString(),
      delegateContractAddress: existing.delegateContractAddress,
      recipientAddress: existing.recipientAddress,
      relayerAddress: existing.relayerAddress,
      closeDeadline: existing.closeDeadline.toISOString(),
    });
  }

  const closeDeadline = new Date(Date.now() + 10 * 60 * 1000);

  const attempt = await createCloseAttempt({
    userId: user.id,
    issuer: session.issuer,
    walletAddress: user.walletAddress,
    chainId,
    recipientAddress,
    delegateContractAddress,
    relayerAddress,
    closeDeadline,
  });

  return NextResponse.json({
    ok: true,
    attemptKey: attempt.attemptKey,
    walletAddress: attempt.walletAddress,
    chainId: attempt.chainId,
    expiresAt: attempt.expiresAt.toISOString(),
    delegateContractAddress: attempt.delegateContractAddress,
    recipientAddress: attempt.recipientAddress,
    relayerAddress: attempt.relayerAddress,
    closeDeadline: attempt.closeDeadline?.toISOString() ?? null,
  });
}
