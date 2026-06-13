"use client";

import type { UserInviteCodeView } from "@/lib/invites/get-user-invite-code";
import { useRouter } from "next/navigation";
import { useState } from "react";

function getStatusVariant(status: NonNullable<UserInviteCodeView>["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "status-badge status-badge--success";
    case "REDEEMED":
      return "status-badge status-badge--default";
    case "EXPIRED":
      return "status-badge status-badge--warning";
    case "REVOKED":
      return "status-badge status-badge--danger";
    default:
      return "status-badge status-badge--default";
  }
}

function getStatusLabel(status: NonNullable<UserInviteCodeView>["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "Ready to share";
    case "REDEEMED":
      return "Redeemed";
    case "EXPIRED":
      return "Expired";
    case "REVOKED":
      return "Revoked";
    default:
      return status;
  }
}

function getStatusMessage(status: NonNullable<UserInviteCodeView>["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "Single-use code. Share it with one new member.";
    case "REDEEMED":
      return "This code has already been used and cannot be shared again.";
    case "EXPIRED":
      return "This code expired before it was used.";
    case "REVOKED":
      return "This code was revoked and is no longer valid.";
    default:
      return "Single-use code for one invited member.";
  }
}

function formatDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

type InvitationCodeCardProps = {
  invite: UserInviteCodeView;
  isAdmin?: boolean;
};

export function InvitationCodeCard({
  invite,
  isAdmin = false,
}: InvitationCodeCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleCopy() {
    if (!invite || invite.status !== "AVAILABLE") {
      return;
    }

    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function handleGenerateNewCode() {
    try {
      setIsGenerating(true);
      setGenerateError(null);

      const response = await fetch("/api/invitation-code/regenerate", {
        method: "POST",
        cache: "no-store",
      });

      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to generate a new invite code.");
      }

      router.refresh();
    } catch (error) {
      setGenerateError(
        error instanceof Error
          ? error.message
          : "Failed to generate a new invite code.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (!invite) {
    return (
      <section className="section-card">
        <div className="section-card__content">
          <div style={{ display: "grid", gap: "1rem" }}>
            <p className="section-card__description" style={{ margin: 0 }}>
              No active invitation code is available right now.
            </p>

            {isAdmin ? (
              <div
                style={{
                  display: "grid",
                  gap: "0.75rem",
                  justifyItems: "start",
                }}
              >
                <button
                  type="button"
                  onClick={handleGenerateNewCode}
                  disabled={isGenerating}
                  className="button button--primary"
                >
                  {isGenerating ? "Generating..." : "Generate new code"}
                </button>

                {generateError ? (
                  <p
                    className="section-card__description"
                    style={{ margin: 0, color: "var(--color-error)" }}
                  >
                    {generateError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const formattedDate = formatDate(invite.expiresAt);
  const canCopy = invite.status === "AVAILABLE";

  return (
    <section className="section-card">
      <div className="section-card__header">
        <span className={getStatusVariant(invite.status)}>
          <span className="status-badge__dot" aria-hidden="true" />
          <span className="status-badge__label">
            {getStatusLabel(invite.status)}
          </span>
        </span>
      </div>

      <div className="section-card__content">
        <div
          style={{
            display: "grid",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <code
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "clamp(1.1rem, 2vw, 1.5rem)",
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: "var(--foreground)",
                wordBreak: "break-word",
              }}
            >
              {invite.code}
            </code>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={handleCopy}
                disabled={!canCopy}
                className="button button--secondary"
              >
                {copied ? "Copied" : "Copy code"}
              </button>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleGenerateNewCode}
                  disabled={isGenerating}
                  className="button button--primary"
                >
                  {isGenerating ? "Generating..." : "Generate new code"}
                </button>
              ) : null}
            </div>
          </div>

          <p
            className="section-card__description"
            style={{ margin: 0, maxWidth: "none" }}
          >
            {getStatusMessage(invite.status)}
            {formattedDate ? ` Expires ${formattedDate}.` : ""}
          </p>

          {isAdmin ? (
            <p
              className="section-card__description"
              style={{ margin: 0, maxWidth: "none" }}
            >
              Generating a new code will revoke any other still-available code
              you created.
            </p>
          ) : null}

          {generateError ? (
            <p
              className="section-card__description"
              style={{ margin: 0, color: "var(--color-error)" }}
            >
              {generateError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
