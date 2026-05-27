import type { UserProfile } from "@/types/user";

export async function getCurrentUser(): Promise<UserProfile | null> {
  // TODO: integrate Magic auth session lookup.
  return null;
}

export async function requireUser(): Promise<UserProfile | null> {
  // TODO: add authenticated guard behavior for protected app routes.
  return getCurrentUser();
}
