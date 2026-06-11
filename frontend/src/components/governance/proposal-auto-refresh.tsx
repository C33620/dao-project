"use client";

import type { ProposalStatus } from "@/types/governance";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type ProposalAutoRefreshProps = {
  status: ProposalStatus;
  hasVoted: boolean;
};

function shouldPoll(status: ProposalStatus) {
  return status === "pending" || status === "active" || status === "queued";
}

async function revalidateGovernanceCache() {
  try {
    await fetch("/api/revalidate-governance", {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    // no-op: refresh still gives us fresh proposal detail data
  }
}

export function ProposalAutoRefresh({
  status,
  hasVoted,
}: ProposalAutoRefreshProps) {
  const router = useRouter();
  const lastSeenStatus = useRef(status);
  const lastSeenHasVoted = useRef(hasVoted);
  const refreshInFlight = useRef(false);

  useEffect(() => {
    lastSeenStatus.current = status;
    lastSeenHasVoted.current = hasVoted;
  }, [status, hasVoted]);

  useEffect(() => {
    const onFocus = async () => {
      if (document.visibilityState !== "visible" || refreshInFlight.current) {
        return;
      }

      refreshInFlight.current = true;

      try {
        await revalidateGovernanceCache();
        router.refresh();
      } finally {
        window.setTimeout(() => {
          refreshInFlight.current = false;
        }, 500);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router]);

  useEffect(() => {
    if (!shouldPoll(status)) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        refreshInFlight.current
      ) {
        return;
      }

      refreshInFlight.current = true;

      try {
        await revalidateGovernanceCache();
        router.refresh();
      } finally {
        window.setTimeout(() => {
          refreshInFlight.current = false;
        }, 500);
      }
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [router, status]);

  return null;
}
