import { getMockWalletSession } from "@/lib/mock/interactions";
import type { WalletGovernanceProfile } from "@/types/governance";

export async function getWalletSession(): Promise<WalletGovernanceProfile> {
  return getMockWalletSession();
}
