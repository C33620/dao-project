import {
  getCloseAttemptByKey,
  markCloseAttemptFailed,
  storeSignedAuthorization,
} from "@/lib/repositories/accountCloseAttempts";
import { getSession } from "@/lib/services/session";
import { getAddress, isAddress } from "ethers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AuthorizationBody = {
  attemptKey?: string;
  authorization?: {
    chainId?: number | string;
    contractAddress?: string;
    nonce?: number | string;
    v?: number;
    r?: string;
    s?: string;
  };
  closeIntent?: {
    relayer?: string;
    nonce?: number | string;
    deadline?: number | string;
    signature?: string;
  };
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 },
    );
  }

  let body: AuthorizationBody;
  try {
    body = (await request.json()) as AuthorizationBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "We could not store the authorization." },
      { status: 400 },
    );
  }

  if (!body.attemptKey || !body.authorization || !body.closeIntent) {
    return NextResponse.json(
      { ok: false, error: "Missing authorization payload." },
      { status: 400 },
    );
  }

  const attempt = await getCloseAttemptByKey(body.attemptKey);
  if (!attempt || attempt.issuer !== session.issuer) {
    return NextResponse.json(
      { ok: false, error: "Close attempt not found." },
      { status: 404 },
    );
  }

  if (new Date() > attempt.expiresAt) {
    return NextResponse.json(
      {
        ok: false,
        error: "This close attempt has expired. Please start again.",
      },
      { status: 400 },
    );
  }

  const auth = body.authorization;
  const chainId = Number(auth.chainId);
  const nonce = String(auth.nonce ?? "");
  const contractAddress = auth.contractAddress ?? "";
  const v = auth.v;
  const r = auth.r ?? "";
  const s = auth.s ?? "";

  const closeRelayer = body.closeIntent.relayer ?? "";
  const closeNonce = String(body.closeIntent.nonce ?? "");
  const closeDeadlineRaw = body.closeIntent.deadline;
  const closeSignature = body.closeIntent.signature ?? "";

  if (
    !Number.isInteger(chainId) ||
    !nonce ||
    !isAddress(contractAddress) ||
    typeof v !== "number" ||
    !r ||
    !s ||
    !isAddress(closeRelayer) ||
    !closeNonce ||
    closeDeadlineRaw == null ||
    !closeSignature
  ) {
    return NextResponse.json(
      { ok: false, error: "Authorization payload is invalid." },
      { status: 400 },
    );
  }

  if (chainId !== attempt.chainId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authorization chain id does not match this attempt.",
      },
      { status: 400 },
    );
  }

  if (
    getAddress(contractAddress) !== getAddress(attempt.delegateContractAddress)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authorization contract does not match this attempt.",
      },
      { status: 400 },
    );
  }

  if (!attempt.relayerAddress) {
    return NextResponse.json(
      {
        ok: false,
        error: "Close attempt is missing relayer information.",
      },
      { status: 400 },
    );
  }

  if (getAddress(closeRelayer) !== getAddress(attempt.relayerAddress)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Close intent relayer does not match this attempt.",
      },
      { status: 400 },
    );
  }

  if (!attempt.closeDeadline) {
    return NextResponse.json(
      {
        ok: false,
        error: "Close attempt is missing deadline information.",
      },
      { status: 400 },
    );
  }

  const closeDeadlineSeconds = Number(closeDeadlineRaw);
  if (!Number.isFinite(closeDeadlineSeconds) || closeDeadlineSeconds <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Close intent deadline is invalid.",
      },
      { status: 400 },
    );
  }

  const closeDeadlineDate = new Date(closeDeadlineSeconds * 1000);

  if (closeDeadlineDate.getTime() > attempt.closeDeadline.getTime()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Close intent deadline does not match this attempt.",
      },
      { status: 400 },
    );
  }

  try {
    await storeSignedAuthorization({
      attemptKey: attempt.attemptKey,
      authorizationNonce: nonce,
      authorizationChainId: chainId,
      authorizationContractAddress: getAddress(contractAddress),
      authorizationV: v,
      authorizationR: r,
      authorizationS: s,
      closeIntentRelayer: getAddress(closeRelayer),
      closeIntentNonce: closeNonce,
      closeIntentDeadline: closeDeadlineDate,
      closeIntentSignature: closeSignature,
    });
  } catch (err) {
    await markCloseAttemptFailed({
      attemptKey: attempt.attemptKey,
      errorCode: "AUTHORIZATION_STORE_FAILED",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json(
      { ok: false, error: "We could not store the authorization." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, stored: true });
}
