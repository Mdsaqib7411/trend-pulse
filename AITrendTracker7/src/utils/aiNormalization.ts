/**
 * AI Normalization Filters
 * Converts raw multi-source intelligence into consistent 0-100 scale matrices.
 */

// Mapping scales for platforms
const PLATFORM_WEIGHTS: Record<string, number> = {
  youtube: 1.2,
  reddit: 1.5,
  news: 0.8,
  twitter: 1.3,
  tiktok: 1.8,
  default: 1.0,
};

export const AINormalization = {
  /**
   * Clamps and normalizes a raw engagement score to a 0-100 trust score.
   */
  normalizeTrustScore(rawScore: number, source: string): number {
    const weight = PLATFORM_WEIGHTS[source.toLowerCase()] || PLATFORM_WEIGHTS.default;
    // Logarithmic scale normalization
    let normalized = Math.log10(rawScore + 1) * 20 * weight;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  },

  /**
   * Extracts confidence scale from anomaly checks and lifecycle state.
   */
  calculateConfidenceWeight(baseConfidence: number, isBotFiltered: boolean, isAnomalyChecked: boolean): number {
    let finalConfidence = baseConfidence;
    if (isBotFiltered) finalConfidence *= 0.95; // Slight penalty or correction
    if (isAnomalyChecked) finalConfidence *= 1.05; // Boost if cleared anomaly firewall
    
    return Math.max(0, Math.min(100, Math.round(finalConfidence)));
  },
};
