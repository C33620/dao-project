"use client";

import { getMagicClient } from "@/lib/auth/magic-client";
import type { UserProfile } from "@/types/user";
import { getAddress, type Eip1193Provider } from "ethers";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SettingsClientProps = {
  user: UserProfile;
};

type CloseStep =
  | "idle"
  | "preparing"
  | "ready_to_sign"
  | "signing"
  | "storing_authorization"
  | "executing"
  | "done"
  | "error"
  | "expired";

type PrepareResponse = {
  ok: boolean;
  error?: string;
  attemptKey?: string;
  walletAddress?: string;
  chainId?: number;
  expiresAt?: string;
  delegateContractAddress?: string;
  recipientAddress?: string;
  relayerAddress?: string | null;
  closeDeadline?: string | null;
  closeNonce?: string;
};

type StoreAuthorizationResponse = {
  ok: boolean;
  error?: string;
  stored?: boolean;
};

type ExecuteResponse = {
  ok: boolean;
  error?: string;
  redirectTo?: string;
};

type AuthorizationPayload = {
  chainId?: number | string;
  contractAddress?: string;
  nonce?: number | string;
  v?: number;
  r?: string;
  s?: string;
};

type CloseIntentPayload = {
  relayer: string;
  nonce: string;
  deadline: string;
  signature: string;
};

function getMagicEip1193Provider() {
  const magic = getMagicClient();
  return magic.rpcProvider as unknown as Eip1193Provider;
}

type AuthorizationRecord = Record<string, unknown>;

function getNestedRecord(
  value: AuthorizationRecord,
  key: string,
): AuthorizationRecord | undefined {
  const nested = value[key];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as AuthorizationRecord;
  }
  return undefined;
}

function normalizeAuthorization(raw: unknown): AuthorizationPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const record = raw as AuthorizationRecord;
  const nested = getNestedRecord(record, "authorization");

  const chainId = record.chainId ?? nested?.chainId ?? record.chain_id;
  const contractAddress =
    record.contractAddress ??
    record.address ??
    record.contract_address ??
    nested?.contractAddress ??
    nested?.address;
  const nonce = record.nonce ?? nested?.nonce;
  const v = record.v ?? record.yParity ?? nested?.v ?? nested?.yParity;
  const r = record.r ?? nested?.r;
  const s = record.s ?? nested?.s;

  return {
    chainId:
      typeof chainId === "number" || typeof chainId === "string"
        ? chainId
        : undefined,
    contractAddress:
      typeof contractAddress === "string" ? contractAddress : undefined,
    nonce:
      typeof nonce === "number" || typeof nonce === "string"
        ? nonce
        : undefined,
    v: typeof v === "number" ? v : undefined,
    r: typeof r === "string" ? r : undefined,
    s: typeof s === "string" ? s : undefined,
  };
}

