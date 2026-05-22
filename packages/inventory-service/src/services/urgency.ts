/**
 * Compute urgency_score for a listing (0–1).
 * Higher = more urgent = higher rank in deal feed.
 * Drives the deal feed algorithm.
 */
export function computeUrgencyScore(
  urgencyDays?: number,
  deadStockType?: string,
  expiryDate?: string
): number {
  let score = 0.3; // baseline

  // Urgency days: the sooner, the higher the score
  if (urgencyDays) {
    if (urgencyDays <= 7) score += 0.4;
    else if (urgencyDays <= 14) score += 0.3;
    else if (urgencyDays <= 30) score += 0.2;
    else score += 0.05;
  }

  // Dead stock type multiplier
  const typeBoost: Record<string, number> = {
    near_expiry: 0.2,
    returns: 0.1,
    damaged_packaging: 0.1,
    seasonal: 0.15,
    excess: 0.05,
    obsolete: 0.05,
  };
  score += typeBoost[deadStockType ?? ''] ?? 0;

  // Expiry proximity
  if (expiryDate) {
    const daysToExpiry = Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToExpiry <= 30) score += 0.2;
    else if (daysToExpiry <= 60) score += 0.1;
  }

  return Math.min(1, Math.round(score * 10000) / 10000);
}
