/**
 * @file HybridScorer.ts
 * @description Hybrid ranking utility for the Smart Notes retrieval engine.
 *
 * Combines lexical relevance scores (e.g. BM25 from SQLite FTS5) with semantic
 * similarity scores (cosine similarity between query and chunk embeddings) into
 * a single blended ranking signal.
 */

import { SearchCandidate, SearchResult, HybridScoreWeights } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Tolerance used when validating that alpha + beta ≈ 1.
 * Accounts for normal IEEE-754 floating-point rounding.
 */
const WEIGHT_SUM_TOLERANCE = 1e-6;

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Combines lexical and semantic scores into a ranked list of {@link SearchResult}s.
 *
 * ### Hybrid Ranking
 * Pure lexical search (BM25 / FTS) excels at exact keyword matching but misses
 * paraphrases and synonyms. Pure semantic search captures conceptual similarity
 * but can surface results that share no keywords with the query. Hybrid ranking
 * blends both signals to get the best of both worlds.
 *
 * ### Scoring Formula
 * For each candidate at index `i`:
 * ```
 * finalScore = (alpha × semanticScore[i]) + (beta × candidates[i].lexicalScore)
 * ```
 * `alpha` and `beta` should sum to `1.0` for a standard weighted average,
 * though values outside this range are accepted with a console warning.
 *
 * Results are returned **sorted in descending order** by `finalScore` so that
 * the most relevant chunk appears first.
 *
 * @param candidates      - Lexical search candidates produced by the retrieval store.
 *                          Each carries a `lexicalScore` and identifying metadata.
 * @param semanticScores  - Cosine similarity scores in the same order as `candidates`.
 *                          `semanticScores[i]` must correspond to `candidates[i]`.
 * @param weights         - Blending weights `{ alpha, beta }` applied to the
 *                          semantic and lexical scores respectively.
 *
 * @returns An array of {@link SearchResult} objects sorted by `finalScore` (desc).
 *
 * @throws {RangeError} When `candidates` and `semanticScores` have different lengths,
 *                      as a 1-to-1 correspondence is required for correct scoring.
 *
 * @example
 * ```ts
 * const results = scoreHybridResults(candidates, semanticScores, { alpha: 0.7, beta: 0.3 });
 * console.log(results[0].finalScore); // highest scoring chunk
 * ```
 */
export function scoreHybridResults(
  candidates: SearchCandidate[],
  semanticScores: number[],
  weights: HybridScoreWeights
): SearchResult[] {
  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------

  if (candidates.length !== semanticScores.length) {
    throw new RangeError(
      `scoreHybridResults: candidates and semanticScores must have the same length ` +
        `(got ${candidates.length} candidates and ${semanticScores.length} scores).`
    );
  }

  if (weights.alpha < 0 || weights.beta < 0) {
    throw new RangeError(
      `scoreHybridResults: weights.alpha and weights.beta must be non-negative ` +
        `(got ${weights.alpha} and ${weights.beta}).`
    );
  }

  const weightSum = weights.alpha + weights.beta;
  if (Math.abs(weightSum - 1) > WEIGHT_SUM_TOLERANCE) {
    throw new RangeError(
      `scoreHybridResults: weights.alpha (${weights.alpha}) + weights.beta (${weights.beta}) ` +
        `must sum to 1 (got ${weightSum}).`
    );
  }

  // ------------------------------------------------------------------
  // Scoring
  // ------------------------------------------------------------------

  const maxLexicalScore = candidates.reduce(
    (maxScore: number, candidate: SearchCandidate): number =>
      Math.max(maxScore, candidate.lexicalScore),
    0
  );

  const results: SearchResult[] = candidates.map(
    (candidate: SearchCandidate, i: number): SearchResult => {
      const semanticScore = semanticScores[i];
      const lexicalScore = candidate.lexicalScore;
      const normalizedLexicalScore =
        maxLexicalScore > 0 ? lexicalScore / maxLexicalScore : 0;
      const finalScore =
        weights.alpha * semanticScore +
        weights.beta * normalizedLexicalScore;

      return {
        chunkId: candidate.chunkId,
        notePath: candidate.notePath,
        text: candidate.text,
        lexicalScore,
        semanticScore,
        finalScore,
      };
    }
  );

  // ------------------------------------------------------------------
  // Ranking — descending by finalScore
  // ------------------------------------------------------------------

  results.sort(
    (a: SearchResult, b: SearchResult): number => b.finalScore - a.finalScore
  );

  return results;
}
