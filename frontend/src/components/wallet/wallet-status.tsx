import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

type WalletStatusProps = {
  compact?: boolean;
};

export function WalletStatus({ compact = false }: WalletStatusProps) {
  return (
    <SectionCard
      title="Wallet status"
      description="Placeholder account state for the Phase 2 shell."
      className={
        compact ? "wallet-status wallet-status--compact" : "wallet-status"
      }
    >
      <div className="wallet-status__row">
        <div>
          <p className="wallet-status__label">Connection</p>
          <p className="wallet-status__value">Disconnected</p>
        </div>
        <StatusBadge label="Mock only" tone="pending" />
      </div>

      <dl className="wallet-status__grid">
        <div>
          <dt>Address</dt>
          <dd>0xA4F2...91C3</dd>
        </div>
        <div>
          <dt>Delegation</dt>
          <dd>Self delegated</dd>
        </div>
        <div>
          <dt>Voting power</dt>
          <dd>24,500 GOV</dd>
        </div>
        <div>
          <dt>Participation</dt>
          <dd>8 of 10 votes</dd>
        </div>
      </dl>
    </SectionCard>
  );
}
