"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
    title: "Voted",
    subtitle: "Follow the most recent voted proposals.",
  },
  "/app/admin/treasury": {
    title: "Admin",
    subtitle: "Treasury queues and operations.",
  },
  "/app/settings": {
    title: "Settings",
    subtitle: "View account details, session status, and simple preferences.",
  },
};

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        title: "Invitation code",
        subtitle: "Your shareable access code will appear here when available.",
      }
    );
  }, [pathname]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "sign-out" }),
      });

      router.replace("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

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
          <h1 className="app-header__title">{routeMeta.title}</h1>
          <p className="app-header__subtitle">{routeMeta.subtitle}</p>
        </div>
      </div>

      <div className="app-header__status" aria-label="Workspace status">
        <button
          type="button"
          className="top-status-button top-status-button--logout"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
