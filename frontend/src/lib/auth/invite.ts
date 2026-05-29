import { InviteCodeStatus } from "@prisma/client";
import crypto from "node:crypto";

const DEFAULT_INVITE_TTL_DAYS = Number(process.env.INVITE_CODE_TTL_DAYS ?? 30);

export function generateInviteCode(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";

  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }

  return out;
}

export function buildInviteExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_INVITE_TTL_DAYS);
  return expiresAt;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function resolveInviteAvailability(
  status: InviteCodeStatus,
  expiresAt: Date | null,
): InviteCodeStatus {
  if (status !== InviteCodeStatus.AVAILABLE) {
    return status;
  }

  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return InviteCodeStatus.EXPIRED;
  }

  return InviteCodeStatus.AVAILABLE;
}
