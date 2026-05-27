import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";

export default function SettingsPage() {
  return (
    <PageShell
      title="Settings"
      description="Read-only placeholder settings designed for future auth and preference wiring."
    >
      <div className="settings-layout">
        <SectionCard
          title="Profile and account"
          description="Account state preview only."
        >
          <dl className="key-value-grid">
            <div>
              <dt>Display name</dt>
              <dd>Delegate Preview</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>pending-auth@example.com</dd>
            </div>
            <div>
              <dt>Access mode</dt>
              <dd>Mock-safe local shell</dd>
            </div>
            <div>
              <dt>Wallet link</dt>
              <dd>Not connected</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="App preferences"
          description="Read-only UI controls for later wiring."
        >
          <div className="settings-list">
            <label className="settings-row">
              <span>Compact proposal cards</span>
              <input type="checkbox" checked readOnly />
            </label>
            <label className="settings-row">
              <span>Show activity summaries</span>
              <input type="checkbox" checked readOnly />
            </label>
            <label className="settings-row">
              <span>Enable desktop alerts</span>
              <input type="checkbox" readOnly />
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Governance preferences"
          description="Future-facing participation settings."
        >
          <div className="settings-list">
            <label className="settings-row">
              <span>Default vote mode</span>
              <input type="text" value="Manual review" readOnly />
            </label>
            <label className="settings-row">
              <span>Proposal digest cadence</span>
              <input type="text" value="Weekly summary" readOnly />
            </label>
            <label className="settings-row">
              <span>Execution readiness alerts</span>
              <input
                type="text"
                value="Enabled for queued proposals"
                readOnly
              />
            </label>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
