// 7-day rolling weight trend + carb-cycling contamination flag.
// Implements Decision #7: flag (never silently exclude) weeks with high
// carb-gram variance, and delay any automatic calorie adjustment by one week
// when it would fire substantially off a flagged window.

export interface DayPoint {
  date: string; // ISO date
  bodyWeightKg: number | null;
  carbGramsTarget: number | null;
}

export interface WeeklyTrendResult {
  trendKgPerWeek: number | null; // null if insufficient weigh-ins
  daysWithWeighIns: number;
  highVarianceWeek: boolean;
  carbVariancePct: number | null; // (max-min)/avg, null if insufficient carb data
  flagCopy: string | null;
}

// Decision #7: this threshold is an explicitly unvalidated placeholder.
// Ship v1 with it, log real variance data for 4-6 weeks, then retune.
const HIGH_VARIANCE_THRESHOLD_PCT = 0.4;

export function computeWeeklyTrend(last7Days: DayPoint[]): WeeklyTrendResult {
  const weighIns = last7Days.filter((d) => d.bodyWeightKg != null) as (DayPoint & { bodyWeightKg: number })[];

  let trendKgPerWeek: number | null = null;
  if (weighIns.length >= 3) {
    // Simple linear regression of weight vs day-index, slope * 7 = weekly rate.
    // Good enough for a v1 trend line; not a substitute for a proper EMA if
    // you want to upgrade later.
    const n = weighIns.length;
    const xs = weighIns.map((_, i) => i);
    const ys = weighIns.map((d) => d.bodyWeightKg);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const slopePerDay = den === 0 ? 0 : num / den;
    trendKgPerWeek = Math.round(slopePerDay * 7 * 100) / 100;
  }

  const carbDays = last7Days
    .map((d) => d.carbGramsTarget)
    .filter((c): c is number => c != null);

  let carbVariancePct: number | null = null;
  let highVarianceWeek = false;
  if (carbDays.length >= 4) {
    const max = Math.max(...carbDays);
    const min = Math.min(...carbDays);
    const avg = carbDays.reduce((a, b) => a + b, 0) / carbDays.length;
    carbVariancePct = avg === 0 ? 0 : (max - min) / avg;
    highVarianceWeek = carbVariancePct > HIGH_VARIANCE_THRESHOLD_PCT;
  }

  const flagCopy = highVarianceWeek
    ? "This week's weight trend included highly variable carb intake (recovery day → game day swings). Some of the change shown may be water weight from glycogen shifts rather than fat/muscle change. Treat this week's trend with lower confidence."
    : null;

  return {
    trendKgPerWeek,
    daysWithWeighIns: weighIns.length,
    highVarianceWeek,
    carbVariancePct,
    flagCopy,
  };
}

export interface AdjustmentDecision {
  shouldApplyNow: boolean;
  delayedReason: string | null;
}

// Decision #7: if an automatic adjustment would fire based on a flagged week,
// delay it one additional week and say why, rather than applying it silently.
export function decideAdjustmentTiming(
  wouldFireAutomaticAdjustment: boolean,
  trend: WeeklyTrendResult
): AdjustmentDecision {
  if (wouldFireAutomaticAdjustment && trend.highVarianceWeek) {
    return {
      shouldApplyNow: false,
      delayedReason:
        "An automatic calorie adjustment would normally fire this week, but it's being delayed one week because this week's trend is flagged high-variance (carb-cycling swings may be masking the real signal).",
    };
  }
  return { shouldApplyNow: wouldFireAutomaticAdjustment, delayedReason: null };
}
