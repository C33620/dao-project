import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

export async function parseJsonBodySafely(request: Request) {
  try {
    return {
      data: await request.json(),
      error: null as string | null,
    };
  } catch {
    return {
      data: null,
      error: "Invalid or empty JSON body.",
    };
  }
}

export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown,
): { data: T | null; response: NextResponse | null } {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      data: null,
      response: NextResponse.json(
        {
          error: "Invalid request body.",
          issues: result.error.flatten(),
        },
        { status: 400 },
      ),
    };
  }

  return {
    data: result.data,
    response: null,
  };
}
