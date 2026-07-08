// Decision #1 Review — Backtest (item 10).
// Computes what weekly_net TARGET ALLOCATION would have produced on real
// logged history. Does NOT and cannot project recovery/weight outcomes under
// a hypothetical philosophy — see the scope note in the patch, item 10.
//
// ASSUMPTION FLAG (A4): the exact weekly_net redistribution algorithm wasn't
// specified in the v4 patch (v3-territory). Implemented here as: same total
// weekly carb-kcal budget as strict_daily's ceiling sum, redistributed across
// the week in proportion to each day's training-table minimum (heavy/game
// days get more, recovery days get less, weekly total unchanged). This is a
// standard periodization pattern, not a number I invented from nothing — but
// verify it matches whatever your real v3 weekly_net spec says.

import { TdeeResult } from "./tdee";
import { SessionType, TRAINING_TABLE_CARB_MINIMUMS_G_PER_KG } from "./nutrition";

const PROTEIN_FLOOR_G_PER_KG = 2.0;
const FAT_FLOOR_G_PER_KG = 0.8;
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARB = 4;
const MIN_DAYS_REQUIRED = 14; // same 14-day minimum used elsewhere (v3 Performance Intelligence gate)
const MATERIAL_DELTA_PCT = 0.15;
const DIRECTIONAL_CONFIDENCE_DAYS = 30; // v3's stated bar for treating a pattern as directional

export interface LoggedDay {
  date: string;
  sessionType: SessionType;
  bodyWeightKg: number;
  tdee: TdeeResult;
  strictDailyCarbGramsActual: number;
  recoveryScoreNextDay: number | null; // recovery score on the FOLLOWING day
  strictDailyCapBit: boolean; // whether the hard ceiling capped this day below training-table min
}

export interface BacktestRow {
  date: string;
  sessionType: SessionType;
  tdeeKcal: number;
  tdeeConfidencePct: number;
  strictDailyCarbsActual: number;
  weeklyNetCarbsSimulated: number;
  deltaGrams: number;
  deltaPct: number;
}

export interface BacktestResult {
  eligible: boolean;
  daysLogged: number;
  reason?: string; // set when not eligible
  rows: BacktestRow[];
  heavyGameDaysMaterialIncrease: number;
  recoveryDaysMaterialCut: number;
  recoveryScoreComparison: {
    cappedDaysAvgRecovery: number | null;
    nonCappedDaysAvgRecovery: number | null;
    cappedDaysCount: number;
    nonCappedDaysCount: number;
    lowConfidence: boolean; // true whenever daysLogged < DIRECTIONAL_CONFIDENCE_DAYS
  };
  bannerCopy: string;
}

export function runDecision1Backtest(days: LoggedDay[]): BacktestResult {
  if (days.length < MIN_DAYS_REQUIRED) {
    return {
      eligible: false,
      daysLogged: days.length,
      reason: `Not enough data — ${days.length} day(s) logged, ${MIN_DAYS_REQUIRED} required.`,
      rows: [],
      heavyGameDaysMaterialIncrease: 0,
      recoveryDaysMaterialCut: 0,
      recoveryScoreComparison: {
        cappedDaysAvgRecovery: null,
        nonCappedDaysAvgRecovery: null,
        cappedDaysCount: 0,
        nonCappedDaysCount: 0,
        lowConfidence: true,
      },
      bannerCopy: "Not enough data logged yet to review Decision #1 — need at least 14 days.",
    };
  }

  // Per-day protein/fat/remainder (identical inputs strict_daily used).
  const perDay = days.map((d) => {
    const proteinGrams = round1(PROTEIN_FLOOR_G_PER_KG * d.bodyWeightKg);
    const fatGrams = round1(FAT_FLOOR_G_PER_KG * d.bodyWeightKg);
    const proteinKcal = proteinGrams * KCAL_PER_G_PROTEIN;
    const fatKcal = fatGrams * KCAL_PER_G_FAT;
    const remainderKcal = Math.max(0, d.tdee.tdeeKcal - proteinKcal - fatKcal);
    const trainingWeight = TRAINING_TABLE_CARB_MINIMUMS_G_PER_KG[d.sessionType] * d.bodyWeightKg;
    return { ...d, proteinKcal, fatKcal, remainderKcal, trainingWeight };
  });

  const weeklyCarbBudgetKcal = perDay.reduce((sum, d) => sum + d.remainderKcal, 0);
  const totalWeight = perDay.reduce((sum, d) => sum + d.trainingWeight, 0);

  const rows: BacktestRow[] = perDay.map((d) => {
    const share = totalWeight === 0 ? 1 / perDay.length : d.trainingWeight / totalWeight;
    const weeklyNetCarbsSimulated = round1((weeklyCarbBudgetKcal * share) / KCAL_PER_G_CARB);
    const deltaGrams = round1(weeklyNetCarbsSimulated - d.strictDailyCarbGramsActual);
    const deltaPct = d.strictDailyCarbGramsActual === 0 ? 0 : deltaGrams / d.strictDailyCarbGramsActual;
    return {
      date: d.date,
      sessionType: d.sessionType,
      tdeeKcal: d.tdee.tdeeKcal,
      tdeeConfidencePct: d.tdee.confidenceBandPct,
      strictDailyCarbsActual: d.strictDailyCarbGramsActual,
      weeklyNetCarbsSimulated,
      deltaGrams,
      deltaPct: round1(deltaPct * 1000) / 10, // as percent, 1 decimal
    };
  });

  const heavyGameDaysMaterialIncrease = rows.filter(
    (r, i) => (perDay[i].sessionType === "heavy" || perDay[i].sessionType === "game") && r.deltaPct > MATERIAL_DELTA_PCT * 100
  ).length;
  const recoveryDaysMaterialCut = rows.filter(
    (r, i) => perDay[i].sessionType === "recovery" && r.deltaPct < -MATERIAL_DELTA_PCT * 100
  ).length;

  const cappedDays = days.filter((d) => d.strictDailyCapBit && d.recoveryScoreNextDay != null);
  const nonCappedDays = days.filter((d) => !d.strictDailyCapBit && d.recoveryScoreNextDay != null);
  const avg = (arr: LoggedDay[]) =>
    arr.length === 0 ? null : round1(arr.reduce((s, d) => s + (d.recoveryScoreNextDay ?? 0), 0) / arr.length);

  const lowConfidence = days.length < DIRECTIONAL_CONFIDENCE_DAYS;

  const bannerCopy = `Below: what weekly-net-deficit would have allocated on your actual training days, compared to what strict-daily actually gave you. This shows target differences only — we can't tell you how your recovery or weight would have responded to a fueling approach you didn't actually use. The recovery-score comparison below is real data from what did happen, but with only ${days.length} days logged, treat it as a low-confidence signal, not a conclusion.`;

  return {
    eligible: true,
    daysLogged: days.length,
    rows,
    heavyGameDaysMaterialIncrease,
    recoveryDaysMaterialCut,
    recoveryScoreComparison: {
      cappedDaysAvgRecovery: avg(cappedDays),
      nonCappedDaysAvgRecovery: avg(nonCappedDays),
      cappedDaysCount: cappedDays.length,
      nonCappedDaysCount: nonCappedDays.length,
      lowConfidence,
    },
    bannerCopy,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
