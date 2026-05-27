"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

type AppHeaderProps = {
  onMenuClick: () => void;
};

const titles: Record<string, { title: string; subtitle: string }> = {
  "/app/dashboard": {
    title: "Dashboard",
    subtitle: "Protocol overview, participation, and governance health.",
  },
  "/app/proposals": {
    title: "Proposals",
    subtitle: "Review active items and prepare for voting.",
  },
  "/app/execute": {
    title: "Execute",
    subtitle: "Track queued actions and readiness before execution.",
  },
  "/app/history": {
    title: "History",
    subtitle: "Follow recent governance activity across the protocol.",
  },
  "/app/settings": {
    title: "Settings",
    subtitle: "Manage account and governance preferences.",
  },
};

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const pathname = usePathname();

  const routeMeta = useMemo(() => {
    if (pathname.startsWith("/app/proposals/")) {
      return {
        title: "Proposal detail",
        subtitle: "Review proposal metadata, voting context, and next steps.",
      };
    }

    return (
      titles[pathname] ?? {
        title: "Governance workspace",
        subtitle: "Product shell placeholder view.",
      }
    );
  }, [pathname]);

  return (
    <header className="app-header">
      <div className="app-header__left">
        <button
          type="button"
          className="app-header__menu-button"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <span />
          <span />
          <span />
        </button>

        <div className="app-header__route">
          <p className="app-header__eyebrow">Governance app</p>
          <h1 className="app-header__title">{routeMeta.title}</h1>
          <p className="app-header__subtitle">{routeMeta.subtitle}</p>
        </div>
      </div>

      <div className="app-header__status" aria-label="Application status">
        <div className="top-status-chip">
          <span className="top-status-chip__label">Network</span>
          <span className="top-status-chip__value">Sepolia placeholder</span>
        </div>
        <div className="top-status-chip">
          <span className="top-status-chip__label">Wallet</span>
          <span className="top-status-chip__value">Not connected</span>
        </div>
        <div className="top-status-chip">
          <span className="top-status-chip__label">Role</span>
          <span className="top-status-chip__value">Delegate preview</span>
        </div>
      </div>
    </header>
  );
}
