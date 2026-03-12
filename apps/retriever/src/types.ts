/**
 * @file types.ts
 * @description Core types and interfaces for the Smart Notes hybrid retrieval engine.
 *
 * This module defines the foundational data structures and contracts used across
 * the retrieval pipeline — from lexical search candidates to final ranked results,
 * storage access, embedding generation, and scoring configuration.
 */

// ---------------------------------------------------------------------------
// Search Candidates & Results
// ---------------------------------------------------------------------------

/**
 * Represents a chunk returned from lexical search (e.g., SQLite FTS5).
 *
 * A `SearchCandidate` is the raw result of a full-text search query before
 * semantic re-ranking. It carries the chunk's identity, source note path,
 * raw text, and the lexical relevance score assigned by the search engine.
 */
export interface SearchCandidate {
  /** Unique identifier for this text chunk within the note store. */
  chunkId: string;

  /** Absolute or relative file path of the note this chunk belongs to. */
  notePath: string;

  /** The raw text content of this chunk. */
  text: string;

  /**
   * Relevance score assigned by the lexical search engine (e.g., BM25 from FTS5).
   * Higher values indicate stronger lexical relevance to the query.
   */
  lexicalScore: number;
}

/**
 * Represents a final ranked search result after hybrid scoring.
 *
 * A `SearchResult` extends the information in a `SearchCandidate` by adding
 * the semantic similarity score and the final blended score produced by the
 * hybrid ranking step. These results are what the UI ultimately displays.
 */
export interface SearchResult {
  /** Unique identifier for this text chunk within the note store. */
  chunkId: string;

  /** Absolute or relative file path of the note this chunk belongs to. */
  notePath: string;

  /** The raw text content of this chunk. */
  text: string;

  /**
   * Relevance score from lexical search (e.g., BM25).
   * Preserved from the original `SearchCandidate` for transparency and debugging.
   */
  lexicalScore: number;

  /**
   * Cosine similarity score between the query embedding and the chunk embedding.
   * Ranges from -1 (opposite) to 1 (identical); typically 0–1 for note content.
   */
  semanticScore: number;

  /**
   * Final blended score used to rank this result.
   * Computed as a weighted combination of `lexicalScore` and `semanticScore`
   * using the configured {@link HybridScoreWeights}.
   */
  finalScore: number;
}

// ---------------------------------------------------------------------------
// Storage Abstraction
// ---------------------------------------------------------------------------

/**
 * Abstracts all database access required by the retrieval engine.
 *
 * Implementations of this interface handle the underlying persistence layer
 * (e.g., SQLite with FTS5 for lexical search and a vector table for embeddings),
 * keeping the retrieval logic decoupled from storage details.
 */
export interface RetrievalStore {
  /**
   * Performs a lexical (full-text) search and returns the top matching chunks.
   *
   * @param query - The user's raw search query string.
   * @param limit - Maximum number of candidates to return.
   * @returns A promise that resolves to an ordered array of {@link SearchCandidate} objects.
   */
  searchLexical(query: string, limit: number): Promise<SearchCandidate[]>;

  /**
   * Loads precomputed embeddings for the specified chunk IDs.
   *
   * The returned array preserves the same order as the input `chunkIds`.
   * If an embedding is missing for a given ID, implementations should
   * document their fallback behaviour (e.g., return a zero vector or omit it).
   *
   * @param chunkIds - Array of chunk identifiers whose embeddings should be loaded.
   * @returns A promise resolving to a 2-D array where each inner array is a
   *          dense floating-point embedding vector for the corresponding chunk.
   */
  loadEmbeddings(chunkIds: string[]): Promise<number[][]>;
}

// ---------------------------------------------------------------------------
// Embedding Provider
// ---------------------------------------------------------------------------

/**
 * Responsible for generating embedding vectors for user queries at search time.
 *
 * The retrieval engine uses this interface to convert a raw query string into
 * the same embedding space as the stored chunk embeddings, enabling cosine
 * similarity scoring.
 *
 * Implementations may delegate to a local ONNX model, a bundled transformer,
 * or any other embedding backend that fits the offline-first constraint.
 */
export interface QueryEmbeddingProvider {
  /**
   * Generates a dense embedding vector for the given query string.
   *
   * @param query - The user's search query to embed.
   * @returns A promise resolving to a floating-point vector representing the
   *          semantic meaning of the query in the model's embedding space.
   */
  embedQuery(query: string): Promise<number[]>;
}

// ---------------------------------------------------------------------------
// Scoring Configuration
// ---------------------------------------------------------------------------

/**
 * Weights used to blend lexical and semantic scores in hybrid ranking.
 *
 * The final score for a result is typically computed as:
 * ```
 * finalScore = (alpha * normalizedLexicalScore) + (beta * semanticScore)
 * ```
 * `alpha` and `beta` should sum to 1.0 for a straightforward weighted average,
 * but the engine may support other configurations depending on the use case.
 */
export interface HybridScoreWeights {
  /**
   * Weight applied to the normalised lexical (BM25) score.
   * A higher value biases results towards keyword relevance.
   */
  alpha: number;

  /**
   * Weight applied to the semantic (cosine similarity) score.
   * A higher value biases results towards conceptual/semantic relevance.
   */
  beta: number;
}