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
      <aside
        className={cn(
          "sticky top-0 h-dvh p-[1rem_1rem_1.2rem] bg-[rgba(249,250,251,0.88)] border-r border-(--border) flex flex-col gap-4 backdrop-blur-lg max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:z-40 max-lg:h-svh max-lg:w-[min(88vw,320px)] max-lg:-translate-x-full max-lg:transition-transform max-lg:duration-180 max-lg:ease-in-out max-lg:shadow-(--shadow-md)",
          open && "max-lg:translate-x-0",
        )}
      >
        <nav className="grid gap-[0.45rem]" aria-label="Primary navigation">
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
                className={cn(
                  "grid gap-[0.18rem] p-[0.9rem_0.95rem] rounded-[1.1rem] border border-transparent text-(--foreground) transition-[background-color,border-color,box-shadow,transform] duration-160 ease hover:bg-white/84 hover:border-(--border) hover:-translate-y-px",
                  isActive &&
                    "bg-(--surface) border-(--border-strong) shadow-(--shadow-sm)",
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={ariaLabel}
              >
                <div className="flex items-center justify-between gap-3 w-full">
                  <span className="font-bold text-[0.95rem] tracking-[-0.01em]">
                    {item.title}
                  </span>

                  {showAdminBadge ? (
                    <span
                      className="min-w-6 h-6 px-[0.4rem] inline-flex items-center justify-center rounded-full text-xs font-bold leading-none bg-(--color-notification,#a13544) text-white shrink-0 shadow-[0_0_0_2px_var(--color-surface,#fff)]"
                      aria-hidden="true"
                    >
                      {badgeLabel}
                    </span>
                  ) : null}
                </div>

                {item.description ? (
                  <span className="text-(--muted) text-[0.8rem] leading-[1.38]">
                    {item.description}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="hidden max-lg:block max-lg:mt-auto max-lg:pt-4 max-lg:border-t max-lg:border-[rgba(229,231,235,0.72)]">
          <button
            type="button"
            className="inline-flex items-center justify-center min-h-10.5 px-4 rounded-full border font-bold text-[0.92rem] leading-none transition-[background-color,border-color,color,box-shadow,transform] duration-160 ease cursor-pointer bg-[rgba(185,28,28,0.1)] text-[#b42318] border-[rgba(185,28,28,0.22)] hover:bg-[rgba(185,28,28,0.16)] hover:text-[#991b1b] hover:border-[rgba(185,28,28,0.28)] focus-visible:outline-2 focus-visible:outline-[rgba(185,28,28,0.45)] focus-visible:outline-offset-2 focus-visible:shadow-[0_0_0_4px_rgba(185,28,28,0.12)] w-full mb-[calc(1rem+env(safe-area-inset-bottom))]"
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
          className="hidden max-lg:block max-lg:fixed max-lg:inset-0 max-lg:z-30 max-lg:bg-[rgba(15,23,42,0.26)] max-lg:backdrop-blur-[3px]"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
    </>
  );
}
