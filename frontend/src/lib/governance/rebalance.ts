import "server-only";

import { db } from "@/lib/db";

const TOKEN_DECIMALS = 18;
const TOKEN_BASE = BigInt(10) ** BigInt(TOKEN_DECIMALS);
const BOOTSTRAP_ALLOCATION_TOKENS = BigInt(20000);
const THRESHOLD_TOKENS = BigInt(42000);

export function formatUnits18(value: bigint) {
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  const whole = absolute / TOKEN_BASE;
  const fraction = (absolute % TOKEN_BASE)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function ceilDiv(numerator: bigint, denominator: bigint) {
  return (numerator + denominator - BigInt(1)) / denominator;
}

export async function getEligibleGovernanceUserCount() {
  return db.user.count({
    where: {
      role: { in: ["MEMBER", "DELEGATE", "ADMIN"] },
      walletAddress: { not: null },
    },
  });
}

export function computeGovernanceTargetBaseUnits(userCount: number) {
  if (userCount <= 1) {
    return BOOTSTRAP_ALLOCATION_TOKENS * TOKEN_BASE;
  }

  const majorityUsers = BigInt(Math.floor(userCount / 2) + 1);
  return ceilDiv(THRESHOLD_TOKENS * TOKEN_BASE, majorityUsers);
}

export async function getGovernanceRebalanceSnapshot() {
  const userCount = await getEligibleGovernanceUserCount();
  const targetBaseUnits = computeGovernanceTargetBaseUnits(userCount);
  return {
    userCount,
    targetBaseUnits: targetBaseUnits.toString(),
    targetTokens: formatUnits18(targetBaseUnits),
    thresholdTokens: THRESHOLD_TOKENS.toString(),
    bootstrapTokens: BOOTSTRAP_ALLOCATION_TOKENS.toString(),
  };
}
