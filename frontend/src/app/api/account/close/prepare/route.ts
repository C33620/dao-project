import closeAccountDelegateAbi from "@/abi/CloseAccountDelegate.json";
import { createCloseAttempt } from "@/lib/repositories/accountCloseAttempts";
import { getUserDocumentByIssuer } from "@/lib/repositories/users";
import { getSession } from "@/lib/services/session";
import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export const runtime = "nodejs";

type ClosePrepareRequestBody = {
  confirmation?: string;
};

function isDelegated7702Code(code: `0x${string}` | undefined) {
  if (!code || code === "0x") {
    return false;
  }

  return code.toLowerCase().startsWith("0xef0100");
}

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
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  const relayerAddress = relayerKey
    ? privateKeyToAccount(relayerKey as `0x${string}`).address
    : null;
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");
  const rpcUrl = process.env.TREASURY_RPC_URL;

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

  if (!Number.isInteger(chainId) || chainId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Chain configuration is invalid." },
      { status: 500 },
    );
  }

  if (!rpcUrl) {
    return NextResponse.json(
      { ok: false, error: "RPC configuration is invalid." },
      { status: 500 },
    );
  }

  const closeDeadline = new Date(Date.now() + 10 * 60 * 1000);

  try {
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletAddress = user.walletAddress as `0x${string}`;
    const code = await publicClient.getCode({
      address: walletAddress,
    });

    const isDelegated = isDelegated7702Code(code);
    let closeNonce = "0";

    if (isDelegated) {
      const liveNonce = (await publicClient.readContract({
        address: walletAddress,
        abi: closeAccountDelegateAbi,
        functionName: "closeNonce",
      })) as bigint;

      closeNonce = liveNonce.toString();
    }

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
      closeNonce,
      isDelegated,
    });
  } catch (error) {
    console.error("close prepare failed", error);

    return NextResponse.json(
      { ok: false, error: "We could not prepare account closure." },
      { status: 500 },
    );
  }
}
