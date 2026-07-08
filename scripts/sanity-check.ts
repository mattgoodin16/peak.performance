import { calculateBMR, calculateTDEE, isKatchMcArdleEligible } from "../lib/tdee";
import { computeDailyTargets } from "../lib/nutrition";
import { computeWeeklyTrend } from "../lib/trend";
import { runDecision1Backtest, LoggedDay } from "../lib/backtest";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failures++;
  } else {
    console.log("ok:", msg);
  }
}

// --- Decision #6: Katch-McArdle gate ---
const trustedInput = {
  weightKg: 90,
  heightCm: 185,
  age: 22,
  sex: "male" as const,
  bodyFatPercent: 12,
  bodyFatMethod: "dexa" as const,
};
const untrustedInput = { ...trustedInput, bodyFatMethod: "consumer_scale" as const };
const noBfInput = { ...trustedInput, bodyFatPercent: undefined, bodyFatMethod: undefined };

assert(isKatchMcArdleEligible(trustedInput) === true, "DEXA BF% is Katch-McArdle eligible");
assert(isKatchMcArdleEligible(untrustedInput) === false, "consumer_scale BF% is NOT Katch-McArdle eligible");
assert(isKatchMcArdleEligible(noBfInput) === false, "no BF% is NOT Katch-McArdle eligible");

const trustedBmr = calculateBMR(trustedInput);
const untrustedBmr = calculateBMR(untrustedInput);
assert(trustedBmr.formulaUsed === "katch_mcardle", "trusted input uses Katch-McArdle");
assert(untrustedBmr.formulaUsed === "mifflin_st_jeor", "untrusted input falls back to Mifflin-St Jeor even though a BF% number exists");
assert(!!untrustedBmr.fallbackReason, "fallback reason is populated when BF% is present but untrusted");

// Mifflin-St Jeor manual check: 10*90 + 6.25*185 - 5*22 + 5 = 900+1156.25-110+5 = 1951.25
const manualMSJ = calculateBMR(noBfInput);
assert(Math.abs(manualMSJ.bmrKcal - 1951.25) < 0.01, `Mifflin-St Jeor arithmetic correct (got ${manualMSJ.bmrKcal})`);

// --- Decision #5: confidence bands ---
const tdeeWatch = calculateTDEE(noBfInput, "apple_watch", 800);
assert(tdeeWatch.confidenceBandPct === 0.15, "apple_watch band is ±15%");
assert(tdeeWatch.lowerBoundKcal < tdeeWatch.tdeeKcal && tdeeWatch.upperBoundKcal > tdeeWatch.tdeeKcal, "bounds bracket the point estimate");

const tdeeBmrOnly = calculateTDEE(noBfInput, "bmr_only", null);
assert(tdeeBmrOnly.confidenceBandPct === 0.30, "bmr_only band is ±30%");
assert(tdeeBmrOnly.tdeeKcal > manualMSJ.bmrKcal, "bmr_only TDEE applies activity multiplier, is greater than raw BMR");

// --- Nutrition targets: cap-bit logic ---
// Deliberately low TDEE + heavy session -> should cap below training-table minimum.
const lowTdee = calculateTDEE({ ...noBfInput, weightKg: 90 }, "bmr_only", null);
const targets = computeDailyTargets(lowTdee, 90, "heavy");
assert(targets.trainingTableMinimumGrams === 7 * 90, "training table minimum computed correctly (7g/kg * 90kg)");
console.log("  -> carbGramsTarget:", targets.carbGramsTarget, "trainingTableMin:", targets.trainingTableMinimumGrams, "capBit:", targets.capBit);
assert(targets.capBit === true, "low-TDEE heavy day gets flagged as capped below training table minimum");
assert(targets.disclosureCopy.includes("confidence note above"), "disclosure copy includes Decision #5 confidence note");

// High TDEE, rest day -> should NOT cap
const highTdee = calculateTDEE({ ...noBfInput, weightKg: 70 }, "apple_watch", 1200);
const restTargets = computeDailyTargets(highTdee, 70, "rest");
assert(restTargets.capBit === false, "high-TDEE rest day is not capped");

