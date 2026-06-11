import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TreasuryDistributionStatus } from "@prisma/client";
import type { ReactNode } from "react";
import { AppShellLayout } from "./shell-layout";

type AppLayoutProps = {
  children: ReactNode;
};

async function getAdminPendingCount(role: string): Promise<number> {
  if (role !== "admin") {
    return 0;
  }

  return db.treasuryDistribution.count({
    where: {
      status: {
        in: [
          TreasuryDistributionStatus.PENDING,
          TreasuryDistributionStatus.FAILED_RETRYABLE,
          TreasuryDistributionStatus.PAUSED,
        ],
      },
    },
  });
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const currentUser = await requireUser();
  const adminPendingCount = await getAdminPendingCount(currentUser.role);

  return (
    <AppShellLayout
      role={currentUser.role}
      adminPendingCount={adminPendingCount}
    >
      {children}
    </AppShellLayout>
  );
}
