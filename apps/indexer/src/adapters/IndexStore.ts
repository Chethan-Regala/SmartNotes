import { NoteChunk } from "../types"

/**
 * Storage abstraction for indexed notes.
 * Allows plugging SQLite / vector DB / other stores.
 */
export interface IndexStore {
  /**
   * Store indexed chunks and embeddings.
   */
  saveChunks(
    notePath: string,
    chunks: NoteChunk[],
    embeddings: number[][]
  ): Promise<void>

  /**
   * Remove all chunks belonging to a note.
   */
  deleteNote(notePath: string): Promise<void>
}
