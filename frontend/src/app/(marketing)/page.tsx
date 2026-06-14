import { countUsers } from "@/lib/repositories/users";
import { getProposals } from "@/lib/services/proposals";
import Link from "next/link";
import { HeroProposalCarousel } from "./components/hero-proposal-carousel";
import { LandingNav } from "./components/landing-nav";

function isCompletedVoteStatus(status: string) {
  return status === "succeeded" || status === "queued" || status === "executed";
}

function getLatestVotedProposals<
  T extends {
    status: string;
    votingEndsAt?: string;
    createdAt: string;
  },
>(proposals: T[]): T[] {
  const completed = proposals
    .filter((proposal) => isCompletedVoteStatus(proposal.status))
    .sort((a, b) => {
      const aTime = a.votingEndsAt ? new Date(a.votingEndsAt).getTime() : 0;
      const bTime = b.votingEndsAt ? new Date(b.votingEndsAt).getTime() : 0;
      return bTime - aTime;
    });

  if (completed.length >= 3) {
    return completed.slice(0, 3);
  }

  if (completed.length > 0) {
    return completed;
  }

  return [...proposals]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 3);
}

export default async function LandingPage() {
  const proposals = await getProposals("executed");
  const latestVotedProposals = getLatestVotedProposals(proposals);
  const activeUsersCount = await countUsers();

  return (
    <>
      <LandingNav />

      <main className="landing-page landing-page--with-sticky-nav">
        <section className="landing-hero landing-hero--open landing-hero--decision">
          <div className="landing-hero__content">
            <h1>Let&apos;s decide together</h1>
            <p className="landing-hero__lede">
              Follow the latest proposal, understand what is being decided, and
              move from idea to vote in one readable interface.
            </p>

            <div className="landing-hero__actions">
              <Link
                href="/auth"
                className="button button--primary landing-hero__cta"
              >
                Start
              </Link>
            </div>
          </div>

          <div className="landing-hero__panel">
            <HeroProposalCarousel proposals={latestVotedProposals} />
          </div>
        </section>

        <section className="landing-section" id="protocol">
          <div className="landing-section__intro">
            <p className="section-kicker">How it works</p>
            <h2>Three simple steps to move a decision forward.</h2>
            <p>
              KyotoTech Meetup keeps the process easy to understand so members
              can focus on the decision itself, not the interface around it.
            </p>
          </div>

          <div className="benefit-grid">
            <article className="benefit-card">
              <h3>1. Make a proposal</h3>
              <p>
                Share an idea with clear context so everyone understands what is
                being suggested and why it matters.
              </p>
            </article>

            <article className="benefit-card">
              <h3>2. Vote</h3>
              <p>
                Members review the proposal, check the status, and cast their
                vote during the active decision window.
              </p>
            </article>

            <article className="benefit-card">
              <h3>3. Validate</h3>
              <p>
                Once the vote is complete, the result becomes clear and the next
                step can be confirmed with confidence.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-section" id="active-users">
          <div className="landing-metric-card">
            <p className="landing-metric-card__label">Active users</p>
            <strong className="landing-metric-card__value">
              {activeUsersCount}
            </strong>
          </div>
        </section>
      </main>
    </>
  );
}
