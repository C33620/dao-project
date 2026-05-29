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

  console.log("[SESSION_SERVICE] COOKIE_PRESENT", Boolean(token));

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

    console.log("[SESSION_SERVICE] SESSION_PAYLOAD", {
      issuer,
      email,
      displayName,
    });

    if (!issuer || !email || !displayName) {
      console.log("[SESSION_SERVICE] SESSION_INVALID_SHAPE");
      return null;
    }

    return {
      issuer,
      email,
      displayName,
    };
  } catch (error) {
    console.error("[SESSION_SERVICE] SESSION_VERIFY_FAILED", error);
    return null;
  }
}
