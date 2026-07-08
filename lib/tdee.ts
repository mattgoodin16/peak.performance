// TDEE / BMR calculation engine.
// Implements v4 Decision #5 (confidence display) and Decision #6 (Katch-McArdle gate).

export type BFMethod =
  | "dexa"
  | "bodpod"
  | "clinical_caliper_3site"
  | "consumer_scale"
  | "visual_estimate"
  | "other_unverified";

export type TdeeSource = "apple_watch" | "step_estimate" | "bmr_only";

export interface AthleteInputs {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "male" | "female";
  bodyFatPercent?: number | null;
  bodyFatMethod?: BFMethod | null;
}

// Decision #6: Katch-McArdle only fires for lab-grade or clinical-caliper BF% input.
// Presence of a number is not the trigger — the trust level of the method is.
const TRUSTED_BF_METHODS: BFMethod[] = ["dexa", "bodpod", "clinical_caliper_3site"];

export function isKatchMcArdleEligible(input: AthleteInputs): boolean {
  if (input.bodyFatPercent == null || input.bodyFatMethod == null) return false;
  return TRUSTED_BF_METHODS.includes(input.bodyFatMethod);
}

export function mifflinStJeorBMR(input: AthleteInputs): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === "male" ? base + 5 : base - 161;
}

export function katchMcArdleBMR(input: AthleteInputs): number {
  if (input.bodyFatPercent == null) {
    throw new Error("katchMcArdleBMR called without bodyFatPercent — caller must check eligibility first");
  }
  const leanMassKg = input.weightKg * (1 - input.bodyFatPercent / 100);
  return 370 + 21.6 * leanMassKg;
}

export interface BMRResult {
  bmrKcal: number;
  formulaUsed: "katch_mcardle" | "mifflin_st_jeor";
  fallbackReason?: string;
}

export function calculateBMR(input: AthleteInputs): BMRResult {
  const eligible = isKatchMcArdleEligible(input);
  if (eligible) {
    return { bmrKcal: katchMcArdleBMR(input), formulaUsed: "katch_mcardle" };
  }
  let fallbackReason: string | undefined;
  if (input.bodyFatPercent != null && input.bodyFatMethod != null && !TRUSTED_BF_METHODS.includes(input.bodyFatMethod)) {
    fallbackReason = `BF% on file was entered via "${input.bodyFatMethod}", which isn't reliable enough to trust over Mifflin-St Jeor.`;
  }
  return { bmrKcal: mifflinStJeorBMR(input), formulaUsed: "mifflin_st_jeor", fallbackReason };
}

// Decision #5: displayed uncertainty band by TDEE source.
const CONFIDENCE_BANDS: Record<TdeeSource, number> = {
  apple_watch: 0.15,
  step_estimate: 0.25,
  bmr_only: 0.30,
};

export function getConfidenceBand(source: TdeeSource): number {
  return CONFIDENCE_BANDS[source];
}

// Sedentary multiplier applied only when there is no logged activity data at all
// for the day (bmr_only). This is a conservative placeholder, not a validated
// number — flagged in ASSUMPTIONS.md (v3 gap: no activity-multiplier table was given).
const BMR_ONLY_ACTIVITY_MULTIPLIER = 1.2;

export interface TdeeResult {
  tdeeKcal: number;
  source: TdeeSource;
  confidenceBandPct: number; // e.g. 0.15 = ±15%
  lowerBoundKcal: number;
  upperBoundKcal: number;
  formulaUsed: BMRResult["formulaUsed"];
  fallbackReason?: string;
}

export function calculateTDEE(
  input: AthleteInputs,
  source: TdeeSource,
  activeCaloriesKcal?: number | null
): TdeeResult {
  const bmrResult = calculateBMR(input);
  let tdeeKcal: number;

  if (source === "bmr_only" || activeCaloriesKcal == null) {
    tdeeKcal = bmrResult.bmrKcal * BMR_ONLY_ACTIVITY_MULTIPLIER;
  } else {
    tdeeKcal = bmrResult.bmrKcal + activeCaloriesKcal;
  }

  const band = getConfidenceBand(source);
  return {
    tdeeKcal: Math.round(tdeeKcal),
    source,
    confidenceBandPct: band,
    lowerBoundKcal: Math.round(tdeeKcal * (1 - band)),
    upperBoundKcal: Math.round(tdeeKcal * (1 + band)),
    formulaUsed: bmrResult.formulaUsed,
    fallbackReason: bmrResult.fallbackReason,
  };
}

// Decision #5 UI copy generator — keeps the exact disclosure text in one place
// so it can't drift between Dashboard and Game Plan.
export function tdeeConfidenceCopy(result: TdeeResult): string {
  const sourceLabel = result.source === "apple_watch" ? "Apple Watch" : result.source === "step_estimate" ? "step estimate" : "BMR only (no activity logged)";
  const pct = Math.round(result.confidenceBandPct * 100);
  return `Today's targets are based on an estimated TDEE of ${result.tdeeKcal} kcal (±${pct}%, source: ${sourceLabel}). Your actual burn may be higher or lower — treat the carb cap as directional, not exact.`;
}
