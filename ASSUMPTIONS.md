# Assumptions made building this without v3

You told me to build the full app from the v4 patch alone. The patch is explicit that it's layered
on top of a v3 spec I never saw. Here is every place I had to invent something v3 would have actually
specified, so you can check each one against your real spec before trusting this in-season.

## A1 — Protein/fat floor ratios
`lib/nutrition.ts`: 2.0 g/kg protein, 0.8 g/kg fat. Standard sports-nutrition defaults for an athlete
in a deficit. Your real v3 doc may specify different numbers — these are placeholders, not derived
from anything you gave me.

## A2 — Training-table carb minimums by session type
`lib/nutrition.ts`, `TRAINING_TABLE_CARB_MINIMUMS_G_PER_KG`: rest 3g/kg, recovery 4g/kg, moderate 5g/kg,
heavy 7g/kg, game 8g/kg. These are the exact numbers the "cap bit" logic (Decision #1) and the
Decision #10 backtest both depend on. If your real training table differs, both the daily targets and
the backtest results will be wrong until you correct this constant.

## A3 — The precedence rule and "hard ceiling" mechanics themselves
The patch assumes v3 already defined: protein floor → fat floor → carbs absorb the remainder → TDEE
is a hard ceiling that carbs cannot exceed even if the training table wants more. I implemented
exactly that reading. If v3's actual precedence rule works differently, `lib/nutrition.ts` is wrong,
not just its constants.

## A4 — The weekly_net redistribution algorithm
`lib/backtest.ts`: same total weekly carb-kcal budget as strict_daily would have produced, redistributed
across the week in proportion to each day's training-table minimum. This is a defensible periodization
pattern, but the patch doesn't specify weekly_net's real mechanics (v3 territory) — verify this matches
what you actually meant by "weekly-net-deficit engine."

## A5 — Two mechanisms the patch references but doesn't fully define
- **Automatic calorie adjustment trigger** (Decision #7's "if an automatic adjustment would fire"):
  implemented as a placeholder — trend beyond ±0.3 kg/week. The real trigger condition is v3 content.
- **"Since the last fueling_philosophy switch"** (Decision #10's backtest window): there's no
  change-history table specified, so the backtest currently uses *all* logged history, not history
  since the last switch. If you need the real behavior, this needs a philosophy-change-log table.

## A6 — Database: now PostgreSQL via Supabase (resolved)
Originally built on local SQLite with Turso left as a documented follow-up. Migrated to PostgreSQL
via Supabase per your instruction — this also resolves the SQLite enum limitation the earlier version
was hitting. `DATABASE_URL` (pooled, port 6543) is what the app queries with at runtime; `DIRECT_URL`
(unpooled, port 5432) is required for `prisma migrate`/`db push` because PgBouncer's transaction-mode
pooling doesn't support the prepared statements migrations issue. Both come from the same Supabase
connection-string panel. Not yet run end-to-end against a real Supabase project — see README's
"What's verified" section.

## A7 — BMR-only activity multiplier
`lib/tdee.ts`: 1.2x applied to BMR when no activity data is logged at all for the day. Not specified
anywhere in the patch — conservative sedentary-multiplier placeholder.

---

None of these were guessed carelessly — each is either a standard, defensible default or an explicit
placeholder with a stated retuning plan, consistent with how the patch itself handles unknowns (see
its own "What I could not resolve for you" section). But "defensible default" is not the same as
"correct for you." Check A1–A5 against your real v3 spec before this runs in-season.
