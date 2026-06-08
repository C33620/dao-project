import closeAccountDelegateAbi from "@/abi/CloseAccountDelegate.json";
import { db } from "@/lib/db";
import {
  getCloseAttemptByKey,
  markCloseAttemptFailed,
  markCloseAttemptFinalizedTx,
  markExecutionConfirmed,
  markExecutionQueued,
  markExecutionSubmitted,
} from "@/lib/repositories/accountCloseAttempts";
import { getSession } from "@/lib/services/session";
import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
  encodeFunctionData,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export const runtime = "nodejs";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function extractRevertData(err: unknown): `0x${string}` | undefined {
  let current: unknown = err;
  const seen = new Set<unknown>();

  while (isRecord(current) && !seen.has(current)) {
    seen.add(current);

    const data = current["data"];
    if (
      typeof data === "string" &&
      data.startsWith("0x") &&
      data.length >= 10
    ) {
      return data as `0x${string}`;
    }

    current = current["cause"];
  }

  return undefined;
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: "govboard_session",
    value: "",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

type ExecuteBody = {
  attemptKey?: string;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 },
    );
  }

  let body: ExecuteBody;
  try {
    body = (await request.json()) as ExecuteBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "We could not execute account closure." },
      { status: 400 },
    );
  }

  if (!body.attemptKey) {
    return NextResponse.json(
      { ok: false, error: "Missing attempt key." },
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

  if (
    !attempt.authorizationNonce ||
    !attempt.authorizationChainId ||
    !attempt.authorizationContractAddress ||
    typeof attempt.authorizationV !== "number" ||
    !attempt.authorizationR ||
    !attempt.authorizationS ||
    !attempt.closeIntentRelayer ||
    !attempt.closeIntentNonce ||
    !attempt.closeIntentDeadline ||
    !attempt.closeIntentSignature
  ) {
    return NextResponse.json(
      { ok: false, error: "Authorization has not been stored yet." },
      { status: 400 },
    );
  }

  try {
    const rpcUrl = process.env.TREASURY_RPC_URL;
    const relayerKey = process.env.RELAYER_PRIVATE_KEY;

    if (!rpcUrl) {
      throw new Error("TREASURY_RPC_URL is not configured.");
    }

    if (!relayerKey) {
      throw new Error("RELAYER_PRIVATE_KEY is not configured.");
    }

    const account = privateKeyToAccount(relayerKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    await markExecutionQueued(attempt.attemptKey);

    console.log("execute relayer from key", account.address);
    console.log("attempt.relayerAddress", attempt.relayerAddress);
    console.log("attempt.closeIntentRelayer", attempt.closeIntentRelayer);

    const closeIntentDeadlineSeconds = BigInt(
      Math.floor(attempt.closeIntentDeadline.getTime() / 1000),
    );

    const data = encodeFunctionData({
      abi: closeAccountDelegateAbi,
      functionName: "closeAccount",
      args: [
        attempt.closeIntentRelayer as `0x${string}`,
        BigInt(attempt.closeIntentNonce),
        closeIntentDeadlineSeconds,
        attempt.closeIntentSignature as `0x${string}`,
      ],
    });

    const authorizationYParity =
      attempt.authorizationV === 27
        ? 0
        : attempt.authorizationV === 28
        ? 1
        : attempt.authorizationV;

    console.log("close execute payload", {
      walletAddress: attempt.walletAddress,
      delegateContractAddress: attempt.delegateContractAddress,
      authorizationContractAddress: attempt.authorizationContractAddress,
      relayer: attempt.closeIntentRelayer,
      nonce: String(attempt.closeIntentNonce),
      deadlineSeconds: closeIntentDeadlineSeconds.toString(),
      authorizationChainId: attempt.authorizationChainId,
      authorizationNonce: String(attempt.authorizationNonce),
      authorizationV: attempt.authorizationV,
      authorizationYParity,
      authorizationR: attempt.authorizationR,
      authorizationS: attempt.authorizationS,
    });

    const txHash = await walletClient.sendTransaction({
      account,
      to: attempt.walletAddress as `0x${string}`,
      data,
      authorizationList: [
        {
          address: attempt.authorizationContractAddress as `0x${string}`,
          chainId: attempt.authorizationChainId,
          nonce: Number(attempt.authorizationNonce),
          yParity: authorizationYParity,
          r: attempt.authorizationR as `0x${string}`,
          s: attempt.authorizationS as `0x${string}`,
        },
      ],
      chain: sepolia,
      type: "eip7702",
    });

    await markExecutionSubmitted({
      attemptKey: attempt.attemptKey,
      executionTxHash: txHash,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status !== "success") {
      throw new Error("On-chain execution failed.");
    }

    await markExecutionConfirmed({
      attemptKey: attempt.attemptKey,
      executionBlockNumber: Number(receipt.blockNumber),
    });

    await db.$transaction(async (tx) => {
      await markCloseAttemptFinalizedTx(tx, attempt.attemptKey);

      await tx.inviteCode.deleteMany({
        where: { createdByUserId: attempt.userId },
      });
      await tx.inviteCode.updateMany({
        where: { redeemedByUserId: attempt.userId },
        data: { redeemedByUserId: null },
      });
      await tx.user.updateMany({
        where: { invitedByUserId: attempt.userId },
        data: { invitedByUserId: null },
      });
      await tx.user.delete({
        where: { id: attempt.userId },
      });
    });
  } catch (err: unknown) {
    let message = err instanceof Error ? err.message : "Unknown error";

    console.error("close execute failed", err);
    console.error("error cause", isRecord(err) ? err["cause"] : undefined);
    console.error(
      "error cause cause",
      isRecord(err) && isRecord(err["cause"])
        ? err["cause"]["cause"]
        : undefined,
    );

    const revertData = extractRevertData(err);
    console.error("revertData", revertData);

    if (revertData) {
      try {
        const decoded = decodeErrorResult({
          abi: closeAccountDelegateAbi,
          data: revertData,
        });

        console.error("decoded closeAccount revert", decoded);

        message =
          decoded.args && decoded.args.length > 0
            ? `${decoded.errorName}(${decoded.args.map(String).join(", ")})`
            : decoded.errorName;
      } catch (decodeErr) {
        const decodeMessage =
          decodeErr instanceof Error
            ? decodeErr.message
            : "Unknown decode error";
        console.error(
          "failed to decode revert data",
          decodeMessage,
          revertData,
        );
      }
    }

    await markCloseAttemptFailed({
      attemptKey: attempt.attemptKey,
      errorCode: "EXECUTION_FAILED",
      errorMessage: message,
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development"
            ? message
            : "We could not execute account closure.",
      },
      { status: 500 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: "/",
  });
  clearSessionCookie(response);
  return response;
}
