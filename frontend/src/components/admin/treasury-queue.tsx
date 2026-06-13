"use client";

import { useEffect, useState } from "react";

type TreasuryQueueItem = {
  id: string;
  kind: string;
  status: "PENDING" | "FAILED_RETRYABLE" | "PAUSED" | "SUBMITTED" | string;
  walletAddress: string;
  amountBaseUnits: string;
  tokenAddress: string | null;
  chainId: number;
  txHash: string | null;
  submittedAt: string | Date | null;
  confirmedAt: string | Date | null;
  attemptCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    walletAddress: string | null;
    accountSetupStatus: string;
    accountSetupUpdatedAt: string | Date | null;
    initialAllocationStatus: string | null;
    initialAllocationTxHash: string | null;
  };
};

type TreasuryQueueProps = {
  initialPendingItems: TreasuryQueueItem[];
  initialSubmittedItems: TreasuryQueueItem[];
};

type FeedbackState = {
  type: "success" | "error" | null;
  message: string;
};

function formatDateTime(value: string | Date | null) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatAmountBaseUnits(value: string) {
  if (!/^\d+$/.test(value)) {
    return value;
  }

  const padded = value.padStart(19, "0");
  const whole = padded.slice(0, -18).replace(/^0+/, "") || "0";
  const fraction = padded.slice(-18).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "status-badge status-badge--info";
    case "FAILED_RETRYABLE":
      return "status-badge status-badge--danger";
    case "PAUSED":
      return "status-badge status-badge--warning";
    case "PENDING":
      return "status-badge status-badge--pending";
    default:
      return "status-badge status-badge--default";
  }
}

function getSepoliaAddressUrl(address: string) {
  return `https://sepolia.etherscan.io/address/${address}`;
}

function getSepoliaTxUrl(txHash: string) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

function getKindLabel(kind: string) {
  switch (kind) {
    case "INITIAL_ALLOCATION":
      return "Initial allocation";
    case "INITIAL_GAS_FUNDING":
      return "Initial gas funding";
    case "LOW_BALANCE_GAS_REFILL":
      return "Low balance gas refill";
    default:
      return kind.replaceAll("_", " ");
  }
}

function getAssetLabel(item: TreasuryQueueItem) {
  return item.tokenAddress ? "Token" : "Sepolia ETH";
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
    >
      <path d="M10 1.5a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 10 12.5H5A2.5 2.5 0 0 1 2.5 10V4A2.5 2.5 0 0 1 5 1.5h5Zm0 1H5A1.5 1.5 0 0 0 3.5 4v6A1.5 1.5 0 0 0 5 11.5h5A1.5 1.5 0 0 0 11.5 10V4A1.5 1.5 0 0 0 10 2.5Zm3 3a.5.5 0 0 1 .5.5V11A3.5 3.5 0 0 1 10 14.5H5a.5.5 0 0 1 0-1h5A2.5 2.5 0 0 0 12.5 11V6a.5.5 0 0 1 .5-.5Z" />
    </svg>
  );
}

function ValueWithCopy({
  value,
  label,
  onCopy,
}: {
  value: string;
  label: string;
  onCopy: (value: string, label: string) => void;
}) {
  return (
    <div className="treasury-copy-field">
      <span className="treasury-copy-field__value">{value}</span>
      <button
        type="button"
        className="treasury-copy-button"
        onClick={() => void onCopy(value, label)}
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
      >
        <CopyIcon />
      </button>
    </div>
  );
}

