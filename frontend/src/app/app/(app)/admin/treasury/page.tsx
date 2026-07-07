import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TreasuryQueueSection } from "./treasury-queue-section";
import { TreasuryQueueSkeleton } from "./treasury-queue-skeleton";

export default async function AdminTreasuryPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/auth");
  }

  if (currentUser.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="grid gap-6 w-full max-w-310 mx-auto px-4 sm:px-[0.95rem] min-[900px]:px-6">
      <section className="grid gap-5" aria-label="Treasury queue">
        <Suspense fallback={<TreasuryQueueSkeleton />}>
          <TreasuryQueueSection />
        </Suspense>
      </section>
    </main>
  );
}
