import "server-only";

import { db } from "@/lib/db";
import { AccountCloseAttemptStatus } from "@prisma/client";
import { randomUUID } from "crypto";

const ATTEMPT_TTL_MINUTES = 15;

const ACTIVE_STATUSES: AccountCloseAttemptStatus[] = [
  AccountCloseAttemptStatus.PREPARED,
  AccountCloseAttemptStatus.AUTHORIZATION_SIGNED,
  AccountCloseAttemptStatus.AUTHORIZATION_STORED,
  AccountCloseAttemptStatus.EXECUTION_QUEUED,
  AccountCloseAttemptStatus.EXECUTION_SUBMITTED,
];

export async function getActiveCloseAttemptByIssuer(issuer: string) {
  return db.accountCloseAttempt.findFirst({
    where: {
      issuer,
      status: { in: ACTIVE_STATUSES },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCloseAttemptByKey(attemptKey: string) {
  return db.accountCloseAttempt.findUnique({
    where: { attemptKey },
  });
}

export async function createCloseAttempt(input: {
  userId: string;
  issuer: string;
  walletAddress: string;
  chainId: number;
  recipientAddress: string;
  delegateContractAddress: string;
  relayerAddress: string;
  closeDeadline: Date;
}) {
  const expiresAt = new Date(Date.now() + ATTEMPT_TTL_MINUTES * 60 * 1000);

  await db.accountCloseAttempt.updateMany({
    where: {
      issuer: input.issuer,
      status: { in: ACTIVE_STATUSES },
    },
    data: {
      status: AccountCloseAttemptStatus.EXPIRED,
    },
  });

  return db.accountCloseAttempt.create({
    data: {
      attemptKey: randomUUID(),
      userId: input.userId,
      issuer: input.issuer,
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      recipientAddress: input.recipientAddress,
      delegateContractAddress: input.delegateContractAddress,
      relayerAddress: input.relayerAddress,
      closeDeadline: input.closeDeadline,
      status: AccountCloseAttemptStatus.PREPARED,
      expiresAt,
    },
  });
}

export async function storeSignedAuthorization(input: {
  attemptKey: string;
  authorizationNonce: string;
  authorizationChainId: number;
  authorizationContractAddress: string;
  authorizationV: number;
  authorizationR: string;
  authorizationS: string;
  closeIntentRelayer: string;
  closeIntentNonce: string;
  closeIntentDeadline: Date;
  closeIntentSignature: string;
}) {
  return db.accountCloseAttempt.update({
    where: { attemptKey: input.attemptKey },
    data: {
      status: AccountCloseAttemptStatus.AUTHORIZATION_STORED,
      authorizationNonce: input.authorizationNonce,
      authorizationChainId: input.authorizationChainId,
      authorizationContractAddress: input.authorizationContractAddress,
      authorizationV: input.authorizationV,
      authorizationR: input.authorizationR,
      authorizationS: input.authorizationS,
      authorizationSignedAt: new Date(),
      authorizationStoredAt: new Date(),
      closeIntentRelayer: input.closeIntentRelayer,
      closeIntentNonce: input.closeIntentNonce,
      closeIntentDeadline: input.closeIntentDeadline,
      closeIntentSignature: input.closeIntentSignature,
    },
  });
}

export async function markExecutionQueued(attemptKey: string) {
  return db.accountCloseAttempt.update({
    where: { attemptKey },
    data: {
      status: AccountCloseAttemptStatus.EXECUTION_QUEUED,
      executionQueuedAt: new Date(),
    },
  });
}

export async function markExecutionSubmitted(input: {
  attemptKey: string;
  executionTxHash: string;
}) {
  return db.accountCloseAttempt.update({
    where: { attemptKey: input.attemptKey },
    data: {
      status: AccountCloseAttemptStatus.EXECUTION_SUBMITTED,
      executionTxHash: input.executionTxHash,
      executionSubmittedAt: new Date(),
    },
  });
}

export async function markExecutionConfirmed(input: {
  attemptKey: string;
  executionBlockNumber: number;
}) {
  return db.accountCloseAttempt.update({
    where: { attemptKey: input.attemptKey },
    data: {
      status: AccountCloseAttemptStatus.EXECUTION_CONFIRMED,
      executionBlockNumber: input.executionBlockNumber,
      executionConfirmedAt: new Date(),
    },
  });
}

export async function markCloseAttemptFailed(input: {
  attemptKey: string;
  errorCode: string;
  errorMessage: string;
}) {
  return db.accountCloseAttempt.update({
    where: { attemptKey: input.attemptKey },
    data: {
      status: AccountCloseAttemptStatus.FAILED,
      lastErrorCode: input.errorCode,
      lastErrorMessage: input.errorMessage,
    },
  });
}

export type PrismaTxClient = Parameters<
  Parameters<typeof db.$transaction>[0]
>[0];

export async function markCloseAttemptFinalizedTx(
  tx: PrismaTxClient,
  attemptKey: string,
) {
  return tx.accountCloseAttempt.update({
    where: { attemptKey },
    data: {
      status: AccountCloseAttemptStatus.FINALIZED,
      finalizedAt: new Date(),
    },
  });
}
