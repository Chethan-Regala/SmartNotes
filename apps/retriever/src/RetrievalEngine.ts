/**
 * @file RetrievalEngine.ts
 * @description Core orchestrator for the Smart Notes hybrid retrieval pipeline.
 *
 * The `RetrievalEngine` coordinates all stages of hybrid search — from lexical
 * candidate retrieval and embedding generation through to semantic scoring and
 * final ranked output. It is the single entry point consumers call at search time.
 */

import type {
  RetrievalStore,
  QueryEmbeddingProvider,
  HybridScoreWeights,
  SearchResult,
} from "./types";
import { cosineSimilarity } from "./CosineSimilarity";
import { scoreHybridResults } from "./HybridScorer";

/**
 * Orchestrates the full hybrid retrieval pipeline for Smart Notes.
 *
 * ### Pipeline Overview
 * ```
 * query
 *   │
 *   ├─ 1. Lexical search      → SearchCandidate[]        (RetrievalStore.searchLexical)
 *   ├─ 2. Query embedding     → number[]                 (QueryEmbeddingProvider.embedQuery)
 *   ├─ 3. Chunk embeddings    → number[][]               (RetrievalStore.loadEmbeddings)
 *   ├─ 4. Cosine similarity   → number[]                 (CosineSimilarity.cosineSimilarity)
 *   ├─ 5. Hybrid scoring      → SearchResult[]  sorted   (HybridScorer.scoreHybridResults)
 *   └─ 6. Slice to limit      → SearchResult[]  final
 * ```
 *
 * The engine is intentionally stateless beyond its injected dependencies, making
 * it straightforward to unit-test by supplying mock implementations of
 * {@link RetrievalStore} and {@link QueryEmbeddingProvider}.
 */
export class RetrievalEngine {
  /**
   * Creates a new `RetrievalEngine` instance.
   *
   * @param store   - Storage adapter that provides lexical search and embedding
   *                  retrieval. Typically backed by SQLite FTS5 + a vector table.
   * @param embedder - Provider that converts a raw query string into a dense
   *                   embedding vector in the same space as the stored chunk embeddings.
   * @param weights  - Blending weights `{ alpha, beta }` controlling how much the
   *                   semantic score (alpha) and lexical score (beta) each contribute
   *                   to the final ranking. Should sum to 1 for a standard weighted
   *                   average.
   */
  constructor(
    private readonly store: RetrievalStore,
    private readonly embedder: QueryEmbeddingProvider,
    private readonly weights: HybridScoreWeights
  ) {}

  /**
   * Executes a hybrid search for the given query and returns the top-ranked results.
   *
   * The method runs the six-stage retrieval pipeline described in the class-level
   * documentation. Each stage is designed to fail fast — an empty lexical result
   * set short-circuits the pipeline immediately and returns `[]` without incurring
   * the cost of embedding generation or similarity computation.
   *
   * @param query - The user's natural-language search query.
   * @param limit - Maximum number of results to return. Applied both to the
   *                upstream lexical search and to the final ranked output.
   * @returns A promise that resolves to an array of {@link SearchResult} objects
   *          sorted in descending order by `finalScore`, containing at most
   *          `limit` entries.
   *
   * @example
   * ```ts
   * const engine = new RetrievalEngine(store, embedder, { alpha: 0.7, beta: 0.3 });
   * const results = await engine.search("transformer attention mechanism", 10);
   * results.forEach(r => console.log(r.finalScore, r.notePath));
   * ```
   */
  async search(query: string, limit: number): Promise<SearchResult[]> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError(
        `RetrievalEngine.search: limit must be a positive integer (got ${limit}).`
      );
    }

    // ------------------------------------------------------------------
    // Step 1 — Lexical search
    // Retrieve the top `limit` candidate chunks using full-text search.
    // Short-circuit immediately when no lexical matches exist — there is
    // nothing to re-rank semantically.
    // ------------------------------------------------------------------
    const candidatePoolSize = limit * 5;
    const candidates = await this.store.searchLexical(query, candidatePoolSize);

    if (candidates.length === 0) {
      return [];
    }

    // ------------------------------------------------------------------
    // Step 2 — Query embedding
    // Encode the raw query string into a dense vector so it can be
    // compared against the stored chunk embeddings via cosine similarity.
    // ------------------------------------------------------------------
    const queryEmbedding = await this.embedder.embedQuery(query);

    // ------------------------------------------------------------------
    // Step 3 — Chunk embeddings
    // Load precomputed embeddings for every candidate chunk in one batch
    // call to minimise round-trip overhead against the storage layer.
    // ------------------------------------------------------------------
    const chunkIds = candidates.map((c) => c.chunkId);
    const embeddings = await this.store.loadEmbeddings(chunkIds);

    // ------------------------------------------------------------------
    // Step 4 — Cosine similarity
    // Compute a scalar semantic score for each candidate by measuring the
    // cosine angle between the query embedding and the chunk embedding.
    // Scores lie in [-1, 1]; typical text embeddings produce values in [0, 1].
    // ------------------------------------------------------------------
    const semanticScores = embeddings.map(
      (embedding: number[]): number =>
        (cosineSimilarity(queryEmbedding, embedding) + 1) / 2
    );

    // ------------------------------------------------------------------
    // Step 5 — Hybrid scoring & ranking
    // Blend lexical and semantic scores using the configured weights and
    // return the candidates sorted in descending order by finalScore.
    // ------------------------------------------------------------------
    const results = scoreHybridResults(candidates, semanticScores, this.weights);

    // ------------------------------------------------------------------
    // Step 6 — Truncate to limit
    // scoreHybridResults may return all candidates sorted; we honour the
    // caller's requested limit here at the output boundary.
    // ------------------------------------------------------------------
    return results.slice(0, limit);
  }
}
