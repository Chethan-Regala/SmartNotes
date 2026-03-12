/**
 * @file types.ts
 * @description Core type contracts for the Smart Notes filesystem vault.
 *
 * The vault is the canonical, offline-first store for all user notes. Every
 * note is a plain Markdown file on disk; these types define the shapes that
 * the rest of the storage module works with when reading, writing, and
 * organising those files.
 */

// ---------------------------------------------------------------------------
// Data Shapes
// ---------------------------------------------------------------------------

/**
 * Represents a markdown note that has been fully loaded from the vault.
 *
 * A `VaultNote` carries both the note's location within the vault (its
 * relative path) and its complete raw Markdown content. It is the primary
 * data transfer object used when reading or writing note bodies.
 *
 * @example
 * ```ts
 * const note: VaultNote = {
 *   path: "projects/gsoc/proposal.md",
 *   content: "# GSoC Proposal\n\nIntroduction...",
 * };
 * ```
 */
export interface VaultNote {
  /**
   * Path to the note relative to the vault root directory.
   * Uses forward slashes as separators regardless of the host OS.
   *
   * @example "daily/2024-03-01.md"
   * @example "projects/smart-notes/architecture.md"
   */
  path: string;

  /** The complete raw Markdown content of the note. */
  content: string;
}

/**
 * Lightweight metadata snapshot for a note stored inside the vault.
 *
 * `VaultNoteMeta` is returned by listing operations so the UI can render
 * file trees, sort by date, and display note titles without reading every
 * file's full content from disk.
 *
 * @example
 * ```ts
 * const meta: VaultNoteMeta = {
 *   path: "daily/2024-03-01.md",
 *   name: "2024-03-01.md",
 *   createdAt: 1709251200000,
 *   updatedAt: 1709337600000,
 * };
 * ```
 */
export interface VaultNoteMeta {
  /**
   * Path to the note relative to the vault root directory.
   * Mirrors the `path` field on {@link VaultNote} for consistency.
   */
  path: string;

  /**
   * The filename component of the note's path, including the `.md` extension.
   *
   * @example "proposal.md"
   */
  name: string;

  /**
   * Unix timestamp (milliseconds) when the note file was first created on disk.
   * Sourced from the file system's `birthtime` stat field.
   */
  createdAt: number;

  /**
   * Unix timestamp (milliseconds) when the note file was last modified on disk.
   * Sourced from the file system's `mtime` stat field.
   */
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options supplied to the vault manager at initialisation time.
 *
 * `VaultOptions` is intentionally minimal — the vault manager derives all
 * internal paths from the single `rootPath` anchor, keeping configuration
 * straightforward and reducing the surface area for misconfiguration.
 *
 * @example
 * ```ts
 * const options: VaultOptions = {
 *   rootPath: "/Users/alice/Documents/SmartNotesVault",
 * };
 * ```
 */
export interface VaultOptions {
  /**
   * Absolute path to the vault's root directory on the local filesystem.
   * All note paths stored in {@link VaultNote} and {@link VaultNoteMeta}
   * are interpreted relative to this root.
   *
   * Must be an absolute path; relative paths are not supported.
   *
   * @example "/home/user/notes"
   * @example "C:\\Users\\Alice\\SmartNotes"
   */
  rootPath: string;
}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

/**
 * Defines the complete set of operations supported by the vault manager.
 *
 * `VaultService` is the primary abstraction boundary between the rest of the
 * Smart Notes application and the underlying filesystem. By depending on this
 * interface rather than a concrete class, higher-level modules stay decoupled
 * from storage implementation details and remain straightforward to test with
 * mock implementations.
 *
 * ### Path conventions
 * All `path` arguments are relative to the vault root configured via
 * {@link VaultOptions}. The service implementation is responsible for
 * resolving and validating these paths before touching the filesystem.
 *
 * @example
 * ```ts
 * const vault: VaultService = new VaultManager({ rootPath: "/notes" });
 *
 * await vault.createNote("ideas/feature-x.md", "# Feature X\n");
 * const content = await vault.readNote("ideas/feature-x.md");
 * await vault.updateNote("ideas/feature-x.md", content + "\nMore detail.");
 * await vault.renameNote("ideas/feature-x.md", "projects/feature-x.md");
 * await vault.deleteNote("projects/feature-x.md");
 * ```
 */
export interface VaultService {
  /**
   * Creates a new note at the specified vault-relative path.
   *
   * Intermediate directories are created automatically if they do not exist.
   * Implementations should reject with an error if a note already exists at
   * the given path to prevent silent overwrites.
   *
   * @param path    - Vault-relative path for the new note (e.g. `"daily/today.md"`).
   * @param content - Initial Markdown content to write to the note.
   * @returns A promise that resolves when the note has been written to disk.
   */
  createNote(path: string, content: string): Promise<void>;

