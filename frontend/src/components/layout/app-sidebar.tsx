"use client";

import { appNav } from "@/config/nav";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className={cn("app-sidebar", open && "app-sidebar--open")}>
        <div className="app-sidebar__brand">
          <Link
            href="/"
            className="app-sidebar__logo"
            aria-label="Go to landing page"
          >
            <span className="app-sidebar__logo-mark" aria-hidden="true">
              ◧
            </span>
            <span>
              <strong>GovBoard</strong>
              <small>Clear decisions, calm workflow</small>
            </span>
          </Link>
        </div>

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

        <div className="app-sidebar__footer">
          <div className="sidebar-note">
            <p className="sidebar-note__eyebrow">Workspace note</p>
            <p className="sidebar-note__title">
              Start with the clearest next step.
            </p>
            <p className="sidebar-note__text">
              Review open items, follow recent activity, and keep the workflow
              easy to scan from any page.
            </p>
          </div>
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
