/**
 * Shared trade-grade classification.
 *
 * Extracted out of `engine.ts` so `news-adjustment.ts` can reclassify grade
 * after a news-driven institutional-score penalty without importing
 * `engine.ts` (which imports `news-adjustment.ts`) — avoids a circular
 * import between the two files.
 */

import type { TradeGrade } from "./types.js";

export function gradeFromScore(institutionalScore: number): TradeGrade {
  if (institutionalScore >= 90) return "A+";
  if (institutionalScore >= 80) return "A";
  if (institutionalScore >= 65) return "B";
  if (institutionalScore >= 50) return "C";
  return "D";
}
