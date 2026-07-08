import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  const existing = await prisma.athleteProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (!existing) {
    return NextResponse.json({ error: "No profile found." }, { status: 404 });
  }
  const profile = await prisma.athleteProfile.update({
    where: { id: existing.id },
    data: { decision1ReviewedAt: new Date() },
  });
  return NextResponse.json({ profile });
}
