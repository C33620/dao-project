import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatAddress } from "@/lib/utils/format";
import type {
  WalletGovernanceProfile,
  WalletGovernanceSummary,
} from "@/types/governance";

type WalletStatusProps = {
  wallet: WalletGovernanceProfile | WalletGovernanceSummary;
  compact?: boolean;
};

function isWalletGovernanceProfile(
  wallet: WalletGovernanceProfile | WalletGovernanceSummary,
): wallet is WalletGovernanceProfile {
  return "session" in wallet && "delegation" in wallet;
}

export function WalletStatus({ wallet, compact = false }: WalletStatusProps) {
  const isProfile = isWalletGovernanceProfile(wallet);

  const connectionLabel = isProfile
    ? wallet.session.connectionLabel
    : wallet.connectionLabel;

  const badgeLabel = isProfile ? wallet.session.connectionStatus : "preview";
  const badgeTone = isProfile
    ? wallet.session.connectionStatus === "connected"
      ? "success"
      : "warning"
    : "pending";

  const accountLabel = isProfile
    ? wallet.session.displayName ?? formatAddress(wallet.session.address)
    : "Preview account";

  const addressLabel = isProfile
    ? formatAddress(wallet.session.address)
    : formatAddress(wallet.address);

  const participationRate = wallet.participationRate;
  const lastAction = wallet.lastAction;

  const secondaryLabel = isProfile
    ? wallet.session.environmentLabel
    : "Preview access";

  const footerTitle = isProfile ? "Session note" : "Preview note";
  const footerBody = isProfile
    ? "Your session details are shown here before actions are enabled."
    : "This preview shows account and activity details before live access is enabled.";
  const ctaLabel = isProfile
    ? wallet.session.connectCtaLabel
    : "Unavailable in preview";

  return (
    <SectionCard
      title="Account"
      description="Your account status and recent participation details."
      className={
        compact ? "wallet-status wallet-status--compact" : "wallet-status"
      }
    >
      <div className="wallet-status__row">
        <div>
          <p className="wallet-status__label">Status</p>
          <p className="wallet-status__value">{connectionLabel}</p>
        </div>
        <StatusBadge label={badgeLabel} tone={badgeTone} />
      </div>

      <dl className="wallet-status__grid">
        <div>
          <dt>Name</dt>
          <dd>{accountLabel}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{secondaryLabel}</dd>
        </div>
        <div>
          <dt>Participation</dt>
          <dd>{participationRate}</dd>
        </div>
        <div>
          <dt>Recent activity</dt>
          <dd>{lastAction}</dd>
        </div>
        <div>
          <dt>Account reference</dt>
          <dd>{addressLabel}</dd>
        </div>
      </dl>

      <div className="wallet-status__row wallet-status__row--footer">
        <div>
          <p className="wallet-status__label">{footerTitle}</p>
          <p className="wallet-status__value">{footerBody}</p>
        </div>
        <button type="button" className="button button--secondary">
          {ctaLabel}
        </button>
      </div>
    </SectionCard>
  );
}
