import { NoteChunk } from "../types"

/**
 * Storage abstraction for indexed notes.
 * Allows plugging SQLite / vector DB / other stores.
 */
export interface IndexStore {
  /**
   * Atomically replace all indexed chunks and embeddings for the given notePath.
   *
   * Implementations must remove any previously stored chunks that no longer
   * exist after a note edit.
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
