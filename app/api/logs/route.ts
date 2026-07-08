import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { calculateTDEE, TdeeSource } from "@/lib/tdee";
import { computeDailyTargets, SessionType } from "@/lib/nutrition";

const logSchema = z.object({
  date: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  sessionType: z.enum(["rest", "recovery", "moderate", "heavy", "game"]),
  tdeeSource: z.enum(["apple_watch", "step_estimate", "bmr_only"]),
  activeCaloriesKcal: z.number().nonnegative().optional().nullable(),
  bodyWeightKg: z.number().positive().optional().nullable(),
  carbGramsActual: z.number().nonnegative().optional().nullable(),
  recoveryScore: z.number().min(1).max(10).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const logs = await prisma.dailyLog.findMany({
    orderBy: { date: "desc" },
    take: days,
  });
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const profile = await prisma.athleteProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (!profile) {
    return NextResponse.json(
      { error: "No athlete profile on file yet. Fill out /profile first — the engine has nothing to compute from." },
      { status: 400 }
    );
  }

  const bodyWeightKg = data.bodyWeightKg ?? profile.weightKg;

  const tdee = calculateTDEE(
    {
      weightKg: bodyWeightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      sex: profile.sex as "male" | "female",
      bodyFatPercent: profile.bodyFatPercent,
      bodyFatMethod: profile.bodyFatMethod as any,
    },
    data.tdeeSource as TdeeSource,
    data.activeCaloriesKcal ?? null
  );

  const targets = computeDailyTargets(tdee, bodyWeightKg, data.sessionType as SessionType);

  const date = new Date(data.date);
  date.setUTCHours(0, 0, 0, 0);

  const log = await prisma.dailyLog.upsert({
    where: { date },
    create: {
      date,
      sessionType: data.sessionType,
      tdeeEstimateKcal: tdee.tdeeKcal,
      tdeeSource: data.tdeeSource,
      activeCaloriesKcal: data.activeCaloriesKcal ?? null,
      bodyWeightKg,
      carbGramsTarget: targets.carbGramsTarget,
      carbGramsActual: data.carbGramsActual ?? null,
      proteinGramsTarget: targets.proteinGrams,
      fatGramsTarget: targets.fatGrams,
      recoveryScore: data.recoveryScore ?? null,
    },
    update: {
      sessionType: data.sessionType,
      tdeeEstimateKcal: tdee.tdeeKcal,
      tdeeSource: data.tdeeSource,
      activeCaloriesKcal: data.activeCaloriesKcal ?? null,
      bodyWeightKg,
      carbGramsTarget: targets.carbGramsTarget,
      carbGramsActual: data.carbGramsActual ?? null,
      proteinGramsTarget: targets.proteinGrams,
      fatGramsTarget: targets.fatGrams,
      recoveryScore: data.recoveryScore ?? null,
    },
  });

  return NextResponse.json({ log, targets });
}
