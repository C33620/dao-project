import { countUsers } from "@/lib/repositories/users";
import { getRecentGovernanceActivity } from "@/lib/services/proposals";
import Link from "next/link";
import { HeroProposalCarousel } from "./components/hero-proposal-carousel";
import { LandingNav } from "./components/landing-nav";

export default async function LandingPage() {
  const latestVotedProposals = await await getRecentGovernanceActivity(
    "executed",
  );
  const activeUsersCount = await countUsers();

  return (
    <>
      <LandingNav />

      <main className="mx-auto flex w-full max-w-310 flex-col gap-12 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-12 grid min-h-[88svh] items-stretch gap-8 pt-6 sm:min-h-[92svh] sm:gap-10 sm:pt-8 lg:min-h-0 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pt-10">
          <div className="flex min-h-full flex-col justify-center gap-6 py-6 sm:py-8 lg:justify-center lg:py-0">
            <h1 className="max-w-[11ch] text-[clamp(3.4rem,10vw,5.8rem)] leading-[0.9] tracking-[-0.065em] text-(--foreground)">
              Let&apos;s decide together
            </h1>

            <p className="max-w-[32ch] text-[1.50rem] leading-8 text-(--muted) sm:text-[1.3rem] sm:leading-9 lg:max-w-[60ch] lg:text-2xl lg:leading-8">
              Share your ideas, give valuable votes, and make the community grow
              further.
            </p>

            <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/auth"
                className="inline-flex min-h-14 w-full items-center justify-center rounded-full border border-transparent bg-(--primary) px-8 py-3 text-lg lg:text-base font-bold tracking-[-0.01em] text-white! shadow-(--shadow-sm) transition duration-150 hover:-translate-y-px hover:bg-(--primary-strong) sm:w-auto sm:min-w-46"
              >
                Start
              </Link>
            </div>
          </div>

          <div className="grid items-stretch">
            <HeroProposalCarousel proposals={latestVotedProposals} />
          </div>
        </section>

        <section
          id="protocol"
          className="rounded-lg border border-(--border) bg-[rgba(255,255,255,0.9)] p-6 shadow-(--shadow-sm) sm:p-7 lg:p-8 mb-8"
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs uppercase tracking-[0.08em] text-(--muted-soft)">
              How it works
            </p>

            <h2 className="max-w-[18ch] text-[clamp(1.6rem,2vw,2.2rem)] leading-tight tracking-[-0.04em] text-(--foreground)">
              Three simple steps to move a decision forward.
            </h2>

            <p className="max-w-[64ch] leading-8 text-(--muted) text-1xl">
              KyotoTech Meetup keeps the process easy to understand so members
              can focus on the decision itself, not the interface around it.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-md border border-(--border) bg-(--surface-subtle) p-5">
              <h3 className="text-base tracking-[-0.02em] text-(--foreground)">
                1. Make a proposal
              </h3>
              <p className="mt-3 leading-7 text-(--muted)">
                Share an idea with clear context so everyone understands what is
                being suggested and why it matters.
              </p>
            </article>

            <article className="rounded-md border border-(--border) bg-(--surface-subtle) p-5">
              <h3 className="text-base tracking-[-0.02em] text-(--foreground)">
                2. Vote
              </h3>
              <p className="mt-3 leading-7 text-(--muted)">
                Members review the proposal, check the status, and cast their
                vote during the active decision window.
              </p>
            </article>

            <article className="rounded-md border border-(--border) bg-(--surface-subtle) p-5">
              <h3 className="text-base tracking-[-0.02em] text-(--foreground)">
                3. Validate
              </h3>
              <p className="mt-3 leading-7 text-(--muted)">
                Once the vote is complete, the result becomes clear and the next
                step can be confirmed with confidence.
              </p>
            </article>
          </div>
        </section>

        <section id="active-users" className="pt-2">
          <div className="grid gap-3 rounded-lg border border-(--border) bg-[rgba(255,255,255,0.9)] p-6 shadow-(--shadow-sm) sm:p-7">
            <p className="text-xs uppercase tracking-[0.08em] text-(--muted-soft)">
              Active users
            </p>

            <strong className="block text-[clamp(2.2rem,4vw,3.4rem)] leading-none tracking-tighter text-(--foreground)">
              {activeUsersCount}
            </strong>
          </div>
        </section>
      </main>
    </>
  );
}
