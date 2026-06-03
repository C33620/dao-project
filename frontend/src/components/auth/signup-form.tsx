"use client";

import { useState } from "react";

type FormState = {
  error: string | null;
  success: string | null;
  loading: boolean;
};

export function SignupForm() {
  const [state, setState] = useState<FormState>({
    error: null,
    success: null,
    loading: false,
  });

  const [requiresInviteCode, setRequiresInviteCode] = useState<boolean | null>(
    null,
  );
  const [inviteCode, setInviteCode] = useState("");

  async function onSubmit(formData: FormData) {
    setState({ error: null, success: null, loading: true });

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
      setState({
        error: "Email is required.",
        success: null,
        loading: false,
      });
      return;
    }

    if (typeof window === "undefined") {
      setState({
        error: "This action is only available in the browser.",
        success: null,
        loading: false,
      });
      return;
    }

    const publishableKey = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setState({
        error: "Magic is not configured on the frontend.",
        success: null,
        loading: false,
      });
      return;
    }

    try {
      const precheckResponse = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "precheck",
          email,
          inviteCode,
          isNewUser: true,
        }),
      });

      const precheckData = await precheckResponse.json();

      setRequiresInviteCode(Boolean(precheckData.requiresInviteCode));

      if (!precheckResponse.ok) {
        setState({
          error: precheckData.error ?? "We couldn’t validate signup details.",
          success: null,
          loading: false,
        });
        return;
      }

      const { Magic } = await import("magic-sdk");
      const magic = new Magic(publishableKey);

      const didToken = await magic.auth.loginWithMagicLink({ email });

      const verifyResponse = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify",
          didToken,
          email,
          name,
          inviteCode,
          isNewUser: true,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setState({
          error: verifyData.error ?? "We couldn’t complete signup.",
          success: null,
          loading: false,
        });
        return;
      }

      setState({
        error: null,
        success: "Account created successfully.",
        loading: false,
      });

      window.location.href = "/app";
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : "Network error. Please try again.",
        success: null,
        loading: false,
      });
    }
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          className="w-full rounded-md border px-3 py-2"
          placeholder="Your name"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border px-3 py-2"
          placeholder="you@example.com"
        />
      </div>

      {requiresInviteCode ? (
        <div className="space-y-2">
          <label htmlFor="inviteCode" className="text-sm font-medium">
            Activation code
          </label>
          <input
            id="inviteCode"
            name="inviteCode"
            type="text"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            required
            className="w-full rounded-md border px-3 py-2 uppercase"
            placeholder="Enter your activation code"
          />
          <p className="text-xs text-muted-foreground">
            A single-use activation code is required to create this account.
          </p>
        </div>
      ) : requiresInviteCode === false ? (
        <p className="text-xs text-muted-foreground">
          No activation code is required for the first account.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          If this is not the first account, you will be asked for an activation
          code.
        </p>
      )}

      {state.error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state.loading}
        className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {state.loading ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
