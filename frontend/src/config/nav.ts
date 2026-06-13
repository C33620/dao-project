export type AppRole = "member" | "delegate" | "admin" | "viewer";

export type AppNavItem = {
  title: string;
  href: string;
  description?: string;
  roles?: AppRole[];
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
    description: "Items ready for voting",
  },
  {
    title: "Finalize",
    href: "/app/execute",
    description: "Items ready to be validated",
  },
  {
    title: "Voted",
    href: "/app/history",
    description: "Items successfuly voted",
  },
  {
    title: "Invitation code",
    href: "/app/invitation-code",
    description: "Your current code to share",
  },
  {
    title: "Admin",
    href: "/app/admin/treasury",
    description: "Treasury queue and operations",
    roles: ["admin"],
  },
  {
    title: "Settings",
    href: "/app/settings",
    description: "Account and session details",
  },
];
