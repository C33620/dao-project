import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";

export default function SettingsPage() {
  return (
    <PageShell
      title="Settings"
      description="View account details, session status, and a few simple preferences."
    >
      <div className="settings-stack">
        <SectionCard
          title="Account"
          description="Basic account information shown in this preview."
        >
          <div className="settings-list">
            <div className="settings-row settings-row--stacked">
              <div>
                <span>Name</span>
                <p className="settings-row__hint">
                  This name can be shown in the workspace once connected.
                </p>
              </div>
              <input type="text" value="Preview account" readOnly />
            </div>

            <div className="settings-row settings-row--stacked">
              <div>
                <span>Wallet status</span>
                <p className="settings-row__hint">
                  Connection is not active in the preview environment.
                </p>
              </div>
              <input type="text" value="Not connected" readOnly />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Preferences"
          description="A few interface defaults for this preview workspace."
        >
          <div className="settings-list">
            <label className="settings-row">
              <div>
                <span>Show recent activity first</span>
                <p className="settings-row__hint">
                  Keep the newest updates at the top of history views.
                </p>
              </div>
              <input type="checkbox" defaultChecked />
            </label>

            <label className="settings-row">
              <div>
                <span>Use compact status labels</span>
                <p className="settings-row__hint">
                  Reduce extra wording in badges and small status surfaces.
                </p>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Session"
          description="Actions related to sign-in and access state."
        >
          <div className="settings-actions">
            <button type="button" className="button button--primary">
              Sign in securely
            </button>
            <button type="button" className="button button--secondary">
              Sign out
            </button>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
