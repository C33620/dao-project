import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

let publicClientSingleton: ReturnType<typeof createPublicClient> | null = null;

export function getBlockchainClient() {
  if (!publicClientSingleton) {
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

    if (!rpcUrl) {
      throw new Error("NEXT_PUBLIC_SEPOLIA_RPC_URL is not configured.");
    }

    publicClientSingleton = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });
  }

  return publicClientSingleton;
}
