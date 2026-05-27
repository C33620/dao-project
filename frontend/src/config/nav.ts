export type AppNavItem = {
  title: string;
  href: string;
  description?: string;
};

export const appNav: AppNavItem[] = [
  {
    title: "Dashboard",
    href: "/app/dashboard",
    description: "Overview and governance health",
  },
  {
    title: "Proposals",
    href: "/app/proposals",
    description: "Review active and historical proposals",
  },
  {
    title: "Execute",
    href: "/app/execute",
    description: "Queued actions and execution readiness",
  },
  {
    title: "History",
    href: "/app/history",
    description: "Governance activity feed",
  },
  {
    title: "Settings",
    href: "/app/settings",
    description: "Preferences and account configuration",
  },
];
