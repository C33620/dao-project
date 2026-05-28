"use client";

import type { ProposalSummary } from "@/types/governance";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HeroProposalCarouselProps = {
  proposals: ProposalSummary[];
};

function formatShortDate(value?: string) {
  if (!value) return "Date not available";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function HeroProposalCarousel({ proposals }: HeroProposalCarouselProps) {
  const items = useMemo(() => proposals.slice(0, 3), [proposals]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="landing-preview-card">
        <div className="landing-preview-card__header">
          <span>Latest vote</span>
          <strong>Unavailable</strong>
        </div>
        <div className="landing-preview-card__stats">
          <div>
            <small>No proposal found</small>
            <strong>—</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="proposal-carousel" aria-label="Latest voted proposals">
      <div className="proposal-carousel__viewport">
        {items.map((proposal, index) => {
          const offset = (index - activeIndex + items.length) % items.length;
          const position =
            offset === 0 ? "active" : offset === 1 ? "next" : "tail";

          const cardContent = (
            <>
              <p className="proposal-carousel__eyebrow">
                Latest voted proposal
              </p>
              <h3 className="proposal-carousel__title">{proposal.title}</h3>
              <p className="proposal-carousel__excerpt">{proposal.excerpt}</p>

              <dl className="proposal-carousel__meta proposal-carousel__meta--single">
                <div>
                  <dt>Voted date</dt>
                  <dd>{formatShortDate(proposal.votingEndsAt)}</dd>
                </div>
              </dl>
            </>
          );

          if (position === "active") {
            return (
              <Link
                key={proposal.id}
                href={`/app/proposals/${proposal.id}`}
                className={`proposal-carousel__card proposal-carousel__card--${position} proposal-carousel__card--interactive`}
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <article
              key={proposal.id}
              className={`proposal-carousel__card proposal-carousel__card--${position}`}
              aria-hidden="true"
            >
              {cardContent}
            </article>
          );
        })}
      </div>

      {items.length > 1 ? (
        <div className="proposal-carousel__dots" aria-hidden="true">
          {items.map((proposal, index) => (
            <button
              key={proposal.id}
              type="button"
              className={
                index === activeIndex
                  ? "proposal-carousel__dot is-active"
                  : "proposal-carousel__dot"
              }
              onClick={() => setActiveIndex(index)}
              aria-label={`Show proposal ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
