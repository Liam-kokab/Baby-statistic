# Milk Prediction — Algorithm Change Log

**Purpose.** This file is the running history of changes to the next-bottle prediction
(`server/src/services/drankMilkPrediction.ts`). Each entry records **what changed, when,
and the expected improvement**, so that when looking at historical prediction logs later
you can tell which algorithm version produced them. Add a new entry at the top every time
the algorithm changes.

**How changes are measured.** Backtest by replaying the logged feeds: for each feed the
prediction is recomputed using only data available *before* it, then compared to the actual
bottle amount. Metrics:
- **Waste** = sum of max(0, predicted - actual) — milk poured then thrown away (the real cost).
- **Shortfall** = sum of max(0, actual - predicted) — had to top up (cheap; we can always get more).
- **MAE** = mean absolute error. **Bias** = mean(actual - predicted); positive = under-pours.
- **Coverage** = sum of min(pred, actual) / sum of actual — share of need met without over-pouring.

---

## Baseline — original algorithm (before 2026-06-03)

Reference numbers on the first 25 logged feeds (2026-05-31 -> 2026-06-03). The original
algorithm **chronically under-poured**: it almost never wasted milk, but only because it
suggested far too little.

| Waste | Shortfall | MAE | Bias | Coverage |
|---|---|---|---|---|
| 30 ml | 1312 ml | 53.7 ml | +51.3 ml | 43 % |

Root cause identified: empty/low time-buckets (sleep gaps) counted as `0` and dragged the
historic per-window average far below a real feed size.

---

## 2026-06-03 — Two-pass bucket average

**What changed** (only this — everything else untouched: the recent-intake subtraction, the
2/4/6 h blend, `reduceSuggestionToAvoidWaste`, rounding):

In `getWeightedAverageForPeriod`, the per-window average is now computed in two passes:
1. Take the weighted average over all bucket totals (as before).
2. **Drop every bucket whose total is below half that average** (the empty / barely-fed slots).
3. Re-take the weighted average over the remaining buckets.

Implemented via a new `weightedAverageOfTotals` helper.

**Why:** empty buckets dragged the average below a real feed, causing the chronic under-pour.
Removing them lifts each window's estimate toward the baby's actual feeding size.

**Expected improvement** (backtest vs baseline, same 25 feeds):

| Metric | Before | After | Change |
|---|---|---|---|
| MAE | 53.7 ml | 39.8 ml | **-26 %** |
| Bias | +51.3 ml | +32.1 ml | -19 ml (still under-pours -> safe) |
| Coverage | 43 % | **61 %** | **+18 pts** |
| Waste | 30 ml | 96 ml | +66 ml (~2.6 ml/feed) |

Net: bottle is "right first time" far more often, for ~one teaspoon of extra waste per feed,
while still erring on the safe (under-pour) side.

---

## Ideas not yet applied (candidates for the next change)

Backtested options, kept here for the next iteration:

- **Remove / replace the recent-intake subtraction** (`wa - drankInLastHours`). Biggest single
  accuracy lever in isolation (MAE -> ~30 ml), but it predicts the typical next-bottle size and
  does **not** drop right after a feed, so it needs pairing with the subtraction or a cap to stay
  waste-safe.
- **Waste-first rule with a tunable ceiling:** `min(f * historicMax - recentlyGiven, medianFeed)`,
  floored to a small actionable pour, rounded down. `historicMax` = mean of the 5 biggest feeds.
  The scale `f` is the knob: `f~0.5` ~ near-zero waste, `f~0.7` is the close-but-rarely-over sweet
  spot (coverage ~64 %, ~5 ml/feed waste), `f=1.0` best accuracy (coverage ~78 %, ~9 ml/feed waste).
  A long overnight gap resets `recentlyGiven`, so the `medianFeed` cap is what prevents big
  gap-driven over-pours.
- **Shorten the 36-day history window** and/or steepen recency weighting to track the growing baby.

