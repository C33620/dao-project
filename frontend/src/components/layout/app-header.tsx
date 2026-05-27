"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

type AppHeaderProps = {
  onMenuClick: () => void;
};

const titles: Record<string, { title: string; subtitle: string }> = {
  "/app/dashboard": {
    title: "Home",
    subtitle:
      "Start with your account status, next actions, and recent activity.",
  },
  "/app/proposals": {
    title: "Proposals",
    subtitle: "Review the items that are active and ready for your attention.",
  },
  "/app/execute": {
    title: "Finalize",
    subtitle:
      "Track the items that are ready, or nearly ready, to move forward.",
  },
  "/app/history": {
    title: "History",
    subtitle: "Follow the most recent activity in a simple chronological view.",
  },
  "/app/settings": {
    title: "Settings",
    subtitle: "View account details, session status, and simple preferences.",
  },
};

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const pathname = usePathname();

  const routeMeta = useMemo(() => {
    if (pathname.startsWith("/app/proposals/")) {
      return {
        title: "Proposal",
        subtitle:
          "Review the current status, details, and timeline for this item.",
      };
    }

    return (
      titles[pathname] ?? {
        title: "GovBoard",
        subtitle:
          "A calmer workspace for reviewing and moving decisions forward.",
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
          <p className="app-header__eyebrow">GovBoard</p>
          <h1 className="app-header__title">{routeMeta.title}</h1>
          <p className="app-header__subtitle">{routeMeta.subtitle}</p>
        </div>
      </div>

      <div className="app-header__status" aria-label="Workspace status">
        <div className="top-status-chip">
          <span className="top-status-chip__label">Mode</span>
          <span className="top-status-chip__value">Preview</span>
        </div>
        <div className="top-status-chip">
          <span className="top-status-chip__label">Account</span>
          <span className="top-status-chip__value">Not connected</span>
        </div>
      </div>
    </header>
  );
}
