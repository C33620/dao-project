"use client";

import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { GovernanceActivityItem } from "@/types/governance";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HeroProposalCarouselProps = {
  proposals: GovernanceActivityItem[];
};

const AUTO_ROTATE_MS = 3500;

export function HeroProposalCarousel({ proposals }: HeroProposalCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => proposals.slice(0, 3), [proposals]);

  useEffect(() => {
    if (items.length <= 1) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, AUTO_ROTATE_MS);

    return () => window.clearInterval(interval);
  }, [items.length]);

  const safeActiveIndex = items.length === 0 ? 0 : activeIndex % items.length;

  if (!items.length) {
    return (
      <div className="rounded-lg border border-(--border) bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fa_100%)] p-7 shadow-(--shadow-md)">
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(214,218,225,0.65)] pb-5">
          <span className="text-sm font-semibold text-(--muted-soft)">
            Latest vote
          </span>
          <strong className="text-sm font-semibold text-(--foreground)">
            Unavailable
          </strong>
        </div>

        <div className="pt-8">
          <small className="block text-[0.72rem] uppercase tracking-[0.08em] text-(--muted-soft)">
            No proposal found
          </small>
          <strong className="mt-3 block text-4xl leading-none tracking-tighter text---foreground)">
            —
          </strong>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4" aria-label="Latest voted proposals">
      <div className="relative min-h-105 [perspective-distant sm:min-h-110">
        {items.map((proposal, index) => {
          const offset =
            (index - safeActiveIndex + items.length) % items.length;
          const position =
            offset === 0 ? "active" : offset === 1 ? "next" : "tail";

          const baseCardClassName =
            "absolute inset-0 flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fa_100%)] p-6 text-inherit shadow-[var(--shadow-md)] transition-[transform,opacity,filter,box-shadow] duration-300 [transform-origin:center_center] sm:p-7";

          const positionClassName =
            position === "active"
              ? "z-30 opacity-100 [transform:translateY(0)_scale(1)_rotateX(0deg)] [filter:blur(0)]"
              : position === "next"
              ? "z-20 opacity-70 [transform:translateY(26px)_scale(0.96)_rotateX(-10deg)] [filter:blur(0.2px)]"
              : "z-10 opacity-40 [transform:translateY(52px)_scale(0.92)_rotateX(-16deg)] [filter:blur(0.4px)]";

          const categoryLabel = proposal.relatedProposalCategory
            ? getProposalCategoryLabel(proposal.relatedProposalCategory)
            : null;

          const cardContent = (
            <div className="flex h-full flex-col gap-4">
              <div className="grid gap-2">
                <p className="text-[0.72rem] uppercase tracking-[0.08em] text-(--muted-soft)">
                  Latest executed proposal
                </p>
                <h3 className="max-w-[18ch] text-3xl leading-[1.15] tracking-[-0.035em] text-(--foreground) ">
                  {proposal.title}
                </h3>
                <div className="mt-4">
                  <p className="text-[0.72rem] uppercase tracking-[0.08em] text-(--muted-soft)">
                    Category
                  </p>
                  {categoryLabel ? (
                    <p className="max-w-[18ch] text-lg leading-[1.15] tracking-[-0.035em] mt-2">
                      {categoryLabel}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-auto border-t border-[rgba(214,218,225,0.65)] pt-5">
                <div className="grid gap-1">
                  <span className="text-[0.7rem] uppercase tracking-[0.06em] text-(--muted-soft)">
                    Date
                  </span>
                  <span className="text-[0.96rem] font-bold tracking-[-0.01em] text-(--foreground)">
                    {proposal.occurredAt || "Unavailable"}
                  </span>
                </div>
              </div>
            </div>
          );

          if (position === "active") {
            return (
              <Link
                key={proposal.id}
                href="/app/history"
                className={`${baseCardClassName} ${positionClassName} hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.10),0_24px_60px_rgba(15,23,42,0.08)]`}
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <article
              key={proposal.id}
              className={`${baseCardClassName} ${positionClassName}`}
              aria-hidden="true"
            >
              {cardContent}
            </article>
          );
        })}
      </div>

      {items.length > 1 ? (
        <div
          className="flex items-center justify-center gap-[0.45rem]"
          aria-hidden="true"
        >
          {items.map((proposal, index) => (
            <button
              key={proposal.id}
              type="button"
              className={
                index === safeActiveIndex
                  ? "h-[0.7rem] w-[0.7rem] rounded-full border border-(--foreground) bg-(--foreground) p-0"
                  : "h-[0.7rem] w-[0.7rem] rounded-full border border-(--border-strong) bg-[rgba(255,255,255,0.72)] p-0"
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
