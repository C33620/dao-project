import { Suspense } from "react";
import { TreasuryQueueSkeleton } from "./treasury-queue-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TreasuryQueueSection } from "./treasury-queue-section";

export default async function AdminTreasuryPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/auth");
  }

  if (currentUser.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="page-shell">
      <section className="page-shell__content" aria-label="Treasury queue">
        <Suspense fallback={<TreasuryQueueSkeleton />}>
          <TreasuryQueueSection />
        </Suspense>
      </section>
    </main>
  );
}
