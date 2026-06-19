"use client";

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function ProposalsAutoRefresh() {
  const router = useRouter();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!hasMountedRef.current) {
        return;
      }

      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const handleWindowFocus = () => {
      if (!hasMountedRef.current) {
        return;
      }

      router.refresh();
    };

    hasMountedRef.current = true;

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [router]);

  return null;
}
