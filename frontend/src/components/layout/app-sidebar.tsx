"use client";

import { appNav } from "@/config/nav";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type AppSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

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

      onClose();
      router.replace("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <aside className={cn("app-sidebar", open && "app-sidebar--open")}>
        <nav className="app-sidebar__nav" aria-label="Primary navigation">
          {appNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn("app-sidebar__link", isActive && "is-active")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="app-sidebar__link-title">{item.title}</span>

                {item.description ? (
                  <span className="app-sidebar__link-description">
                    {item.description}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar__mobile-actions">
          <button
            type="button"
            className="top-status-button top-status-button--logout app-sidebar__logout"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          className="app-sidebar__backdrop"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
    </>
  );
}
