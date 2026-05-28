import { getUserByIssuer } from "@/lib/repositories/users";
import { getSession } from "@/lib/services/session";
import type { UserProfile } from "@/types/user";
import { redirect } from "next/navigation";

export async function getCurrentUser(): Promise<UserProfile | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const persistedUser = await getUserByIssuer(session.issuer);

  if (persistedUser) {
    return persistedUser;
  }

  return {
    id: session.issuer,
    displayName: session.displayName,
    email: session.email,
    role: "member",
  };
}

export async function requireUser(): Promise<UserProfile> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  return user;
}
