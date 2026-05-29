import { InvitationCodeCard } from "@/components/invites/invitation-code-card";
import { getUserInviteCode } from "@/lib/invites/get-user-invite-code";

async function loadInviteCode() {
  try {
    return await getUserInviteCode();
  } catch {
    return undefined;
  }
}

export default async function InvitationCodePage() {
  const invite = await loadInviteCode();
  const hasLoadError = invite === undefined;

  return (
    <main className="page-shell">
      <div className="page-shell__content">
        {hasLoadError ? (
          <section className="section-card" aria-live="polite">
            <div className="section-card__content">
              <h2 className="section-card__title">
                We couldn’t load your invitation code
              </h2>
              <p className="section-card__description">
                Please try again in a moment.
              </p>
            </div>
          </section>
        ) : (
          <InvitationCodeCard invite={invite} />
        )}
      </div>
    </main>
  );
}
