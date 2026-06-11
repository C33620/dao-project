"use client";

import { appNav, type AppRole } from "@/config/nav";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type AppSidebarProps = {
  open: boolean;
  onClose: () => void;
  role: AppRole;
  adminPendingCount?: number;
};

export function AppSidebar({
  open,
  onClose,
  role,
  adminPendingCount = 0,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const visibleNav = useMemo(
    () => appNav.filter((item) => !item.roles || item.roles.includes(role)),
    [role],
  );

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
          {visibleNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            const isAdminItem = item.href === "/app/admin/treasury";
            const showAdminBadge = isAdminItem && adminPendingCount > 0;
            const badgeLabel =
              adminPendingCount > 99 ? "99+" : String(adminPendingCount);

            const ariaLabel = showAdminBadge
              ? `${item.title}, ${adminPendingCount} pending admin action${
                  adminPendingCount === 1 ? "" : "s"
                }`
              : undefined;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn("app-sidebar__link", isActive && "is-active")}
                aria-current={isActive ? "page" : undefined}
                aria-label={ariaLabel}
              >
                <div className="app-sidebar__link-row">
                  <span className="app-sidebar__link-title">{item.title}</span>

                  {showAdminBadge ? (
                    <span
                      className="app-sidebar__notification-badge"
                      aria-hidden="true"
                    >
                      {badgeLabel}
                    </span>
                  ) : null}
                </div>

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
