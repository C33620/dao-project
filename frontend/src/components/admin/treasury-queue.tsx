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
    case "GOVERNANCE_REBALANCE_TOPUP":
      return "Governance rebalance top-up";
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
    <div className="grid gap-5 mb-8">
      {feedback.type ? (
        <div
          className={
            feedback.type === "success"
              ? "inline-flex items-center gap-[0.45rem] min-h-7 px-[0.62rem] py-[0.32rem] rounded-full border text-[0.72rem] font-bold tracking-[0.01em] whitespace-nowrap text-(--success) bg-[#edf7f1] border-[#d5e9dc] fixed top-28 z-25 w-full sm:w-fit max-w-[min(100%,42rem)] mb-2"
              : "inline-flex items-center gap-[0.45rem] min-h-7 px-[0.62rem] py-[0.32rem] rounded-full border text-[0.72rem] font-bold tracking-[0.01em] whitespace-nowrap text-(--danger) bg-[#faedf1] border-[#efd6dd] fixed top-28 z-25 w-full sm:w-fit max-w-[min(100%,42rem)] mb-2"
          }
          role="status"
          aria-live="polite"
        >
          <span className="w-[0.42rem] h-[0.42rem] rounded-full bg-current opacity-[0.72] flex-none" />
          <span className="leading-[1.35] whitespace-normal">
            {feedback.message}
          </span>
        </div>
      ) : null}
      <section className="bg-white/88 border border-(--border) rounded-md shadow-(--shadow-sm) backdrop-blur-md mt-12">
        <div className="flex gap-4 items-start justify-between flex-wrap pt-[1.3rem] px-[1.3rem]">
          <div>
            <h2 className="m-0 text-[1.02rem] leading-[1.2] tracking-[-0.02em]">
              Pending
            </h2>
            <p className="mt-[0.4rem] mb-0 text-(--muted) text-[0.93rem] leading-[1.55] max-w-[58ch]">
              Copy the exact transfer details, send the transfer in MetaMask,
              then paste the transaction hash here.
            </p>
          </div>

          <span className="inline-flex items-center gap-[0.45rem] min-h-7 px-[0.62rem] py-[0.32rem] rounded-full border text-[0.72rem] font-bold tracking-[0.01em] whitespace-nowrap text-(--pending) bg-[#f3effb] border-[#e3d9f7]">
            <span className="w-[0.42rem] h-[0.42rem] rounded-full bg-current opacity-[0.72] flex-none" />
            <span className="leading-[1.35] whitespace-normal">
              {pendingItems.length} open
            </span>
          </span>
        </div>

        <div className="p-[1.3rem]">
          {pendingItems.length === 0 ? (
            <div className="grid place-items-center gap-[0.6rem] min-h-45 p-8 text-center bg-white/90 border border-dashed border-(--border-strong) rounded-md">
              <div className="w-12 h-12 grid place-items-center rounded-full bg-(--surface-subtle) text-(--muted-soft) text-[1.4rem]">
                ✓
              </div>
              <h2>No pending treasury items</h2>
              <p>
                All queued allocations and gas funding items have already been
                submitted or reconciled.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingItems.map((item) => {
                const formattedAmount = formatAmountBaseUnits(
                  item.amountBaseUnits,
                );

                return (
                  <article
                    key={item.id}
                    className="grid gap-4 p-4 rounded-2xl border border-(--border) bg-white/78"
                  >
                    <div className="flex justify-between items-start gap-4 flex-wrap">
                      <div className="min-w-0 flex-[1_1_320px]">
                        <p className="m-0 text-(--muted-soft) uppercase tracking-[0.08em] text-[0.72rem]">
                          {getKindLabel(item.kind)}
                        </p>
                        <h3 className="mt-[0.38rem] mb-0 text-[1.02rem] leading-[1.2] tracking-[-0.02em]">
                          {item.user.displayName || "Unnamed member"}
                        </h3>
                        <p className="mt-[0.4rem] mb-0 text-(--muted) text-[0.92rem] leading-[1.55] wrap-anywhere">
                          {item.user.email || "No email recorded"}
                        </p>
                      </div>

                      <span className={getStatusBadgeClass(item.status)}>
                        <span className="w-[0.42rem] h-[0.42rem] rounded-full bg-current opacity-[0.72] flex-none" />
                        <span className="leading-none">{item.status}</span>
                      </span>
                    </div>

                    <dl className="grid gap-[0.85rem] grid-cols-1 min-[900px]:grid-cols-2 m-0">
                      <div className="min-w-0">
                        <dt className="text-(--muted-soft) text-[0.76rem] uppercase tracking-[0.06em]">
                          Recipient
                        </dt>
                        <dd className="mt-1 font-bold tracking-[-0.01em] wrap-anywhere">
                          <ValueWithCopy
                            value={item.walletAddress}
                            label="recipient address"
                            onCopy={handleCopy}
                          />
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-(--muted-soft) text-[0.76rem] uppercase tracking-[0.06em]">
                          Amount
                        </dt>
                        <dd className="mt-1 font-bold tracking-[-0.01em] wrap-anywhere">
                          {formattedAmount}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-(--muted-soft) text-[0.76rem] uppercase tracking-[0.06em]">
                          Asset
                        </dt>
                        <dd className="mt-1 font-bold tracking-[-0.01em] wrap-anywhere">
                          {getAssetLabel(item)}
                        </dd>
                      </div>
                      <div>
                        <dt>Chain</dt>
                        <dd>{item.chainId}</dd>
                      </div>
                      {item.tokenAddress ? (
                        <div className="col-span-full min-w-0">
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

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap items-stretch pt-[0.15rem]">
                      <a
                        className="inline-flex min-h-11 items-center justify-center rounded-full px-[1.05rem] py-[0.78rem] border text-[0.94rem] font-bold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-160 ease hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 bg-white/88 border-(--border) text-(--foreground) hover:bg-(--surface) hover:border-(--border-strong) w-full sm:w-auto"
                        href={getSepoliaAddressUrl(item.walletAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open recipient
                      </a>

                      {item.tokenAddress ? (
                        <a
                          className="inline-flex min-h-11 items-center justify-center rounded-full px-[1.05rem] py-[0.78rem] border  text-[0.94rem] font-bold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-160 ease hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 bg-white/88 border-(--border) text-(--foreground) hover:bg-(--surface) hover:border-(--border-strong) w-full sm:w-auto"
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

                      <dl className="grid gap-[0.85rem] grid-cols-1 min-[900px]:grid-cols-2 m-0 treasury-row__meta--details">
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

                    <div className="grid gap-[0.9rem] grid-cols-1 items-stretch min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-end">
                      <label
                        className="grid gap-[0.45rem]"
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
                        className="inline-flex min-h-11 items-center justify-center rounded-full px-[1.05rem] py-[0.78rem] border border-transparent text-[0.94rem] font-bold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-160 ease hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 bg-(--primary) text-white shadow-(--shadow-sm) hover:bg-(--primary-strong) w-full sm:w-auto"
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

      <section className="bg-white/88 border border-(--border) rounded-md shadow-(--shadow-sm) backdrop-blur-md">
        <div className="flex gap-4 items-start justify-between flex-wrap pt-[1.3rem] px-[1.3rem]">
          <div>
            <h2 className="m-0 text-[1.02rem] leading-[1.2] tracking-[-0.02em]">
              Submitted
            </h2>
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
