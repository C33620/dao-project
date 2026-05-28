import { requireUser } from "@/lib/auth";
import type { ReactNode } from "react";
import { AppShellLayout } from "./shell-layout";

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  await requireUser();

  return <AppShellLayout>{children}</AppShellLayout>;
}
