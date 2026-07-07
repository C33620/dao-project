"use client";

import Link from "next/link";
import { useState } from "react";

export function LandingNav() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className="sticky top-0 z-60 w-full px-4 pt-[0.9rem] sm:px-[0.95rem] sm:pt-[0.9rem]">
      <div className="relative mx-auto flex w-full max-w-345 items-center justify-between gap-4 rounded-[1.35rem] border border-[rgba(229,231,235,0.82)] bg-[rgba(247,248,250,0.7)] px-[0.82rem] py-[0.72rem] shadow-(--shadow-sm) backdrop-blur-[18px] sm:px-[0.9rem] sm:py-[0.78rem] md:px-[0.95rem]">
        <Link
          href="/"
          aria-label="KyotoTech Meetup home"
          onClick={closeMenu}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block min-w-0">
            <strong className="block truncate whitespace-nowrap text-[1.04rem] leading-none tracking-[-0.04em] text-(--foreground) sm:text-[1.08rem] md:text-[1.18rem]">
              KyotoTech Meetup
            </strong>
          </span>
        </Link>

        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="landing-nav-links"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsOpen((value) => !value)}
          className="ml-auto inline-flex h-11 w-11 flex-none flex-col items-center justify-center gap-[0.24rem] rounded-full border border-(--border) bg-[rgba(255,255,255,0.88)] p-0 shadow-(--shadow-sm) md:hidden"
        >
          <span
            className={`h-0.5 w-4.5 rounded-full bg-(--foreground) transition duration-150 ${
              isOpen ? "translate-y-1.5 rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-4.5 rounded-full bg-(--foreground) transition duration-150 ${
              isOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-0.5 w-4.5 rounded-full bg-(--foreground) transition duration-150 ${
              isOpen ? "-translate-y-1.5 -rotate-45" : ""
            }`}
          />
        </button>

        <nav
          id="landing-nav-links"
          aria-label="Primary"
          className={`${
            isOpen ? "flex" : "hidden"
          } absolute left-0 right-0 top-[calc(100%+0.55rem)] w-full flex-col items-stretch rounded-[1.25rem] border border-[rgba(229,231,235,0.82)] bg-[rgba(247,248,250,0.96)] p-[0.85rem] shadow-(--shadow-md) backdrop-blur-[18px] md:static md:flex md:w-auto md:flex-row md:items-center md:gap-[0.8rem] md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0`}
        >
          <a
            href="#protocol"
            onClick={closeMenu}
            className="whitespace-nowrap rounded-full px-[0.7rem] py-[0.55rem] text-left text-[0.93rem] font-semibold text-(--muted) transition-colors duration-150 hover:bg-[rgba(255,255,255,0.72)] hover:text-(--foreground)"
          >
            How it works
          </a>

          <a
            href="#active-users"
            onClick={closeMenu}
            className="whitespace-nowrap rounded-full px-[0.7rem] py-[0.55rem] text-left text-[0.93rem] font-semibold text-(--muted) transition-colors duration-150 hover:bg-[rgba(255,255,255,0.72)] hover:text-(--foreground)"
          >
            Active users
          </a>

          <Link
            href="/app/dashboard"
            onClick={closeMenu}
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-full border border-transparent bg-(--primary) px-[1.6rem] py-[0.78rem] text-[1rem] font-bold tracking-[-0.01em] text-white! shadow-(--shadow-sm) transition duration-150 hover:-translate-y-px hover:bg-(--primary-strong) md:min-w-42"
          >
            Start
          </Link>
        </nav>
      </div>
    </header>
  );
}
