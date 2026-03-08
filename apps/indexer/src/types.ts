/**
 * Represents a semantic chunk extracted from a note.
 */
export type NoteChunk = {
  id: string
  notePath: string
  text: string
  position: number
}

/**
 * Job sent to the indexing queue.
 */
export type IndexJob = {
  type: "update" | "delete"
  notePath: string
}

/**
 * Result produced by the indexing pipeline.
 */
export type IndexResult = {
  notePath: string
  chunks: NoteChunk[]
  embeddings: number[][]
}
