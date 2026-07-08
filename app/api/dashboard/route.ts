import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeWeeklyTrend, decideAdjustmentTiming, DayPoint } from "@/lib/trend";

const REVIEW_WINDOW_DAYS = 14;

export async function GET() {
  const profile = await prisma.athleteProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  const now = new Date();
  const seasonStart = new Date(profile.seasonStartDate);
  const daysUntilSeasonStart = Math.ceil((seasonStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Decision #8: banner is non-dismissible until acknowledged. Acknowledging
  // clears it; if season start date changes later (e.g. next season), a new
  // profile update with a future date + null decision1ReviewedAt re-arms it
  // naturally since reviewedAt only gets set by the explicit acknowledge action.
  const showSeasonBanner = daysUntilSeasonStart <= REVIEW_WINDOW_DAYS && !profile.decision1ReviewedAt;

  const recentLogs = await prisma.dailyLog.findMany({
    orderBy: { date: "desc" },
    take: 7,
  });

  const dayPoints: DayPoint[] = recentLogs
    .slice()
    .reverse()
    .map((l) => ({
      date: l.date.toISOString().slice(0, 10),
      bodyWeightKg: l.bodyWeightKg,
      carbGramsTarget: l.carbGramsTarget,
    }));

  const trend = computeWeeklyTrend(dayPoints);

  // Whether an automatic adjustment "would fire" is a v3-decision this patch
  // doesn't define the trigger condition for (flagged in ASSUMPTIONS.md A5).
  // Placeholder trigger: a trend beyond ±0.3kg/week either direction.
  const wouldFireAutomaticAdjustment = trend.trendKgPerWeek != null && Math.abs(trend.trendKgPerWeek) > 0.3;
  const adjustment = decideAdjustmentTiming(wouldFireAutomaticAdjustment, trend);

  return NextResponse.json({
    profile,
    daysUntilSeasonStart,
    showSeasonBanner,
    recentLogs,
    trend,
    adjustment,
  });
}
