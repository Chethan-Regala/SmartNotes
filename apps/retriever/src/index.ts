/**
 * @file index.ts
 * @description Public API surface for the Smart Notes hybrid retrieval engine.
 *
 * Consumers should import exclusively from this entry point rather than
 * reaching into internal modules directly. This keeps the module boundary
 * stable and allows internal refactoring without breaking callers.
 *
 * @example
 * ```ts
 * import { RetrievalEngine, cosineSimilarity, scoreHybridResults } from "@smart-notes/retriever";
 * import type { SearchResult, HybridScoreWeights } from "@smart-notes/retriever";
 * ```
 */

/** Core orchestrator for the hybrid retrieval pipeline. */
export { RetrievalEngine } from "./RetrievalEngine";

/** Cosine similarity utility for semantic vector comparison. */
export { cosineSimilarity } from "./CosineSimilarity";

/** Hybrid scoring and ranking utility. */
export { scoreHybridResults } from "./HybridScorer";

/**
 * All shared types and interfaces:
 * SearchCandidate, SearchResult, RetrievalStore,
 * QueryEmbeddingProvider, HybridScoreWeights
 */
export * from "./types";
