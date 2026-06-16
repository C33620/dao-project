"use client";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { AppRole } from "@/config/nav";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type AppShellLayoutProps = {
  children: ReactNode;
  role: AppRole;
  adminPendingCount?: number;
};

type AdminPendingCountResponse = {
  ok: boolean;
  count?: number;
};

export function AppShellLayout({
  children,
  role,
  adminPendingCount = 0,
}: AppShellLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveAdminPendingCount, setLiveAdminPendingCount] = useState<
    number | null
  >(null);

  const isAdminTreasuryPage = pathname === "/app/admin/treasury";
  const effectiveAdminPendingCount = liveAdminPendingCount ?? adminPendingCount;
  const displayedAdminPendingCount =
    role === "admin" && isAdminTreasuryPage ? 0 : effectiveAdminPendingCount;

  useEffect(() => {
    if (role !== "admin") {
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;

    async function refreshPendingCount() {
      try {
        const response = await fetch("/api/admin/pending-count", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as AdminPendingCountResponse;

        if (!cancelled && data.ok && typeof data.count === "number") {
          setLiveAdminPendingCount(data.count);
        }
      } catch {}
    }

    void refreshPendingCount();

    if (!isAdminTreasuryPage) {
      intervalId = window.setInterval(refreshPendingCount, 15000);
    }

    return () => {
      cancelled = true;

      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [role, isAdminTreasuryPage]);

  return (
    <div className="app-shell">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        adminPendingCount={displayedAdminPendingCount}
      />

      <div className="app-shell__main">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
