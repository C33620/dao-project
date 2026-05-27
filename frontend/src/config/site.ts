export const siteConfig = {
  name: "DAO Frontend",
  description:
    "Architecture-first DAO frontend scaffold built with Next.js App Router.",
  appName: "DAO Control Center",
  ctaLabel: "Enter app",
  ctaHref: "/app/dashboard",
  links: {
    home: "/",
    app: "/app/dashboard",
    proposals: "/app/proposals",
  },
} as const;

export type SiteConfig = typeof siteConfig;
