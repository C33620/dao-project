import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link
          href="/"
          className="landing-nav__brand"
          aria-label="GovBoard home"
        >
          <span className="landing-nav__mark" aria-hidden="true">
            ◧
          </span>
          <span className="landing-nav__brand-text">
            <strong>GovBoard</strong>
            <small>Clear decisions, calm workflow</small>
          </span>
        </Link>

        <nav className="landing-nav__links" aria-label="Primary">
          <a href="#how-it-works" className="landing-nav__link">
            How it works
          </a>
          <a href="#why-govboard" className="landing-nav__link">
            Why GovBoard
          </a>
          <Link href="/app/dashboard" className="button button--primary">
            Get the app
          </Link>
        </nav>
      </header>

      <section className="landing-hero landing-hero--open">
        <div className="landing-hero__content">
          <p className="landing-hero__eyebrow">
            A simpler way to move decisions forward
          </p>
          <h1>
            Review, track, and finalize important decisions in one calm
            workspace.
          </h1>
          <p className="landing-hero__lede">
            GovBoard helps teams stay on top of proposals, recent activity, and
            next steps without forcing every user to think like an operator.
          </p>

          <div className="landing-hero__actions">
            <Link href="/app/dashboard" className="button button--primary">
              Get the app
            </Link>
            <Link href="/app/proposals" className="button button--secondary">
              View proposals
            </Link>
          </div>
        </div>

        <div className="landing-hero__panel" aria-hidden="true">
          <div className="landing-preview-card">
            <div className="landing-preview-card__header">
              <span>Today</span>
              <strong>Focused</strong>
            </div>

            <div className="landing-preview-card__stats">
              <div>
                <small>Needs review</small>
                <strong>04</strong>
              </div>
              <div>
                <small>Recently completed</small>
                <strong>12</strong>
              </div>
              <div>
                <small>Ready soon</small>
                <strong>02</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="why-govboard">
        <div className="landing-section__intro">
          <p className="section-kicker">Why GovBoard</p>
          <h2>Built for clarity before complexity.</h2>
          <p>
            GovBoard gives people a cleaner way to review what matters now,
            understand progress at a glance, and move work forward with less
            friction.
          </p>
        </div>

        <div className="benefit-grid">
          <article className="benefit-card">
            <h3>Start with what matters</h3>
            <p>
              See the items that need attention first instead of sorting through
              a dense operations view.
            </p>
          </article>

          <article className="benefit-card">
            <h3>Keep progress readable</h3>
            <p>
              Follow recent activity, current status, and next steps in a layout
              that stays easy to scan.
            </p>
          </article>

          <article className="benefit-card">
            <h3>Work in one place</h3>
            <p>
              Move from review to follow-through in a single product surface
              designed to feel calm and credible.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div className="landing-section__intro">
          <p className="section-kicker">How it works</p>
          <h2>A lighter workflow for everyday use.</h2>
          <p>
            Open the app, review what needs your attention, check recent
            outcomes, and move the right items forward without digging through
            unnecessary noise.
          </p>
        </div>

        <div className="benefit-grid">
          <article className="benefit-card">
            <h3>1. Open your workspace</h3>
            <p>
              Start from a simple home view with your account status, recent
              activity, and next actions.
            </p>
          </article>

          <article className="benefit-card">
            <h3>2. Review key items</h3>
            <p>
              Focus on what needs a decision now, with details available when
              you need them.
            </p>
          </article>

          <article className="benefit-card">
            <h3>3. Keep things moving</h3>
            <p>
              Check what is ready next, follow progress clearly, and keep the
              process easy to understand.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="section-kicker">Get started</p>
          <h2>Open a cleaner interface for decisions and follow-through.</h2>
          <p>
            Explore the workspace to see a calmer, more readable product
            direction for review, progress tracking, and completion.
          </p>
        </div>

        <Link href="/app/dashboard" className="button button--primary">
          Get the app
        </Link>
      </section>
    </main>
  );
}
