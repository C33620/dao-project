"use client";

import { getMagicClient } from "@/lib/auth/magic-client";
import type { EIP1193Provider } from "viem";
import { createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";

export async function getMagicWalletClient() {
  const magic = getMagicClient();
  const provider = magic.rpcProvider as EIP1193Provider;

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  const [account] = accounts;

  if (!account) {
    throw new Error("No Magic wallet account available.");
  }

  return createWalletClient({
    account: account as `0x${string}`,
    chain: sepolia,
    transport: custom(provider),
  });
}
