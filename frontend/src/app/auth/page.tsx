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
    <main className="grid min-h-dvh w-full items-center px-4 py-8">
      <section className="flex w-full justify-center">
        <div className="w-full max-w-130 text-center">
          <div className="mb-6 flex justify-end">
            <Link
              href="/"
              className="text-2xl font-medium text-(--color-text-muted,rgba(17,24,39,0.7)) no-underline mb-8"
            >
              Back
            </Link>
          </div>

          <h1 className="text-5xl md:text-8xl font-semibold text-wrap">
            {title}
          </h1>

          <p className="landing-hero__lede mx-auto max-w-110 ">
            Use your email to get a secure sign-in link and continue to the app.
          </p>

          <div className="mt-6 grid w-full grid-cols-2 gap-2 items-stretch">
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
              className={[
                "min-h-12 w-full whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium",
                mode === "existing"
                  ? "border border-[rgba(15,23,42,0.10)] bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.92)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  : "border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.86)] text-[rgba(15,23,42,0.68)] shadow-none",
              ].join(" ")}
            >
              I have access
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("new");
                setMessage("");
                setStatus("idle");
              }}
              aria-pressed={mode === "new"}
              className={[
                "min-h-12 w-full whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium",
                mode === "new"
                  ? "border border-[rgba(15,23,42,0.10)] bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.92)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  : "border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.86)] text-[rgba(15,23,42,0.68)] shadow-none",
              ].join(" ")}
            >
              I am new here
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-7 grid w-full gap-4 text-left"
          >
            {mode === "new" ? (
              <label className="grid gap-2">
                <span className="text-[14px] font-medium">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                  className="min-h-13 w-full rounded-[14px] border border-[rgba(15,23,42,0.12)] bg-[rgba(255,255,255,0.92)] px-4 text-[16px] outline-none shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                />
              </label>
            ) : null}

            <label className="grid gap-2">
              <span className="text-[14px] font-medium">Email</span>
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
                className="min-h-13 w-full rounded-[14px] border border-[rgba(15,23,42,0.12)] bg-[rgba(255,255,255,0.92)] px-4 text-[16px] outline-none shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              />
            </label>

            {mode === "new" ? (
              <label className="grid gap-2">
                <span className="text-[14px] font-medium">Activation code</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(event) =>
                    setInviteCode(event.target.value.toUpperCase())
                  }
                  placeholder="Enter your activation code"
                  autoComplete="off"
                  className="min-h-13 w-full rounded-[14px] border border-[rgba(15,23,42,0.12)] bg-[rgba(255,255,255,0.92)] px-4 text-[16px] uppercase outline-none shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                />
              </label>
            ) : null}

            {mode === "new" ? (
              <p className="mt-1 text-[13px] text-(--color-text-muted,rgba(17,24,39,0.7))">
                {requiresInviteCode === false
                  ? "No activation code is required for the first account."
                  : "You need an activation code to create an account."}
              </p>
            ) : null}

            <div className="landing-hero__actions mt-2 justify-center">
              <button
                type="submit"
                className="button button--primary landing-hero__cta min-w-45"
                disabled={status === "submitting"}
              >
                {submitLabel}
              </button>
            </div>
          </form>

          {message ? (
            <p
              className={
                status === "error"
                  ? "mt-4 text-center text-[rgb(185,28,28)]"
                  : "mt-4 text-center text-(--color-text-muted,rgba(17,24,39,0.75))"
              }
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
