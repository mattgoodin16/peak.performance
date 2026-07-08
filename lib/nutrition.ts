// Daily calorie/macro target engine.
// Implements the strict_daily precedence rule this patch assumes from v3
// (protein floor -> fat floor -> carbs absorb remainder -> hard ceiling),
// plus Decision #5's confidence disclosure appended to the cap message.
//
// ASSUMPTION FLAG (see ASSUMPTIONS.md A1-A3): the exact protein/fat g-per-kg
// floors and the training-table carb minimums by session type were not in
// the v4 patch (they're v3 content this doc wasn't given). Values below are
// standard sports-nutrition defaults, not numbers pulled from your real v3 doc.
// Treat every number in TRAINING_TABLE_CARB_MINIMUMS_G_PER_KG as a placeholder
// to verify against your actual v3 spec before trusting this in-season.

import { TdeeResult, tdeeConfidenceCopy } from "./tdee";

export type SessionType = "rest" | "recovery" | "moderate" | "heavy" | "game";

const PROTEIN_FLOOR_G_PER_KG = 2.0; // standard upper-range athlete protein target
const FAT_FLOOR_G_PER_KG = 0.8; // standard essential-fat minimum

// g carbs per kg bodyweight, by session type — placeholder training table (A2).
export const TRAINING_TABLE_CARB_MINIMUMS_G_PER_KG: Record<SessionType, number> = {
  rest: 3,
  recovery: 4,
  moderate: 5,
  heavy: 7,
  game: 8,
};

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARB = 4;

export interface DailyTargets {
  proteinGrams: number;
  fatGrams: number;
  carbGramsTarget: number; // what strict_daily actually assigns (after cap)
  carbGramsUncapped: number; // what the remainder math alone would give
  trainingTableMinimumGrams: number; // what the session type "wants"
  capBit: boolean; // true if the hard ceiling cut carbs below the training-table minimum
  capBitByGrams: number; // how many grams short, if capBit is true
  tdee: TdeeResult;
  disclosureCopy: string;
}

export function computeDailyTargets(
  tdee: TdeeResult,
  bodyWeightKg: number,
  sessionType: SessionType
): DailyTargets {
  const proteinGrams = round1(PROTEIN_FLOOR_G_PER_KG * bodyWeightKg);
  const fatGrams = round1(FAT_FLOOR_G_PER_KG * bodyWeightKg);

  const proteinKcal = proteinGrams * KCAL_PER_G_PROTEIN;
  const fatKcal = fatGrams * KCAL_PER_G_FAT;

  // Hard ceiling: TDEE estimate is the cap. Protein and fat floors are paid
  // first; carbs absorb whatever remains up to that ceiling. If the floors
  // alone exceed TDEE (rare, e.g. very low TDEE + high bodyweight), remainder
  // goes to zero rather than negative.
  const remainderKcal = Math.max(0, tdee.tdeeKcal - proteinKcal - fatKcal);
  const carbGramsUncapped = round1(remainderKcal / KCAL_PER_G_CARB);

  const trainingTableMinimumGrams = round1(
    TRAINING_TABLE_CARB_MINIMUMS_G_PER_KG[sessionType] * bodyWeightKg
  );

  // Decision #1 (assumed from v3): the ceiling is hard. Carbs never exceed
  // the TDEE-derived remainder even if the training table wants more.
  const carbGramsTarget = carbGramsUncapped;
  const capBit = carbGramsTarget < trainingTableMinimumGrams;
  const capBitByGrams = capBit ? round1(trainingTableMinimumGrams - carbGramsTarget) : 0;

  const baseDisclosure = capBit
    ? `Carb target reduced to ${carbGramsTarget}g — below the ${trainingTableMinimumGrams}g training-table minimum for a ${sessionType} day, because the daily calorie ceiling takes precedence.`
    : `Carb target: ${carbGramsTarget}g, within the training-table range for a ${sessionType} day.`;

  // Decision #5: append the TDEE-uncertainty note to the cap disclosure.
  const disclosureCopy = `${baseDisclosure} Note: this cap is derived from an estimated calorie burn, not a measured one — see confidence note above. ${tdeeConfidenceCopy(tdee)}`;

  return {
    proteinGrams,
    fatGrams,
    carbGramsTarget,
    carbGramsUncapped,
    trainingTableMinimumGrams,
    capBit,
    capBitByGrams,
    tdee,
    disclosureCopy,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