  /**
   * Reads and returns the full Markdown content of an existing note.
   *
   * @param path - Vault-relative path of the note to read.
   * @returns A promise resolving to the raw Markdown string stored on disk.
   * @throws When no file exists at the resolved path.
   */
  readNote(path: string): Promise<string>;

  /**
   * Overwrites the content of an existing note.
   *
   * Implementations should use an atomic write strategy (e.g. write to a
   * temporary file then rename) to prevent data loss if the process is
   * interrupted mid-write.
   *
   * @param path    - Vault-relative path of the note to update.
   * @param content - New Markdown content that replaces the existing content.
   * @returns A promise that resolves when the updated content has been flushed to disk.
   * @throws When no file exists at the resolved path.
   */
  updateNote(path: string, content: string): Promise<void>;

  /**
   * Permanently deletes a note from the vault.
   *
   * @param path - Vault-relative path of the note to delete.
   * @returns A promise that resolves when the file has been removed from disk.
   * @throws When no file exists at the resolved path.
   */
  deleteNote(path: string): Promise<void>;

  /**
   * Moves or renames a note within the vault.
   *
   * Intermediate directories required by `newPath` are created automatically.
   * Implementations should reject if a note already exists at `newPath`.
   *
   * @param oldPath - Vault-relative path of the note to move.
   * @param newPath - Vault-relative destination path for the note.
   * @returns A promise that resolves when the note has been moved on disk.
   * @throws When no file exists at `oldPath`, or a file already exists at `newPath`.
   */
  renameNote(oldPath: string, newPath: string): Promise<void>;

  /**
   * Lists metadata for every Markdown note currently stored in the vault.
   *
   * The returned array includes notes at all directory depths. Ordering is
   * left to the implementation (typically alphabetical by path or by
   * modification time) and may be sorted by the caller as needed.
   *
   * @returns A promise resolving to an array of {@link VaultNoteMeta} objects,
   *          one per `.md` file found within the vault root.
   */
  listNotes(): Promise<VaultNoteMeta[]>;

  /**
   * Creates a new empty folder at the specified vault-relative path.
   *
   * Intermediate parent directories are created automatically if they do not
   * exist. Implementations should reject if a file (not a directory) already
   * exists at the target path.
   *
   * @param path - Vault-relative path of the folder to create (e.g. `"projects/gsoc"`).
   * @returns A promise that resolves when the directory has been created on disk.
   */
  createFolder(path: string): Promise<void>;

  /**
   * Recursively deletes a folder and all of its contents from the vault.
   *
   * **This operation is destructive and irreversible.** Implementations should
   * validate that `path` is safely within the vault root before proceeding to
   * prevent accidental deletion outside the vault boundary.
   *
   * @param path - Vault-relative path of the folder to delete.
   * @returns A promise that resolves when the folder and its contents have
   *          been removed from disk.
   * @throws When no directory exists at the resolved path.
   */
  deleteFolder(path: string): Promise<void>;
}