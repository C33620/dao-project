"use client";

import type { UserProfile } from "@/types/user";
import { useEffect, useMemo, useRef, useState } from "react";

type SettingsClientProps = {
  user: UserProfile;
};

export default function SettingsClient({ user }: SettingsClientProps) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageColor, setProfileMessageColor] = useState(
    "rgba(15, 23, 42, 0.72)",
  );
  const [isSaving, setIsSaving] = useState(false);

  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const confirmDialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const canDelete = useMemo(() => {
    return deleteConfirmation.trim().toUpperCase() === "DELETE";
  }, [deleteConfirmation]);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) {
      return;
    }

    if (isConfirmOpen && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 0);
      return;
    }

    if (!isConfirmOpen && dialog.open) {
      dialog.close();
    }
  }, [isConfirmOpen]);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setProfileMessage("Saving...");
    setProfileMessageColor("rgba(15, 23, 42, 0.72)");

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setProfileMessage(data?.error ?? "We could not update your profile.");
        setProfileMessageColor("rgb(185, 28, 28)");
        return;
      }

      setProfileMessage(data?.message ?? "Profile updated.");
      setProfileMessageColor("rgba(15, 23, 42, 0.72)");
    } catch {
      setProfileMessage("We could not update your profile.");
      setProfileMessageColor("rgb(185, 28, 28)");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canDelete || isDeleting) {
      return;
    }

    setDeleteMessage("");
    setIsConfirmOpen(true);
  }

  function handleCloseConfirm() {
    if (isDeleting) {
      return;
    }

    setIsConfirmOpen(false);
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setDeleteMessage("Deleting...");

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteMessage(data?.error ?? "We could not delete your account.");
        setIsDeleting(false);
        setIsConfirmOpen(false);
        return;
      }

      window.location.href = data?.redirectTo ?? "/";
    } catch {
      setDeleteMessage("We could not delete your account.");
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "32px 16px 64px",
        background: "var(--color-bg, #f8fafc)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <section
          style={{
            background: "white",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, lineHeight: 1.2 }}>Profile</h2>
            <p style={{ color: "rgba(15, 23, 42, 0.72)" }}>
              Update your account name and email.
            </p>
          </div>

          <form
            id="profile-form"
            style={{ display: "grid", gap: 16 }}
            onSubmit={handleProfileSubmit}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Display name
              </span>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                style={{
                  minHeight: 48,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  background: "white",
                  fontSize: 16,
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Email</span>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={{
                  minHeight: 48,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  background: "white",
                  fontSize: 16,
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  minHeight: 44,
                  minWidth: 150,
                  padding: "0 16px",
                  borderRadius: 999,
                  border: "none",
                  background: "rgb(15, 23, 42)",
                  color: "white",
                  fontWeight: 600,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>

            <p
              id="profile-message"
              aria-live="polite"
              style={{ minHeight: 24, color: profileMessageColor }}
            >
              {profileMessage}
            </p>
          </form>
        </section>

        <section
          style={{
            background: "white",
            border: "1px solid rgba(239, 68, 68, 0.24)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, lineHeight: 1.2 }}>Danger zone</h2>
            <p style={{ color: "rgb(153, 27, 27)" }}>
              Deleting your account is permanent. This action cannot be undone.
            </p>
          </div>

          <form
            id="delete-form"
            style={{ display: "grid", gap: 16 }}
            onSubmit={handleDeleteSubmit}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Type DELETE to confirm
              </span>
              <input
                id="deleteConfirmation"
                name="deleteConfirmation"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                style={{
                  minHeight: 48,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(239, 68, 68, 0.32)",
                  background: "white",
                  fontSize: 16,
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button
                id="delete-button"
                type="submit"
                disabled={!canDelete || isDeleting}
                style={{
                  minHeight: 44,
                  minWidth: 170,
                  padding: "0 16px",
                  borderRadius: 999,
                  border: "none",
                  background: "rgb(185, 28, 28)",
                  color: "white",
                  fontWeight: 600,
                  opacity: !canDelete || isDeleting ? 0.5 : 1,
                }}
              >
                {isDeleting ? "Deleting..." : "Delete account"}
              </button>
            </div>

            <p
              id="delete-message"
              aria-live="polite"
              style={{ minHeight: 24, color: "rgb(153, 27, 27)" }}
            >
              {deleteMessage}
            </p>
          </form>
        </section>
      </div>

      <dialog
        ref={confirmDialogRef}
        onClose={() => setIsConfirmOpen(false)}
        aria-labelledby="delete-account-dialog-title"
        aria-describedby="delete-account-dialog-description"
        style={{
          width: "min(100%, 480px)",
          padding: 0,
          border: "none",
          borderRadius: 20,
          boxShadow: "0 24px 64px rgba(15, 23, 42, 0.24)",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            padding: 24,
            background: "white",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <h2
              id="delete-account-dialog-title"
              style={{ fontSize: 22, lineHeight: 1.2 }}
            >
              Are you sure?
            </h2>
            <p
              id="delete-account-dialog-description"
              style={{ color: "rgba(15, 23, 42, 0.72)" }}
            >
              This will permanently delete your account and remove your access.
              This action cannot be undone.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={handleCloseConfirm}
              disabled={isDeleting}
              style={{
                minHeight: 44,
                padding: "0 16px",
                borderRadius: 999,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "white",
                color: "rgb(15, 23, 42)",
                fontWeight: 600,
                opacity: isDeleting ? 0.7 : 1,
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              style={{
                minHeight: 44,
                padding: "0 16px",
                borderRadius: 999,
                border: "none",
                background: "rgb(185, 28, 28)",
                color: "white",
                fontWeight: 600,
                opacity: isDeleting ? 0.7 : 1,
              }}
            >
              {isDeleting ? "Deleting..." : "Yes, delete account"}
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
