"use client";

import Link from "next/link";
import { useState } from "react";

export function LandingNav() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className="landing-nav-shell">
      <div className="landing-nav landing-nav--sticky landing-nav--full">
        <Link
          href="/"
          className="landing-nav__brand landing-nav__brand--text-only"
          aria-label="KyotoTech Meetup home"
          onClick={closeMenu}
        >
          <span className="landing-nav__brand-text">
            <strong>KyotoTech Meetup</strong>
          </span>
        </Link>

        <button
          type="button"
          className={
            isOpen
              ? "landing-nav__menu-button is-active"
              : "landing-nav__menu-button"
          }
          aria-expanded={isOpen}
          aria-controls="landing-nav-links"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="landing-nav-links"
          className={
            isOpen
              ? "landing-nav__links landing-nav__links--open"
              : "landing-nav__links"
          }
          aria-label="Primary"
        >
          <a href="#protocol" className="landing-nav__link" onClick={closeMenu}>
            How it works
          </a>
          <a
            href="#active-users"
            className="landing-nav__link"
            onClick={closeMenu}
          >
            Active users
          </a>
          <Link
            href="/app/dashboard"
            className="button button--primary landing-nav__cta"
            onClick={closeMenu}
          >
            Start
          </Link>
        </nav>
      </div>
    </header>
  );
}
