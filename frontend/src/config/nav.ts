export type AppNavItem = {
  title: string;
  href: string;
  description?: string;
};

export const appNav: AppNavItem[] = [
  {
    title: "Home",
    href: "/app/dashboard",
    description: "Your overview and next steps",
  },
  {
    title: "Proposals",
    href: "/app/proposals",
    description: "Items ready for review",
  },
  {
    title: "Finalize",
    href: "/app/execute",
    description: "Items ready or nearly ready",
  },
  {
    title: "History",
    href: "/app/history",
    description: "Your recent activity",
  },
  {
    title: "Settings",
    href: "/app/settings",
    description: "Account and session details",
  },
];
