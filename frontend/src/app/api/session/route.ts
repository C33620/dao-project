import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();

    const response = NextResponse.json(
      user
        ? {
            authenticated: true,
            user: {
              id: user.id,
              displayName: user.displayName,
              email: user.email,
              role: user.role,
            },
          }
        : {
            authenticated: false,
            user: null,
          },
    );

    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error("[SESSION_ROUTE] GET_ERROR", error);

    const response = NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 200 },
    );

    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  }
}
