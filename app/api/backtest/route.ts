import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConfidenceBand, TdeeResult, TdeeSource } from "@/lib/tdee";
import { TRAINING_TABLE_CARB_MINIMUMS_G_PER_KG, SessionType } from "@/lib/nutrition";
import { runDecision1Backtest, LoggedDay } from "@/lib/backtest";

export async function GET() {
  // NOTE: "since the last fueling_philosophy switch" (item 10 scope) isn't
  // trackable without a change-history table, which wasn't specified. Using
  // all logged history as a documented simplification (ASSUMPTIONS.md A5).
  const logs = await prisma.dailyLog.findMany({ orderBy: { date: "asc" } });

  if (logs.length === 0) {
    const empty = runDecision1Backtest([]);
    return NextResponse.json(empty);
  }

  const byDateKey = new Map(logs.map((l) => [l.date.toISOString().slice(0, 10), l]));

  const loggedDays: LoggedDay[] = logs
    .filter((l) => l.carbGramsTarget != null && l.bodyWeightKg != null)
    .map((l) => {
      const dateKey = l.date.toISOString().slice(0, 10);
      const nextDate = new Date(l.date);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextKey = nextDate.toISOString().slice(0, 10);
      const nextLog = byDateKey.get(nextKey);

      const source = l.tdeeSource as TdeeSource;
      const band = getConfidenceBand(source);
      const tdee: TdeeResult = {
        tdeeKcal: l.tdeeEstimateKcal,
        source,
        confidenceBandPct: band,
        lowerBoundKcal: Math.round(l.tdeeEstimateKcal * (1 - band)),
        upperBoundKcal: Math.round(l.tdeeEstimateKcal * (1 + band)),
        formulaUsed: "mifflin_st_jeor", // not persisted per-log; doesn't affect backtest math
      };

      const sessionType = l.sessionType as SessionType;
      const trainingTableMin = TRAINING_TABLE_CARB_MINIMUMS_G_PER_KG[sessionType] * (l.bodyWeightKg as number);
      const capBit = (l.carbGramsTarget as number) < trainingTableMin;

      return {
        date: dateKey,
        sessionType,
        bodyWeightKg: l.bodyWeightKg as number,
        tdee,
        strictDailyCarbGramsActual: l.carbGramsTarget as number,
        recoveryScoreNextDay: nextLog?.recoveryScore ?? null,
        strictDailyCapBit: capBit,
      };
    });

  const result = runDecision1Backtest(loggedDays);
  return NextResponse.json(result);
}