export function TreasuryQueue({
  initialPendingItems,
  initialSubmittedItems,
}: TreasuryQueueProps) {
  const [pendingItems, setPendingItems] = useState(initialPendingItems);
  const [submittedItems, setSubmittedItems] = useState(initialSubmittedItems);
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    type: null,
    message: "",
  });

  useEffect(() => {
    if (!feedback.type) return;

    const timeoutId = window.setTimeout(() => {
      setFeedback({ type: null, message: "" });
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [feedback.type, feedback.message]);

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({
        type: "success",
        message: `${label} copied.`,
      });
    } catch {
      setFeedback({
        type: "error",
        message: `Could not copy ${label.toLowerCase()}.`,
      });
    }
  }

  async function handleSubmit(distributionId: string) {
    const txHash = txHashes[distributionId]?.trim();

    if (!txHash) {
      setFeedback({
        type: "error",
        message: "Transaction hash is required before marking submitted.",
      });
      return;
    }

    setLoadingId(distributionId);
    setFeedback({ type: null, message: "" });

    try {
      const response = await fetch("/api/admin/treasury/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          distributionId,
          txHash,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not record treasury submission.");
      }

      const movedItem = pendingItems.find((item) => item.id === distributionId);

      if (movedItem) {
        const updatedItem: TreasuryQueueItem = {
          ...movedItem,
          status: data.item.status,
          txHash: data.item.txHash,
          submittedAt: data.item.submittedAt,
          updatedAt: data.item.updatedAt,
        };

        setPendingItems((current) =>
          current.filter((item) => item.id !== distributionId),
        );
        setSubmittedItems((current) => [updatedItem, ...current]);
      }

      setTxHashes((current) => ({ ...current, [distributionId]: "" }));
      setFeedback({
        type: "success",
        message: "Treasury transfer recorded as submitted.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not record treasury submission.",
      });
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReconcile() {
    setIsReconciling(true);
    setFeedback({ type: null, message: "" });

    try {
      const response = await fetch("/api/admin/treasury/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not reconcile treasury queue.");
      }

      setFeedback({
        type: "success",
        message:
          typeof data.summary?.processed === "number"
            ? `Reconciliation completed. Checked ${data.summary.processed} submitted item(s).`
            : "Reconciliation completed.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not reconcile treasury queue.",
      });
    } finally {
      setIsReconciling(false);
    }
  }

  return (
    <div className="treasury-queue">
      {feedback.type ? (
        <div
          className={
            feedback.type === "success"
              ? "status-badge status-badge--success treasury-page-feedback"
              : "status-badge status-badge--danger treasury-page-feedback"
          }
          role="status"
          aria-live="polite"
        >
          <span className="status-badge__dot" />
          <span className="status-badge__label">{feedback.message}</span>
        </div>
      ) : null}

      <section className="section-card section-card-1">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Pending</h2>
            <p className="section-card__description">
              Copy the exact transfer details, send the transfer in MetaMask,
              then paste the transaction hash here.
            </p>
          </div>

          <span className="status-badge status-badge--pending">
            <span className="status-badge__dot" />
            <span className="status-badge__label">
              {pendingItems.length} open
            </span>
          </span>
        </div>

        <div className="section-card__content">
          {pendingItems.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <div className="empty-state__icon">✓</div>
              <h2>No pending treasury items</h2>
              <p>
                All queued allocations and gas funding items have already been
                submitted or reconciled.
              </p>
            </div>
          ) : (
            <div className="treasury-queue__list">
              {pendingItems.map((item) => {
                const formattedAmount = formatAmountBaseUnits(
                  item.amountBaseUnits,
                );

                return (
                  <article key={item.id} className="treasury-row">
                    <div className="treasury-row__top">
                      <div className="treasury-row__identity">
                        <p className="treasury-row__eyebrow">
                          {getKindLabel(item.kind)}
                        </p>
                        <h3 className="treasury-row__title">
                          {item.user.displayName || "Unnamed member"}
                        </h3>
                        <p className="treasury-row__subtitle">
                          {item.user.email || "No email recorded"}
                        </p>
                      </div>

                      <span className={getStatusBadgeClass(item.status)}>
                        <span className="status-badge__dot" />
                        <span className="status-badge__label">
                          {item.status}
                        </span>
                      </span>
                    </div>

                    <dl className="treasury-row__meta">
                      <div>
                        <dt>Recipient</dt>
                        <dd>
                          <ValueWithCopy
                            value={item.walletAddress}
                            label="recipient address"
                            onCopy={handleCopy}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd>{formattedAmount}</dd>
                      </div>
                      <div>
                        <dt>Asset</dt>
                        <dd>{getAssetLabel(item)}</dd>
                      </div>
                      <div>
                        <dt>Chain</dt>
                        <dd>{item.chainId}</dd>
                      </div>
                      {item.tokenAddress ? (
                        <div className="treasury-row__meta--full">
                          <dt>Token address</dt>
                          <dd>
                            <ValueWithCopy
                              value={item.tokenAddress}
                              label="token address"
                              onCopy={handleCopy}
                            />
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="button-row treasury-row__utility-actions">
                      <a
                        className="button button--secondary"
                        href={getSepoliaAddressUrl(item.walletAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open recipient
                      </a>

                      {item.tokenAddress ? (
                        <a
                          className="button button--secondary"
                          href={getSepoliaAddressUrl(item.tokenAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open token
                        </a>
                      ) : null}
                    </div>

                    <details className="treasury-row__details">
                      <summary>Details</summary>

                      <dl className="treasury-row__meta treasury-row__meta--details">
                        <div>
                          <dt>Created</dt>
                          <dd>{formatDateTime(item.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatDateTime(item.updatedAt)}</dd>
                        </div>
                        <div>
                          <dt>Attempts</dt>
                          <dd>{item.attemptCount}</dd>
                        </div>
                        <div>
                          <dt>Account setup</dt>
                          <dd>{item.user.accountSetupStatus}</dd>
                        </div>
                      </dl>
                    </details>

                    <div className="treasury-row__submit">
                      <label
                        className="treasury-row__field"
                        htmlFor={`txHash-${item.id}`}
                      >
                        <span>Transaction hash</span>
                        <input
                          id={`txHash-${item.id}`}
                          type="text"
                          value={txHashes[item.id] ?? ""}
                          onChange={(event) =>
                            setTxHashes((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="0x..."
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>

                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => handleSubmit(item.id)}
                        disabled={loadingId === item.id}
                      >
                        {loadingId === item.id ? "Saving..." : "Mark submitted"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="section-card">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Submitted</h2>
            <p className="section-card__description">
              These transfers already have a transaction hash. Reconcile them to
              confirm on-chain success and complete setup.
            </p>
          </div>

          <div className="button-row">
            <span className="status-badge status-badge--info">
              <span className="status-badge__dot" />
              <span className="status-badge__label">
                {submittedItems.length} submitted
              </span>
            </span>

            <button
              type="button"
              className="button button--primary"
              onClick={handleReconcile}
              disabled={isReconciling || submittedItems.length === 0}
            >
              {isReconciling ? "Reconciling..." : "Reconcile now"}
            </button>
          </div>
        </div>

        <div className="section-card__content">
          {submittedItems.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <div className="empty-state__icon">↗</div>
              <h2>No submitted items yet</h2>
              <p>
                Submitted transfers will appear here after you record a
                transaction hash.
              </p>
            </div>
          ) : (
            <div className="treasury-queue__list">
              {submittedItems.map((item) => {
                const formattedAmount = formatAmountBaseUnits(
                  item.amountBaseUnits,
                );

                return (
                  <article key={item.id} className="treasury-row">
                    <div className="treasury-row__top">
                      <div className="treasury-row__identity">
                        <p className="treasury-row__eyebrow">
                          {getKindLabel(item.kind)}
                        </p>
                        <h3 className="treasury-row__title">
                          {item.user.displayName || "Unnamed member"}
                        </h3>
                        <p className="treasury-row__subtitle">
                          {item.user.email || "No email recorded"}
                        </p>
                      </div>

                      <span className={getStatusBadgeClass(item.status)}>
                        <span className="status-badge__dot" />
                        <span className="status-badge__label">
                          {item.status}
                        </span>
                      </span>
                    </div>

                    <dl className="treasury-row__meta">
                      <div>
                        <dt>Recipient</dt>
                        <dd>
                          <ValueWithCopy
                            value={item.walletAddress}
                            label="recipient address"
                            onCopy={handleCopy}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd>{formattedAmount}</dd>
                      </div>
                      <div>
                        <dt>Asset</dt>
                        <dd>{getAssetLabel(item)}</dd>
                      </div>
                      <div>
                        <dt>Submitted</dt>
                        <dd>{formatDateTime(item.submittedAt)}</dd>
                      </div>
                      <div className="treasury-row__meta--full">
                        <dt>Transaction hash</dt>
                        <dd>{item.txHash || "—"}</dd>
                      </div>
                      {item.tokenAddress ? (
                        <div className="treasury-row__meta--full">
                          <dt>Token address</dt>
                          <dd>
                            <ValueWithCopy
                              value={item.tokenAddress}
                              label="token address"
                              onCopy={handleCopy}
                            />
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="button-row treasury-row__utility-actions">
                      {item.txHash ? (
                        <a
                          className="button button--secondary"
                          href={getSepoliaTxUrl(item.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open transaction
                        </a>
                      ) : null}
                    </div>

                    <details className="treasury-row__details">
                      <summary>Details</summary>

                      <dl className="treasury-row__meta treasury-row__meta--details">
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatDateTime(item.updatedAt)}</dd>
                        </div>
                        <div>
                          <dt>Confirmed</dt>
                          <dd>{formatDateTime(item.confirmedAt)}</dd>
                        </div>
                        <div>
                          <dt>Chain</dt>
                          <dd>{item.chainId}</dd>
                        </div>
                      </dl>
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
