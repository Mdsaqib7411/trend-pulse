/**
 * TrendPulse — Centralized Keyword Extraction & Jaccard Overlap Utilities.
 *
 * Centralizes duplicate stop words and token overlap formulas used across
 * clustering, prediction, graph building, and platform fusion engines.
 */

// Global set of common stop words to filter out noisy tokens
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'and', 'but', 'or', 'if', 'while', 'as', 'that', 'this', 'it',
    'its', 'what', 'which', 'who', 'whom', 'these', 'those', 'am', 'he',
    'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'his',
    'your', 'our', 'their', 'new', 'says', 'said', 'also'
]);

/**
 * Extract significant token keywords from a text string.
 * Sanitizes characters, splits tokens, and filters out stop words and short terms.
 * @param {string} text Raw text input
 * @returns {Array<string>} List of sanitized terms
 */
function extractKeywords(text) {
    if (!text || typeof text !== 'string') return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Computes a Jaccard-like keyword overlap ratio based on the smaller set denominator.
 * Returns a score between 0.0 (no overlap) and 1.0 (complete subset overlap).
 * @param {Array<string>} kwA First keyword array
 * @param {Array<string>} kwB Second keyword array
 * @returns {number} Overlap ratio
 */
function computeOverlap(kwA, kwB) {
    if (!kwA || !kwB || kwA.length === 0 || kwB.length === 0) return 0;
    const setA = new Set(kwA);
    const setB = new Set(kwB);
    let intersection = 0;
    for (const w of setA) {
        if (setB.has(w)) intersection++;
    }
    return intersection / Math.min(setA.size, setB.size);
}

module.exports = {
    STOP_WORDS,
    extractKeywords,
    computeOverlap
};
