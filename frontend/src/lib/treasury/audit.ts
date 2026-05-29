import { Prisma, TreasuryDistributionKind } from "@prisma/client";

type WriteTreasuryAuditEventInput = {
  userId: string;
  type: string;
  actor?: string;
  normalizedEmail?: string;
  issuer?: string;
  walletAddress?: string;
  kind?: TreasuryDistributionKind;
  amountBaseUnits?: string;
  tokenAddress?: string;
  chainId?: number;
  txHash?: string;
  idempotencyKey?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeTreasuryAuditEvent(
  input: WriteTreasuryAuditEventInput,
) {
  void input;
  return;
}
