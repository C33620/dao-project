import { db } from "@/lib/db";
import { TreasuryDistributionStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";

const getCachedAdminPendingCount = unstable_cache(
  async () => {
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
  },
  ["admin-pending-count"],
  {
    revalidate: 15,
    tags: ["admin-pending-count"],
  },
);

export async function AdminPendingCount() {
  const count = await getCachedAdminPendingCount();
  return count;
}
