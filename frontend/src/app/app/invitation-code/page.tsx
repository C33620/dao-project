import { InvitationCodeCard } from "@/components/invites/invitation-code-card";
import { getCurrentUser } from "@/lib/auth";
import { getUserInviteCode } from "@/lib/invites/get-user-invite-code";

async function loadInvitationCodePageData() {
  try {
    const [user, invite] = await Promise.all([
      getCurrentUser(),
      getUserInviteCode(),
    ]);

    return {
      invite,
      isAdmin: user?.role === "admin",
    };
  } catch {
    return {
      invite: undefined,
      isAdmin: false,
    };
  }
}

export default async function InvitationCodePage() {
  const { invite, isAdmin } = await loadInvitationCodePageData();
  const hasLoadError = invite === undefined;

  return (
    <main className="grid gap-6 w-full max-w-310 mx-auto px-4 sm:px-[0.95rem] min-[900px]:px-6">
      <div className="grid gap-5">
        {hasLoadError ? (
          <section
            className="bg-white/88 border border-(--border) rounded-md shadow-(--shadow-sm) backdrop-blur-md"
            aria-live="polite"
          >
            <div className="p-[1.3rem]">
              <h2 className="m-0 text-[1.02rem] leading-[1.2] tracking-[-0.02em]">
                We couldn’t load your invitation code
              </h2>
              <p className="mt-[0.4rem] mb-0 text-(--muted) text-[0.93rem] leading-[1.55] max-w-[58ch]">
                Please try again in a moment.
              </p>
            </div>
          </section>
        ) : (
          <InvitationCodeCard invite={invite} isAdmin={isAdmin} />
        )}
      </div>
    </main>
  );
}