// --- Decision #7: weight trend + carb variance flag ---
const flatCarbWeek = [
  { date: "2026-07-01", bodyWeightKg: 90.0, carbGramsTarget: 300 },
  { date: "2026-07-02", bodyWeightKg: 89.9, carbGramsTarget: 310 },
  { date: "2026-07-03", bodyWeightKg: 89.8, carbGramsTarget: 305 },
  { date: "2026-07-04", bodyWeightKg: 89.7, carbGramsTarget: 295 },
  { date: "2026-07-05", bodyWeightKg: 89.6, carbGramsTarget: 300 },
  { date: "2026-07-06", bodyWeightKg: 89.5, carbGramsTarget: 305 },
  { date: "2026-07-07", bodyWeightKg: 89.4, carbGramsTarget: 300 },
];
const flatTrend = computeWeeklyTrend(flatCarbWeek);
assert(flatTrend.highVarianceWeek === false, "low carb-variance week is NOT flagged");
assert(flatTrend.trendKgPerWeek !== null && flatTrend.trendKgPerWeek < 0, "declining weight trend detected as negative kg/week");

const swingyWeek = [
  { date: "2026-07-01", bodyWeightKg: 90.0, carbGramsTarget: 150 }, // recovery
  { date: "2026-07-02", bodyWeightKg: 90.5, carbGramsTarget: 160 }, // recovery
  { date: "2026-07-03", bodyWeightKg: 90.2, carbGramsTarget: 400 }, // game (glycogen load)
  { date: "2026-07-04", bodyWeightKg: 91.0, carbGramsTarget: 420 }, // game
  { date: "2026-07-05", bodyWeightKg: 90.3, carbGramsTarget: 160 }, // recovery
  { date: "2026-07-06", bodyWeightKg: 90.0, carbGramsTarget: 300 }, // moderate
  { date: "2026-07-07", bodyWeightKg: 89.9, carbGramsTarget: 155 }, // recovery
];
const swingyTrend = computeWeeklyTrend(swingyWeek);
console.log("  -> carbVariancePct:", swingyTrend.carbVariancePct);
assert(swingyTrend.highVarianceWeek === true, "carb-cycling week (game vs recovery swings) IS flagged high-variance");
assert(swingyTrend.flagCopy !== null, "flag copy is populated for high-variance week");

// --- Decision #10: backtest gate + basic shape ---
const tooFewDays: LoggedDay[] = Array.from({ length: 5 }).map((_, i) => ({
  date: `2026-07-0${i + 1}`,
  sessionType: "moderate" as const,
  bodyWeightKg: 90,
  tdee: calculateTDEE(noBfInput, "apple_watch", 700),
  strictDailyCarbGramsActual: 300,
  recoveryScoreNextDay: 7,
  strictDailyCapBit: false,
}));
const gatedResult = runDecision1Backtest(tooFewDays);
assert(gatedResult.eligible === false, "backtest with <14 days is gated off, not silently computed");

const sessionCycle: ("recovery" | "moderate" | "heavy" | "game")[] = ["recovery", "moderate", "heavy", "game"];
const enoughDays: LoggedDay[] = Array.from({ length: 21 }).map((_, i) => {
  const sessionType = sessionCycle[i % sessionCycle.length];
  const capBit = sessionType === "heavy" || sessionType === "game";
  return {
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    sessionType,
    bodyWeightKg: 90,
    tdee: calculateTDEE(noBfInput, "apple_watch", 700),
    strictDailyCarbGramsActual: capBit ? 350 : 300,
    recoveryScoreNextDay: capBit ? 5 : 7,
    strictDailyCapBit: capBit,
  };
});
const realResult = runDecision1Backtest(enoughDays);
assert(realResult.eligible === true, "backtest with 21 days is eligible");
assert(realResult.rows.length === 21, "backtest produces one row per logged day");
assert(realResult.recoveryScoreComparison.lowConfidence === true, "21 days is still below the 30-day directional-confidence bar, correctly marked low confidence");
assert(realResult.heavyGameDaysMaterialIncrease > 0, "weekly_net simulation gives heavy/game days a material carb increase vs strict_daily in this synthetic case");

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
