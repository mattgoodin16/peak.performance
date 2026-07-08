import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  weightKg: z.number().positive(),
  heightCm: z.number().positive(),
  age: z.number().int().positive(),
  sex: z.enum(["male", "female"]),
  bodyFatPercent: z.number().min(1).max(60).optional().nullable(),
  bodyFatMethod: z
    .enum(["dexa", "bodpod", "clinical_caliper_3site", "consumer_scale", "visual_estimate", "other_unverified"])
    .optional()
    .nullable(),
  // Decision #8: required, not optional — the revisit mechanism cannot work without it.
  seasonStartDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  fuelingPhilosophy: z.enum(["strict_daily", "weekly_net"]).default("strict_daily"),
});

export async function GET() {
  const profile = await prisma.athleteProfile.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.athleteProfile.findFirst({ orderBy: { createdAt: "desc" } });

  const profile = existing
    ? await prisma.athleteProfile.update({
        where: { id: existing.id },
        data: {
          weightKg: data.weightKg,
          heightCm: data.heightCm,
          age: data.age,
          sex: data.sex,
          bodyFatPercent: data.bodyFatPercent ?? null,
          bodyFatMethod: data.bodyFatMethod ?? null,
          seasonStartDate: new Date(data.seasonStartDate),
          fuelingPhilosophy: data.fuelingPhilosophy,
        },
      })
    : await prisma.athleteProfile.create({
        data: {
          weightKg: data.weightKg,
          heightCm: data.heightCm,
          age: data.age,
          sex: data.sex,
          bodyFatPercent: data.bodyFatPercent ?? null,
          bodyFatMethod: data.bodyFatMethod ?? null,
          seasonStartDate: new Date(data.seasonStartDate),
          fuelingPhilosophy: data.fuelingPhilosophy,
        },
      });

  return NextResponse.json({ profile });
}
