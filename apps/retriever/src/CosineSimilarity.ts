/**
 * @file CosineSimilarity.ts
 * @description Utility functions for computing cosine similarity between
 * dense embedding vectors. Used by the hybrid retrieval engine to measure
 * semantic closeness between a query embedding and stored chunk embeddings.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the Euclidean magnitude (L2 norm) of a vector.
 *
 * The magnitude is defined as:
 * ```
 * ||v|| = sqrt(v[0]² + v[1]² + ... + v[n-1]²)
 * ```
 *
 * @param v - A dense numeric vector.
 * @returns The non-negative scalar magnitude of `v`.
 */
export function vectorMagnitude(v: number[]): number {
  let sumOfSquares = 0;
  for (let i = 0; i < v.length; i++) {
    sumOfSquares += v[i] * v[i];
  }
  return Math.sqrt(sumOfSquares);
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Computes the cosine similarity between two dense numeric vectors.
 *
 * Cosine similarity measures the cosine of the angle between two vectors in
 * an inner-product space. It is widely used in semantic search to gauge how
 * similar two embedding vectors are, regardless of their magnitude:
 *
 * ```
 * cosineSimilarity(A, B) = (A · B) / (||A|| × ||B||)
 * ```
 *
 * The result lies in the range **[-1, 1]**:
 * - `1`  → vectors point in the same direction (identical semantics)
 * - `0`  → vectors are orthogonal (unrelated)
 * - `-1` → vectors point in opposite directions
 *
 * For typical text embeddings produced by transformer models the practical
 * range is **[0, 1]**.
 *
 * ### Validation
 * - Throws a `RangeError` if `a` and `b` have different lengths, because the
 *   dot product is undefined for vectors of unequal dimension.
 * - Returns `0` if either vector has zero magnitude to avoid division by zero;
 *   a zero vector carries no directional information so similarity is
 *   treated as neutral.
 *
 * ### Performance
 * The dot product and both sum-of-squares accumulators are computed in a
 * **single pass** over the vectors, avoiding extra allocations or iterations.
 *
 * @param a - First dense numeric vector (e.g. a query embedding).
 * @param b - Second dense numeric vector (e.g. a chunk embedding).
 * @returns Cosine similarity in the range [-1, 1], or 0 if either vector
 *          has zero magnitude.
 * @throws {RangeError} When `a` and `b` have different lengths.
 *
 * @example
 * ```ts
 * const score = cosineSimilarity([1, 0, 0], [1, 0, 0]); // 1
 * const score = cosineSimilarity([1, 0],    [0, 1]);    // 0
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new RangeError(
      `cosineSimilarity: vectors must have the same length ` +
        `(got ${a.length} and ${b.length}).`
    );
  }

  let dotProduct = 0;
  let sumOfSquaresA = 0;
  let sumOfSquaresB = 0;

  // Single pass: accumulate dot product and both magnitudes simultaneously.
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    sumOfSquaresA += a[i] * a[i];
    sumOfSquaresB += b[i] * b[i];
  }

  const magnitudeA = Math.sqrt(sumOfSquaresA);
  const magnitudeB = Math.sqrt(sumOfSquaresB);

  // Guard against division by zero for zero-magnitude vectors.
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  // Clamp to [-1, 1] to correct for floating-point drift.
  return Math.max(-1, Math.min(1, dotProduct / (magnitudeA * magnitudeB)));
}