"use client";

import { Magic } from "magic-sdk";

let magicClient: Magic | null = null;

export function getMagicClient() {
  if (!magicClient) {
    const publishableKey = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

    if (!publishableKey) {
      throw new Error("Magic is not configured on the frontend.");
    }

    if (!rpcUrl) {
      throw new Error("Sepolia RPC URL is not configured on the frontend.");
    }

    magicClient = new Magic(publishableKey, {
      network: {
        rpcUrl,
        chainId: 11155111,
      },
    });
  }

  return magicClient;
}
