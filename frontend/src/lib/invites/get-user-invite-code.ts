import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { InviteCodeStatus } from "@prisma/client";

export type InvitationCodeStatusView =
  | "AVAILABLE"
  | "REDEEMED"
  | "EXPIRED"
  | "REVOKED";

export type UserInviteCodeView = {
  code: string;
  status: InvitationCodeStatusView;
  expiresAt: Date | null;
} | null;

function deriveStatus(
  status: InviteCodeStatus,
  expiresAt: Date | null,
): InvitationCodeStatusView {
  if (
    status === InviteCodeStatus.AVAILABLE &&
    expiresAt &&
    expiresAt.getTime() <= Date.now()
  ) {
    return "EXPIRED";
  }

  return status;
}

export async function getUserInviteCode(): Promise<UserInviteCodeView> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const activeInvite = await db.inviteCode.findFirst({
    where: {
      createdByUserId: user.id,
      status: InviteCodeStatus.AVAILABLE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      status: true,
      expiresAt: true,
    },
  });

  if (activeInvite) {
    return {
      code: activeInvite.code,
      status: deriveStatus(activeInvite.status, activeInvite.expiresAt),
      expiresAt: activeInvite.expiresAt,
    };
  }

  const latestInvite = await db.inviteCode.findFirst({
    where: {
      createdByUserId: user.id,
    },
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!latestInvite) {
    return null;
  }

  return {
    code: latestInvite.code,
    status: deriveStatus(latestInvite.status, latestInvite.expiresAt),
    expiresAt: latestInvite.expiresAt,
  };
}
