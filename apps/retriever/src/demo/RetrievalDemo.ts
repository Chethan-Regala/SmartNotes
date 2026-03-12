/**
 * @file RetrievalDemo.ts
 * @description End-to-end demonstration of the Smart Notes hybrid retrieval pipeline.
 *
 * This file wires together lightweight mock implementations of {@link RetrievalStore}
 * and {@link QueryEmbeddingProvider} to show how {@link RetrievalEngine} orchestrates
 * the full six-stage retrieval pipeline without requiring a real database or model.
 *
 * Run with:
 *   npm run build
 *   node dist/demo/RetrievalDemo.js
 */

import { RetrievalEngine } from "../RetrievalEngine";
import {
  RetrievalStore,
  QueryEmbeddingProvider,
  HybridScoreWeights,
  SearchCandidate,
} from "../types";

// ---------------------------------------------------------------------------
// Mock Store
// ---------------------------------------------------------------------------

/**
 * In-memory mock implementation of {@link RetrievalStore}.
 *
 * Returns a fixed set of lexical candidates and pre-computed embeddings so the
 * demo can run without a real SQLite database. In production this would be
 * replaced by a concrete adapter that queries FTS5 and a vector table.
 */
class MockStore implements RetrievalStore {
  /**
   * Simulates a full-text search by returning a fixed list of candidate chunks.
   *
   * The `query` and `limit` parameters are accepted to satisfy the interface
   * contract but are intentionally unused in this mock — all candidates are
   * always returned.
   *
   * @param query - The user's search query (unused in mock).
   * @param limit - Maximum results requested (unused in mock).
   * @returns A promise resolving to three hard-coded {@link SearchCandidate} objects.
   */
  async searchLexical(
    query: string,
    limit: number
  ): Promise<SearchCandidate[]> {
    console.log(`  [MockStore] searchLexical("${query}", limit=${limit})`);

    return [
      {
        chunkId: "1",
        notePath: "note1.md",
        text: "JavaScript async patterns",
        lexicalScore: 0.9,
      },
      {
        chunkId: "2",
        notePath: "note2.md",
        text: "Node.js event loop guide",
        lexicalScore: 0.8,
      },
      {
        chunkId: "3",
        notePath: "note3.md",
        text: "Understanding promises",
        lexicalScore: 0.7,
      },
    ];
  }

  /**
   * Returns pre-computed embedding vectors for the requested chunk IDs.
   *
   * Vectors are intentionally simple 3-dimensional floats so the cosine
   * similarity calculations are easy to verify by hand during development.
   *
   * @param chunkIds - Chunk identifiers whose embeddings should be loaded (unused in mock).
   * @returns A promise resolving to one fixed embedding vector per requested ID.
   */
  async loadEmbeddings(chunkIds: string[]): Promise<number[][]> {
    console.log(`  [MockStore] loadEmbeddings([${chunkIds.join(", ")}])`);

    // One vector per candidate, in the same order as chunkIds.
    return [
      [0.1, 0.2, 0.3], // embedding for chunkId "1"
      [0.2, 0.1, 0.4], // embedding for chunkId "2"
      [0.5, 0.4, 0.1], // embedding for chunkId "3"
    ];
  }
}

// ---------------------------------------------------------------------------
// Mock Embedder
// ---------------------------------------------------------------------------

/**
 * In-memory mock implementation of {@link QueryEmbeddingProvider}.
 *
 * Returns a constant query vector so the demo produces deterministic, easily
 * verifiable similarity scores without needing a real embedding model. A
 * production implementation would delegate to an ONNX runtime or a local
 * transformer model.
 */
class MockEmbedder implements QueryEmbeddingProvider {
  /**
   * Generates a fixed embedding vector for any query string.
   *
   * @param query - The user's search query (logged but otherwise unused in mock).
   * @returns A promise resolving to the constant vector `[0.2, 0.2, 0.2]`.
   */
  async embedQuery(query: string): Promise<number[]> {
    console.log(`  [MockEmbedder] embedQuery("${query}")`);
    return [0.2, 0.2, 0.2];
  }
}

// ---------------------------------------------------------------------------
// Demo Runner
// ---------------------------------------------------------------------------

/**
 * Runs a complete end-to-end demonstration of the hybrid retrieval engine.
 *
 * ### What this demo shows
 * 1. Wiring up mock store and embedder dependencies.
 * 2. Configuring hybrid score weights (60 % semantic, 40 % lexical).
 * 3. Issuing a search query through {@link RetrievalEngine}.
 * 4. Printing the ranked {@link SearchResult} array to stdout.
 *
 * The output lets developers verify that:
 * - All six pipeline stages execute in the correct order.
 * - Final scores are a weighted blend of lexical and semantic signals.
 * - Results arrive sorted by `finalScore` in descending order.
 */
async function runDemo(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Smart Notes — Hybrid Retrieval Engine Demo");
  console.log("=".repeat(60));

  // ── Step 1: Instantiate dependencies ──────────────────────────────
  const store = new MockStore();
  const embedder = new MockEmbedder();

  // ── Step 2: Configure hybrid weights ──────────────────────────────
  // alpha drives the semantic (cosine similarity) contribution.
  // beta  drives the lexical  (BM25 / FTS5)      contribution.
  const weights: HybridScoreWeights = {
    alpha: 0.6, // 60 % semantic
    beta: 0.4,  // 40 % lexical
  };

  console.log("\nWeights:");
  console.log(`  alpha (semantic) = ${weights.alpha}`);
  console.log(`  beta  (lexical)  = ${weights.beta}`);

  // ── Step 3: Build the engine ───────────────────────────────────────
  const engine = new RetrievalEngine(store, embedder, weights);

  // ── Step 4: Run the search ─────────────────────────────────────────
  const query = "async javascript";
  const limit = 5;

  console.log(`\nRunning search: "${query}" (limit=${limit})\n`);

  const results = await engine.search(query, limit);

  // ── Step 5: Print results ──────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log(`  Results (${results.length} returned)`);
  console.log("─".repeat(60));

  if (results.length === 0) {
    console.log("  No results found.");
  } else {
    results.forEach((result, index) => {
      console.log(`\n  #${index + 1}`);
      console.log(`    chunkId       : ${result.chunkId}`);
      console.log(`    notePath      : ${result.notePath}`);
      console.log(`    text          : ${result.text}`);
      console.log(`    lexicalScore  : ${result.lexicalScore.toFixed(4)}`);
      console.log(`    semanticScore : ${result.semanticScore.toFixed(4)}`);
      console.log(`    finalScore    : ${result.finalScore.toFixed(4)}`);
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("  Demo complete.");
  console.log("=".repeat(60) + "\n");
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

runDemo().catch((error: unknown) => {
  console.error("Demo failed with error:", error);
  process.exit(1);
});
