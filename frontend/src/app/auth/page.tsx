"use client";

import { Magic } from "magic-sdk";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type AuthMode = "existing" | "new";

let magicClient: Magic | null = null;
let pendingSignupName = "";
let pendingSignupEmail = "";

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

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("existing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const title = useMemo(
    () => (mode === "existing" ? "Sign in" : "Create your account"),
    [mode],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const isNewUser = mode === "new";
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

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

    if (isNewUser) {
      pendingSignupName = trimmedName;
      pendingSignupEmail = normalizedEmail;
    } else {
      pendingSignupName = "";
      pendingSignupEmail = "";
    }

    try {
      const precheckResponse = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "precheck",
          email: normalizedEmail,
          isNewUser,
        }),
      });

      const precheckData = await precheckResponse.json();

      console.log("AUTH_PRECHECK_RESPONSE", precheckData);

      if (!precheckResponse.ok) {
        throw new Error(
          precheckData?.error ?? "We could not continue right now.",
        );
      }

      const magic = getMagicClient();

      console.log("AUTH_SUBMIT_PAYLOAD", {
        mode,
        isNewUser,
        name: isNewUser ? trimmedName : undefined,
        email: normalizedEmail,
      });

      const alreadyLoggedIn = await magic.user.isLoggedIn();

      console.log("MAGIC_IS_LOGGED_IN", alreadyLoggedIn);

      if (alreadyLoggedIn) {
        console.log("MAGIC_LOGOUT_BEFORE_LOGIN");
        await magic.user.logout();
      }

      console.log("MAGIC_LOGIN_START", {
        email: normalizedEmail,
        showUI: true,
      });

      await magic.auth.loginWithMagicLink({
        email: normalizedEmail,
        showUI: true,
      });

      console.log("MAGIC_LOGIN_DONE");

      const didToken = await magic.user.getIdToken();

      const verifyName =
        isNewUser && pendingSignupEmail === normalizedEmail
          ? pendingSignupName
          : undefined;

      console.log("AUTH_VERIFY_REQUEST_BODY", {
        action: "verify",
        email: normalizedEmail,
        name: verifyName,
        isNewUser,
      });

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
          name: verifyName,
          isNewUser,
        }),
      });

      const data = await response.json();

      console.log("AUTH_RESPONSE", data);

      if (!response.ok) {
        throw new Error(data?.error ?? "We could not continue right now.");
      }

      pendingSignupName = "";
      pendingSignupEmail = "";

      setStatus("sent");
      setMessage("Signed in successfully.");
      router.replace("/app/dashboard");
      router.refresh();
    } catch (error) {
      console.error("AUTH_PAGE_ERROR", error);

      pendingSignupName = "";
      pendingSignupEmail = "";

      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not continue right now.",
      );
    }
  }

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
              onClick={() => setMode("existing")}
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
              onClick={() => setMode("new")}
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
                onChange={(event) => setEmail(event.target.value)}
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
                {status === "submitting" ? "Signing in..." : "Continue"}
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
