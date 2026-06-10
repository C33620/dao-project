"use client";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { AppRole } from "@/config/nav";
import { ReactNode, useState } from "react";

type AppShellLayoutProps = {
  children: ReactNode;
  role: AppRole;
};

export function AppShellLayout({ children, role }: AppShellLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
      />

      <div className="app-shell__main">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
