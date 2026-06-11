"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type ProposalsAutoRefreshProps = {
  intervalMs?: number;
};

export function ProposalsAutoRefresh({
  intervalMs = 15000,
}: ProposalsAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const intervalId = window.setInterval(refreshIfVisible, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, router]);

  return null;
}
