export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Something went wrong.";
}

export function getNestedRpcMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  if (
    "error" in error &&
    error.error &&
    typeof error.error === "object" &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }

  if (
    "info" in error &&
    error.info &&
    typeof error.info === "object" &&
    "error" in error.info &&
    error.info.error &&
    typeof error.info.error === "object" &&
    "message" in error.info.error &&
    typeof error.info.error.message === "string"
  ) {
    return error.info.error.message;
  }

  return null;
}

export function normalizeSubmissionError(error: unknown): string {
  const directMessage = getErrorMessage(error).toLowerCase();
  const nestedMessage = getNestedRpcMessage(error)?.toLowerCase() ?? "";
  const combined = `${directMessage} ${nestedMessage}`;

  if (
    combined.includes("replacement fee too low") ||
    combined.includes("replacement transaction underpriced") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "REPLACEMENT_UNDERPRICED")
  ) {
    return "A previous wallet transaction appears to still be active in the provider. Please wait a moment and try again.";
  }

  if (combined.includes("gapped-nonce tx from delegated accounts")) {
    return "This wallet still has unresolved delegated-account transaction state. Please wait for the previous transaction to settle before trying again.";
  }

  if (
    combined.includes(
      "in-flight transaction limit reached for delegated accounts",
    )
  ) {
    return "This wallet already has an in-flight delegated transaction. Please wait for it to confirm before submitting another proposal.";
  }

  if (combined.includes("already has a pending transaction")) {
    return "This wallet already has a pending transaction. Please wait for it to confirm before submitting another proposal.";
  }

  if (combined.includes("user rejected") || combined.includes("user denied")) {
    return "The wallet confirmation was cancelled.";
  }

  if (combined.includes("insufficient funds")) {
    return getErrorMessage(error);
  }

  return getErrorMessage(error);
}

export function getRpcErrorData(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("data" in error && typeof error.data === "string") {
    return error.data;
  }

  if (
    "info" in error &&
    error.info &&
    typeof error.info === "object" &&
    "error" in error.info &&
    error.info.error &&
    typeof error.info.error === "object" &&
    "data" in error.info.error &&
    typeof error.info.error.data === "string"
  ) {
    return error.info.error.data;
  }

  return null;
}
