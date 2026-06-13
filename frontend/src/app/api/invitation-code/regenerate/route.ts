import { getCurrentUser } from "@/lib/auth";
import { buildInviteExpiryDate, generateInviteCode } from "@/lib/auth/invite";
import { db } from "@/lib/db";
import { InviteCodeStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 },
      );
    }

    await db.inviteCode.updateMany({
      where: {
        createdByUserId: user.id,
        status: InviteCodeStatus.AVAILABLE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: {
        status: InviteCodeStatus.REVOKED,
      },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateInviteCode();

      try {
        const invite = await db.inviteCode.create({
          data: {
            code: candidate,
            status: InviteCodeStatus.AVAILABLE,
            expiresAt: buildInviteExpiryDate(),
            createdByUserId: user.id,
          },
          select: {
            id: true,
            code: true,
            expiresAt: true,
            status: true,
          },
        });

        return NextResponse.json({
          ok: true,
          invite,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json(
      { ok: false, error: "Could not generate a unique invite code." },
      { status: 500 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to generate a new invite code." },
      { status: 500 },
    );
  }
}
