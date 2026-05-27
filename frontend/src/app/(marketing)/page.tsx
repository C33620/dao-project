import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero__content">
          <p className="landing-hero__eyebrow">
            Governance operations, clearly structured
          </p>
          <h1>Run DAO governance with a product-grade operating surface.</h1>
          <p className="landing-hero__lede">
            GovBoard gives delegates and contributors a focused place to review
            proposals, monitor voting context, and prepare execution steps
            without burying the protocol in noisy admin tooling.
          </p>

          <div className="landing-hero__actions">
            <Link href="/app/dashboard" className="button button--primary">
              Open dashboard
            </Link>
            <Link href="/app/proposals" className="button button--secondary">
              Browse proposals
            </Link>
          </div>
        </div>

        <div className="landing-hero__panel" aria-hidden="true">
          <div className="landing-preview-card">
            <div className="landing-preview-card__header">
              <span>Governance health</span>
              <strong>Stable</strong>
            </div>
            <div className="landing-preview-card__stats">
              <div>
                <small>Open proposals</small>
                <strong>04</strong>
              </div>
              <div>
                <small>Participation</small>
                <strong>78%</strong>
              </div>
              <div>
                <small>Queued actions</small>
                <strong>02</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__intro">
          <p className="section-kicker">What it does</p>
          <h2>A governance shell built for clarity before complexity.</h2>
          <p>
            This interface is designed to make proposal review, execution
            readiness, and protocol activity easier to scan today while staying
            implementation-friendly for real auth, wallet, and backend wiring
            later.
          </p>
        </div>

        <div className="benefit-grid">
          <article className="benefit-card">
            <h3>Clear proposal review</h3>
            <p>
              Consistent cards, detail views, metadata rows, and empty-safe
              states.
            </p>
          </article>
          <article className="benefit-card">
            <h3>Operator-friendly structure</h3>
            <p>
              Dashboard, history, execution, and settings use the same reusable
              layout system.
            </p>
          </article>
          <article className="benefit-card">
            <h3>Ready for real wiring</h3>
            <p>
              Mock-safe UI patterns now, predictable integration points later.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="section-kicker">Product preview</p>
          <h2>
            Move from placeholder scaffolding to a credible governance surface.
          </h2>
          <p>
            Enter the application shell to review dashboard structure, reusable
            proposal components, and execution-focused placeholder views.
          </p>
        </div>

        <Link href="/app/dashboard" className="button button--primary">
          Enter app workspace
        </Link>
      </section>
    </main>
  );
}
