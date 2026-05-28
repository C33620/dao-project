import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "govboard_session";

export type AppSession = {
  issuer: string;
  email: string;
  displayName: string;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });

    const issuer = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const displayName =
      typeof payload.displayName === "string" ? payload.displayName : null;

    if (!issuer || !email || !displayName) {
      return null;
    }

    return {
      issuer,
      email,
      displayName,
    };
  } catch {
    return null;
  }
}
