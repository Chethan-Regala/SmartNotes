/**
 * Adapter interface for embedding generation.
 * Allows plugging different embedding models.
 */
export interface EmbeddingAdapter {
  /**
   * Generate embeddings for chunks.
   */
  embed(chunks: string[]): Promise<number[][]>
}
