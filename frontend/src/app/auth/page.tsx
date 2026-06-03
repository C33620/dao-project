"use client";

import { Magic } from "magic-sdk";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type AuthMode = "existing" | "new";

let magicClient: Magic | null = null;

function getMagicClient() {
  if (!magicClient) {
    const publishableKey = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;

    if (!publishableKey) {
      throw new Error("Auth is not configured yet.");
    }

    magicClient = new Magic(publishableKey);
  }

  return magicClient;
}

async function waitForAuthenticatedSession(retries = 8, delayMs = 250) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const response = await fetch("/api/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();

      if (data?.authenticated) {
        return true;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("existing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [requiresInviteCode, setRequiresInviteCode] = useState<boolean | null>(
    null,
  );
  const [checkedEmail, setCheckedEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const title = useMemo(
    () => (mode === "existing" ? "Sign in" : "Create your account"),
    [mode],
  );

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      try {
        const response = await fetch("/api/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (!cancelled && data?.authenticated) {
          window.location.assign("/app/dashboard");
        }
      } catch {
        // ignore
      }
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const isNewUser = mode === "new";
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedInviteCode = inviteCode.trim();

    if (!normalizedEmail) {
      setStatus("error");
      setMessage("Email is required.");
      return;
    }

    if (isNewUser && !trimmedName) {
      setStatus("error");
      setMessage("Name is required for new accounts.");
      return;
    }

    try {
      const shouldRunPrecheck =
        !isNewUser ||
        requiresInviteCode === null ||
        checkedEmail !== normalizedEmail;

      if (shouldRunPrecheck) {
        const precheckResponse = await fetch("/api/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            action: "precheck",
            email: normalizedEmail,
            inviteCode: trimmedInviteCode,
            isNewUser,
          }),
        });

        const precheckData = await precheckResponse.json();

        if (isNewUser) {
          const inviteRequired = Boolean(precheckData.requiresInviteCode);
          setRequiresInviteCode(inviteRequired);
          setCheckedEmail(normalizedEmail);

          if (!precheckResponse.ok) {
            setStatus("error");
            setMessage(
              precheckData?.error ?? "We could not continue right now.",
            );
            return;
          }

          if (inviteRequired && !trimmedInviteCode) {
            setStatus("idle");
            setMessage("Enter your activation code to create your account.");
            return;
          }
        } else {
          setRequiresInviteCode(null);
          setCheckedEmail("");

          if (!precheckResponse.ok) {
            setStatus("error");
            setMessage(
              precheckData?.error ?? "We could not continue right now.",
            );
            return;
          }
        }
      }

      if (isNewUser && requiresInviteCode && !trimmedInviteCode) {
        setStatus("idle");
        setMessage("Enter your activation code to create your account.");
        return;
      }

      const magic = getMagicClient();

      const alreadyLoggedIn = await magic.user.isLoggedIn();

      if (alreadyLoggedIn) {
        await magic.user.logout();
      }

      await magic.auth.loginWithMagicLink({
        email: normalizedEmail,
        showUI: true,
      });

      const didToken = await magic.user.getIdToken();

      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "verify",
          didToken,
          email: normalizedEmail,
          name: isNewUser ? trimmedName : undefined,
          inviteCode: isNewUser ? trimmedInviteCode : undefined,
          isNewUser,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "We could not continue right now.");
      }

      const sessionReady = await waitForAuthenticatedSession();

      if (!sessionReady) {
        throw new Error(
          "Sign-in succeeded, but the session was not ready yet. Please try again.",
        );
      }

      setStatus("sent");
      setMessage(
        isNewUser ? "Account created successfully." : "Signed in successfully.",
      );

      router.refresh();
      window.location.assign("/app/dashboard");
    } catch (error) {
      console.error("AUTH_PAGE_ERROR", error);

      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not continue right now.",
      );
    }
  }

  const submitLabel = useMemo(() => {
    if (status === "submitting") {
      return mode === "existing" ? "Signing in..." : "Creating account...";
    }

    if (mode === "existing") {
      return "Sign in";
    }

    if (requiresInviteCode === true && !inviteCode.trim()) {
      return "Continue";
    }

    return "Create account";
  }, [status, mode, requiresInviteCode, inviteCode]);

  return (
    <main
      className="landing-page"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
      }}
    >
      <section
        className="landing-hero landing-hero--open"
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          padding: 0,
        }}
      >
        <div
          className="landing-hero__content"
          style={{
            width: "100%",
            maxWidth: 520,
            position: "relative",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 24,
            }}
          >
            <Link
              href="/"
              style={{
                fontSize: 14,
                color: "var(--color-text-muted, rgba(17,24,39,0.7))",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Back
            </Link>
          </div>

          <h1>{title}</h1>

          <p
            className="landing-hero__lede"
            style={{
              marginLeft: "auto",
              marginRight: "auto",
              maxWidth: 440,
            }}
          >
            Use your email to get a secure sign-in link and continue to the app.
          </p>

          <div
            style={{
              marginTop: 24,
              width: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              alignItems: "stretch",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode("existing");
                setMessage("");
                setInviteCode("");
                setRequiresInviteCode(null);
                setCheckedEmail("");
              }}
              aria-pressed={mode === "existing"}
              style={{
                minHeight: 48,
                width: "100%",
                padding: "0 14px",
                borderRadius: 999,
                border:
                  mode === "existing"
                    ? "1px solid rgba(15, 23, 42, 0.10)"
                    : "1px solid rgba(15, 23, 42, 0.08)",
                background:
                  mode === "existing"
                    ? "rgba(15, 23, 42, 0.06)"
                    : "rgba(255, 255, 255, 0.86)",
                color:
                  mode === "existing"
                    ? "rgba(15, 23, 42, 0.92)"
                    : "rgba(15, 23, 42, 0.68)",
                fontSize: 14,
                fontWeight: 500,
                whiteSpace: "nowrap",
                boxShadow:
                  mode === "existing"
                    ? "0 1px 2px rgba(15, 23, 42, 0.04)"
                    : "none",
              }}
            >
              I already have access
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("new");
                setMessage("");
                setStatus("idle");
              }}
              aria-pressed={mode === "new"}
              style={{
                minHeight: 48,
                width: "100%",
                padding: "0 14px",
                borderRadius: 999,
                border:
                  mode === "new"
                    ? "1px solid rgba(15, 23, 42, 0.10)"
                    : "1px solid rgba(15, 23, 42, 0.08)",
                background:
                  mode === "new"
                    ? "rgba(15, 23, 42, 0.06)"
                    : "rgba(255, 255, 255, 0.86)",
                color:
                  mode === "new"
                    ? "rgba(15, 23, 42, 0.92)"
                    : "rgba(15, 23, 42, 0.68)",
                fontSize: 14,
                fontWeight: 500,
                whiteSpace: "nowrap",
                boxShadow:
                  mode === "new" ? "0 1px 2px rgba(15, 23, 42, 0.04)" : "none",
              }}
            >
              I am new here
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gap: 16,
              marginTop: 28,
              width: "100%",
              textAlign: "left",
            }}
          >
            {mode === "new" ? (
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                  style={{
                    width: "100%",
                    minHeight: 52,
                    padding: "0 16px",
                    borderRadius: 14,
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    background: "rgba(255,255,255,0.92)",
                    outline: "none",
                    fontSize: 16,
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                  }}
                />
              </label>
            ) : null}

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  const nextEmail = event.target.value;
                  setEmail(nextEmail);

                  if (
                    checkedEmail &&
                    checkedEmail !== nextEmail.trim().toLowerCase()
                  ) {
                    setRequiresInviteCode(null);
                    setInviteCode("");
                    setCheckedEmail("");
                    setMessage("");
                    setStatus("idle");
                  }
                }}
                placeholder="name@example.com"
                required
                style={{
                  width: "100%",
                  minHeight: 52,
                  padding: "0 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  background: "rgba(255,255,255,0.92)",
                  outline: "none",
                  fontSize: 16,
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                }}
              />
            </label>

            {mode === "new" ? (
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  Activation code
                </span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(event) =>
                    setInviteCode(event.target.value.toUpperCase())
                  }
                  placeholder="Enter your activation code"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    minHeight: 52,
                    padding: "0 16px",
                    borderRadius: 14,
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    background: "rgba(255,255,255,0.92)",
                    outline: "none",
                    fontSize: 16,
                    textTransform: "uppercase",
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                  }}
                />
              </label>
            ) : null}

            {mode === "new" ? (
              <p
                style={{
                  marginTop: -4,
                  fontSize: 13,
                  color: "var(--color-text-muted, rgba(17,24,39,0.7))",
                }}
              >
                {requiresInviteCode === false
                  ? "No activation code is required for the first account."
                  : "The first account can be created without a code. Additional accounts require an activation code."}
              </p>
            ) : null}

            <div
              className="landing-hero__actions"
              style={{
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              <button
                type="submit"
                className="button button--primary landing-hero__cta"
                disabled={status === "submitting"}
                style={{ minWidth: 180 }}
              >
                {submitLabel}
              </button>
            </div>
          </form>

          {message ? (
            <p
              style={{
                marginTop: 16,
                textAlign: "center",
                color:
                  status === "error"
                    ? "rgb(185, 28, 28)"
                    : "var(--color-text-muted, rgba(17,24,39,0.75))",
              }}
              aria-live="polite"
            >
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