async function signCloseIntent(input: {
  provider: Eip1193Provider;
  walletAddress: string;
  chainId: number;
  delegateContractAddress: string;
  relayerAddress: string;
  nonce: bigint;
  deadlineSeconds: bigint;
}) {
  const domain = {
    name: "CloseAccountDelegate",
    version: "1",
    chainId: input.chainId,
    verifyingContract: input.delegateContractAddress,
  };

  const types = {
    CloseAccount: [
      { name: "relayer", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const message = {
    relayer: input.relayerAddress,
    nonce: input.nonce.toString(),
    deadline: input.deadlineSeconds.toString(),
  };

  const typedData = {
    domain,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      ...types,
    },
    primaryType: "CloseAccount" as const,
    message,
  };

  const signature = (await input.provider.request?.({
    method: "eth_signTypedData_v4",
    params: [input.walletAddress, JSON.stringify(typedData)],
  })) as string | undefined;

  if (!signature || typeof signature !== "string") {
    throw new Error("Wallet did not return a close intent signature.");
  }

  return {
    signature,
    domain,
    message,
  };
}

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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const [closeStep, setCloseStep] = useState<CloseStep>("idle");
  const [closeError, setCloseError] = useState("");
  const [attemptKey, setAttemptKey] = useState<string | null>(null);
  const [attemptExpiresAt, setAttemptExpiresAt] = useState<string | null>(null);
  const [closeWalletAddress, setCloseWalletAddress] = useState<string | null>(
    user.walletAddress ?? null,
  );
  const [closeChainId, setCloseChainId] = useState<number | null>(null);
  const [delegateContractAddress, setDelegateContractAddress] = useState<
    string | null
  >(null);
  const [relayerAddress, setRelayerAddress] = useState<string | null>(null);
  const [closeDeadline, setCloseDeadline] = useState<string | null>(null);
  const [closeNonce, setCloseNonce] = useState<string | null>(null);

  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const canDelete = useMemo(() => {
    return deleteConfirmation.trim().toUpperCase() === "DELETE";
  }, [deleteConfirmation]);

  const isStepBusy =
    closeStep === "preparing" ||
    closeStep === "signing" ||
    closeStep === "storing_authorization" ||
    closeStep === "executing";

  const canDismissModal = !isStepBusy;

  const derivedDeleteMessage = useMemo(() => {
    if (closeStep === "error" && closeError) {
      return closeError;
    }

    if (closeStep === "expired") {
      return closeError || "This close attempt expired. Please try again.";
    }

    if (closeStep === "done") {
      return "Account closure completed. Redirecting...";
    }

    return deleteMessage;
  }, [closeStep, closeError, deleteMessage]);

  useEffect(() => {
    if (!isConfirmOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
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

  function resetCloseFlowState() {
    setDeleteMessage("");
    setCloseError("");
    setCloseStep("idle");
    setAttemptKey(null);
    setAttemptExpiresAt(null);
    setCloseChainId(null);
    setDelegateContractAddress(null);
    setRelayerAddress(null);
    setCloseDeadline(null);
    setCloseNonce(null);
    setCloseWalletAddress(user.walletAddress ?? null);
  }

  function openCloseModal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canDelete || isStepBusy) {
      return;
    }

    resetCloseFlowState();
    setIsConfirmOpen(true);
  }

  function handleCloseConfirm() {
    if (!canDismissModal) {
      return;
    }

    setIsConfirmOpen(false);
  }

  async function prepareCloseFlow() {
    setCloseError("");
    setDeleteMessage("Preparing account closure...");
    setCloseStep("preparing");

    try {
      const response = await fetch("/api/account/close/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: "DELETE",
        }),
      });

      const data = (await response.json()) as PrepareResponse;

      if (
        !response.ok ||
        !data.ok ||
        !data.attemptKey ||
        !data.delegateContractAddress ||
        !data.relayerAddress ||
        !data.closeDeadline
      ) {
        const message = data?.error ?? "We could not prepare account closure.";
        setCloseError(message);
        setDeleteMessage(message);
        setCloseStep(
          message.toLowerCase().includes("expired") ? "expired" : "error",
        );
        return;
      }

      setAttemptKey(data.attemptKey);
      setAttemptExpiresAt(data.expiresAt ?? null);
      setCloseWalletAddress(data.walletAddress ?? closeWalletAddress);
      setCloseChainId(data.chainId ?? null);
      setDelegateContractAddress(data.delegateContractAddress);
      setRelayerAddress(data.relayerAddress);
      setCloseDeadline(data.closeDeadline);
      setCloseNonce(data.closeNonce ?? "0");

      setDeleteMessage("Ready for wallet authorization.");
      setCloseStep("ready_to_sign");
    } catch {
      setCloseError("We could not prepare account closure.");
      setDeleteMessage("We could not prepare account closure.");
      setCloseStep("error");
    }
  }

  async function signAndSubmitAuthorization() {
    if (
      !attemptKey ||
      !delegateContractAddress ||
      !closeChainId ||
      !closeWalletAddress ||
      !relayerAddress ||
      !closeDeadline ||
      closeNonce == null
    ) {
      setCloseError("Missing close attempt details. Please start again.");
      setDeleteMessage("Missing close attempt details. Please start again.");
      setCloseStep("error");
      return;
    }

    try {
      setCloseError("");
      setDeleteMessage("Requesting wallet authorization...");
      setCloseStep("signing");

      const magic = getMagicClient();
      const provider = getMagicEip1193Provider();

      console.log(
        "eth_chainId",
        await provider.request?.({ method: "eth_chainId" }),
      );
      console.log(
        "wallet accounts",
        await provider.request?.({ method: "eth_accounts" }),
      );

      const rawAuthorization = await magic.wallet.sign7702Authorization({
        contractAddress: delegateContractAddress,
        chainId: closeChainId,
      });

      const authorization = normalizeAuthorization(rawAuthorization);

      if (
        authorization.chainId == null ||
        !authorization.contractAddress ||
        authorization.nonce == null ||
        authorization.v == null ||
        !authorization.r ||
        !authorization.s
      ) {
        throw new Error("Magic returned an incomplete authorization payload.");
      }

      const delegatedAccountAddress = getAddress(closeWalletAddress);
      const normalizedDelegateContractAddress = getAddress(
        delegateContractAddress,
      );
      const nonce = BigInt(closeNonce);

      const deadlineSeconds = BigInt(
        Math.floor(new Date(closeDeadline).getTime() / 1000),
      );

      if (deadlineSeconds <= BigInt(Math.floor(Date.now() / 1000))) {
        throw new Error("This close attempt expired. Please start again.");
      }

      setDeleteMessage("Requesting close intent signature...");

      const closeIntentSignatureResult = await signCloseIntent({
        provider,
        walletAddress: delegatedAccountAddress,
        chainId: closeChainId,
        delegateContractAddress: normalizedDelegateContractAddress,
        relayerAddress: getAddress(relayerAddress),
        nonce,
        deadlineSeconds,
      });

      const closeIntent: CloseIntentPayload = {
        relayer: getAddress(relayerAddress),
        nonce: nonce.toString(),
        deadline: deadlineSeconds.toString(),
        signature: closeIntentSignatureResult.signature,
      };

      console.log("close intent domain", closeIntentSignatureResult.domain);
      console.log("close intent message", closeIntentSignatureResult.message);
      console.log("close intent signature", closeIntent.signature);

      setDeleteMessage("Storing signed authorization...");
      setCloseStep("storing_authorization");

      const storeResponse = await fetch("/api/account/close/authorization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptKey,
          authorization,
          closeIntent,
        }),
      });

      const storeData =
        (await storeResponse.json()) as StoreAuthorizationResponse;

      if (!storeResponse.ok || !storeData.ok) {
        const message =
          storeData?.error ?? "We could not store the authorization.";
        setCloseError(message);
        setDeleteMessage(message);
        setCloseStep(
          message.toLowerCase().includes("expired") ? "expired" : "error",
        );
        return;
      }

      setDeleteMessage("Running account close flow...");
      setCloseStep("executing");

      const executeResponse = await fetch("/api/account/close/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptKey,
        }),
      });

      const executeData = (await executeResponse.json()) as ExecuteResponse;

      if (!executeResponse.ok || !executeData.ok) {
        const message =
          executeData?.error ?? "We could not execute account closure.";
        setCloseError(message);
        setDeleteMessage(message);
        setCloseStep(
          message.toLowerCase().includes("expired") ? "expired" : "error",
        );
        return;
      }

      setDeleteMessage("Account closure completed. Redirecting...");
      setCloseStep("done");

      window.setTimeout(() => {
        window.location.href = executeData.redirectTo || "/";
      }, 900);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not complete wallet authorization.";
      setCloseError(message);
      setDeleteMessage(message);
      setCloseStep(
        message.toLowerCase().includes("expired") ? "expired" : "error",
      );
    }
  }

  async function handlePrimaryCloseAction() {
    if (closeStep === "idle") {
      await prepareCloseFlow();
      return;
    }

    if (
      closeStep === "ready_to_sign" ||
      closeStep === "error" ||
      closeStep === "expired"
    ) {
      await signAndSubmitAuthorization();
    }
  }

  const modal =
    typeof document !== "undefined" && isConfirmOpen
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-dialog-title"
            aria-describedby="delete-account-dialog-description"
            onClick={() => {
              if (canDismissModal) {
                setIsConfirmOpen(false);
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999999,
              display: "grid",
              placeItems: "center",
              padding: 16,
              background: "rgba(15, 23, 42, 0.45)",
              pointerEvents: "auto",
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(100%, 640px)",
                background: "white",
                borderRadius: 20,
                boxShadow: "0 24px 64px rgba(15, 23, 42, 0.24)",
                pointerEvents: "auto",
                position: "relative",
                zIndex: 1000000,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 18,
                  padding: 24,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <h2
                    id="delete-account-dialog-title"
                    style={{ fontSize: 22, lineHeight: 1.2, margin: 0 }}
                  >
                    Close account
                  </h2>
                  <p
                    id="delete-account-dialog-description"
                    style={{ color: "rgba(15, 23, 42, 0.72)", margin: 0 }}
                  >
                    You&apos;ll need to complete a few steps to close your
                    account. This guided process helps verify your request and
                    ensures your account is closed securely.
                  </p>
                </div>

                <section
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 16,
                    borderRadius: 16,
                    background: "rgba(15, 23, 42, 0.04)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                  }}
                >
                  <p style={{ fontWeight: 600, margin: 0 }}>Current step</p>

                  <p style={{ color: "rgba(15, 23, 42, 0.72)", margin: 0 }}>
                    {closeStep === "idle" &&
                      "Review the close flow before continuing."}
                    {closeStep === "preparing" &&
                      "Preparing the account closure request."}
                    {closeStep === "ready_to_sign" &&
                      "Your account is ready. Continue to authorize account closure."}
                    {closeStep === "signing" &&
                      "Waiting for wallet authorization and signature."}
                    {closeStep === "storing_authorization" &&
                      "Saving account deletion request."}
                    {closeStep === "executing" && "Executing the close flow."}
                    {closeStep === "done" &&
                      "Account closure completed. Redirecting..."}
                    {closeStep === "error" &&
                      (closeError || "Something went wrong.")}
                    {closeStep === "expired" &&
                      "This close attempt expired. Please start again."}
                  </p>

                  {attemptExpiresAt ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(15, 23, 42, 0.56)",
                        margin: 0,
                      }}
                    >
                      Attempt expires at{" "}
                      {new Date(attemptExpiresAt).toLocaleString()}.
                    </p>
                  ) : null}
                </section>
              </div>

              <footer
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                  padding: "16px 24px 24px",
                  borderTop: "1px solid rgba(15, 23, 42, 0.08)",
                  background: "white",
                }}
              >
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={handleCloseConfirm}
                  disabled={!canDismissModal}
                  style={{
                    minHeight: 44,
                    padding: "0 16px",
                    borderRadius: 999,
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    background: "white",
                    color: "rgb(15, 23, 42)",
                    fontWeight: 600,
                    opacity: canDismissModal ? 1 : 0.7,
                  }}
                >
                  Cancel
                </button>

                {(closeStep === "idle" ||
                  closeStep === "ready_to_sign" ||
                  closeStep === "error" ||
                  closeStep === "expired") && (
                  <button
                    type="button"
                    onClick={() => {
                      void handlePrimaryCloseAction();
                    }}
                    disabled={isStepBusy}
                    style={{
                      minHeight: 44,
                      padding: "0 16px",
                      borderRadius: 999,
                      border: "none",
                      background: "rgb(185, 28, 28)",
                      color: "white",
                      fontWeight: 600,
                      opacity: isStepBusy ? 0.7 : 1,
                    }}
                  >
                    {closeStep === "idle" && "Continue"}
                    {closeStep === "ready_to_sign" && "Continue and close"}
                    {closeStep === "error" && "Retry"}
                    {closeStep === "expired" && "Start again"}
                  </button>
                )}
              </footer>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
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
                Deleting your account is permanent. Once your account is
                deleted, all associated data will be permanently removed and
                cannot be recovered.
              </p>
            </div>

            <form
              id="delete-form"
              style={{ display: "grid", gap: 16 }}
              onSubmit={openCloseModal}
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
                  onChange={(event) =>
                    setDeleteConfirmation(event.target.value)
                  }
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
                  disabled={!canDelete || isStepBusy}
                  style={{
                    minHeight: 44,
                    minWidth: 170,
                    padding: "0 16px",
                    borderRadius: 999,
                    border: "none",
                    background: "rgb(185, 28, 28)",
                    color: "white",
                    fontWeight: 600,
                    opacity: !canDelete || isStepBusy ? 0.5 : 1,
                  }}
                >
                  {isStepBusy ? "Closing account..." : "Delete account"}
                </button>
              </div>

              <p
                id="delete-message"
                aria-live="polite"
                style={{
                  minHeight: 24,
                  color:
                    closeStep === "done"
                      ? "rgb(21, 128, 61)"
                      : "rgb(153, 27, 27)",
                }}
              >
                {derivedDeleteMessage}
              </p>
            </form>
          </section>
        </div>
      </main>

      {modal}
    </>
  );
}
