/**
 * Adapter interface for reading notes from the vault.
 * This keeps the indexing engine independent of the
 * underlying filesystem implementation.
 */
export interface VaultAdapter {
  /**
   * Read the contents of a note.
   */
  readNote(notePath: string): Promise<string>

  /**
   * List all notes in the vault.
   */
  listNotes(): Promise<string[]>
}
