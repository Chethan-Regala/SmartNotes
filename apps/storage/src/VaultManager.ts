/**
 * @file VaultManager.ts
 * @description Concrete implementation of {@link VaultService} for the Smart
 * Notes offline-first filesystem vault.
 *
 * `VaultManager` is the single authoritative gateway between the application
 * layer and the markdown files stored on disk. Every operation resolves and
 * validates its path through {@link PathValidator} before touching the
 * filesystem, and every write goes through {@link writeFileAtomic} to prevent
 * corruption on crash or power loss.
 */

import fs from "fs/promises";
import path from "path";

import {
  VaultOptions,
  VaultService,
  VaultNoteMeta,
} from "./types";
import { resolveVaultPath, validateVaultPath } from "./PathValidator";
import { writeFileAtomic } from "./SafeWrite";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively walks a directory tree and collects the absolute paths of every
 * file that matches `predicate`.
 *
 * @param dir       - Absolute path of the directory to walk.
 * @param predicate - Optional filter; defaults to accepting every file.
 * @returns A flat array of absolute file paths found beneath `dir`.
 */
async function walkDirectory(
  dir: string,
  predicate: (filePath: string) => boolean = () => true
): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkDirectory(entryPath, predicate);
      results.push(...nested);
    } else if (entry.isFile() && predicate(entryPath)) {
      results.push(entryPath);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// VaultManager
// ---------------------------------------------------------------------------

/**
 * Manages markdown notes stored inside a single vault directory on disk.
 *
 * All path arguments accepted by public methods are **vault-relative** — they
 * are resolved against the configured root path and validated for containment
 * before any filesystem I/O occurs. This prevents path traversal attacks and
 * accidental access outside the vault.
 *
 * @example
 * ```ts
 * const vault = new VaultManager({ rootPath: "/home/alice/notes" });
 *
 * await vault.createNote("daily/2024-03-01.md", "# Today\n");
 * const content = await vault.readNote("daily/2024-03-01.md");
 * await vault.deleteNote("daily/2024-03-01.md");
 * ```
 */
export class VaultManager implements VaultService {
  /**
   * @param options - Vault configuration. `options.rootPath` must be an
   *                  absolute path to an existing directory.
   */
  constructor(private readonly options: VaultOptions) {}

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Resolves a vault-relative path to a safe, validated absolute path.
   *
   * Combines {@link resolveVaultPath} and {@link validateVaultPath} into a
   * single convenience call used by every public method.
   *
   * @param relativePath - Vault-relative path provided by the caller.
   * @returns The normalised absolute path guaranteed to be inside the vault.
   * @throws {Error} If the resolved path escapes the vault root.
   */
  private resolveSafe(relativePath: string): string {
    const resolved = resolveVaultPath(this.options.rootPath, relativePath);
    validateVaultPath(this.options.rootPath, resolved);
    return resolved;
  }

  // -------------------------------------------------------------------------
  // VaultService implementation
  // -------------------------------------------------------------------------

  /**
   * Creates a new note at the given vault-relative path.
   *
   * Intermediate directories are created automatically so callers do not need
   * to call {@link createFolder} first. The write is performed atomically via
   * {@link writeFileAtomic} to guarantee the file is never partially written.
   *
   * @param notePath - Vault-relative path for the new note (e.g. `"daily/today.md"`).
   * @param content  - Initial Markdown content.
   * @throws {Error} If the path escapes the vault or the write fails.
   */
  async createNote(notePath: string, content: string): Promise<void> {
    const resolved = this.resolveSafe(notePath);

    // Ensure the parent directory exists before writing.
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await writeFileAtomic(resolved, content);
  }

  /**
   * Reads and returns the full Markdown content of an existing note.
   *
   * @param notePath - Vault-relative path of the note to read.
   * @returns The raw UTF-8 string stored on disk.
   * @throws {Error} If the path escapes the vault or the file does not exist.
   */
  async readNote(notePath: string): Promise<string> {
    const resolved = this.resolveSafe(notePath);
    return fs.readFile(resolved, "utf8");
  }

  /**
   * Overwrites the content of an existing note.
   *
   * Behaviourally identical to {@link createNote} — both use
   * {@link writeFileAtomic} which safely replaces any existing file. The
   * method is exposed separately to make call-site intent explicit.
   *
   * @param notePath - Vault-relative path of the note to update.
   * @param content  - New Markdown content that replaces the existing body.
   * @throws {Error} If the path escapes the vault or the write fails.
   */
  async updateNote(notePath: string, content: string): Promise<void> {
    const resolved = this.resolveSafe(notePath);

    // Parent directory must already exist for an update, but we create it
    // defensively to keep the operation idempotent.
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await writeFileAtomic(resolved, content);
  }

  /**
   * Permanently deletes a note from the vault.
   *
   * @param notePath - Vault-relative path of the note to delete.
   * @throws {Error} If the path escapes the vault or the file does not exist.
   */
  async deleteNote(notePath: string): Promise<void> {
    const resolved = this.resolveSafe(notePath);
    await fs.unlink(resolved);
  }

  /**
   * Moves or renames a note within the vault.
   *
   * Both the source and destination paths are independently resolved and
   * validated to ensure neither escapes the vault root. The parent directory
   * of `newPath` is created automatically if it does not exist.
   *
   * @param oldPath - Vault-relative path of the note to move.
   * @param newPath - Vault-relative destination path.
   * @throws {Error} If either path escapes the vault, the source does not
   *                 exist, or the rename operation fails.
   */
  async renameNote(oldPath: string, newPath: string): Promise<void> {
    const resolvedOld = this.resolveSafe(oldPath);
    const resolvedNew = this.resolveSafe(newPath);

    // Ensure the destination directory exists before the rename.
    await fs.mkdir(path.dirname(resolvedNew), { recursive: true });
    await fs.rename(resolvedOld, resolvedNew);
  }

  /**
   * Lists metadata for every Markdown file currently stored in the vault.
   *
   * Performs a recursive directory walk starting at the vault root, filters
   * for `.md` files, and resolves `stat` metadata for each one. Non-markdown
   * files (e.g. attachments) are ignored.
   *
   * @returns An array of {@link VaultNoteMeta} objects, one per `.md` file,
   *          sorted alphabetically by vault-relative path.
   * @throws {Error} If the vault root cannot be read.
   */
  async listNotes(): Promise<VaultNoteMeta[]> {
    const root = this.options.rootPath;

    const absolutePaths = await walkDirectory(
      root,
      (filePath) => filePath.endsWith(".md")
    );

    const metas = await Promise.all(
      absolutePaths.map(async (absolutePath): Promise<VaultNoteMeta> => {
        const stat = await fs.stat(absolutePath);

        // Express the path relative to the vault root using forward slashes
        // for consistency across platforms.
        const relativePath = path
          .relative(root, absolutePath)
          .split(path.sep)
          .join("/");

        return {
          path: relativePath,
          name: path.basename(absolutePath),
          createdAt: stat.birthtimeMs,
          updatedAt: stat.mtimeMs,
        };
      })
    );

    // Return a stable, predictable order regardless of filesystem traversal order.
    return metas.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Creates a new empty folder at the specified vault-relative path.
   *
   * Intermediate parent directories are created automatically. Calling this
   * method on a path that already exists as a directory is a no-op.
   *
   * @param folderPath - Vault-relative path of the folder to create.
   * @throws {Error} If the path escapes the vault or a non-directory file
   *                 already exists at the target path.
   */
  async createFolder(folderPath: string): Promise<void> {
    const resolved = this.resolveSafe(folderPath);
    await fs.mkdir(resolved, { recursive: true });
  }

  /**
   * Recursively deletes a folder and all of its contents from the vault.
   *
   * **This operation is irreversible.** The path is validated against the
   * vault root before deletion to prevent accidental removal of directories
   * outside the vault boundary.
   *
   * @param folderPath - Vault-relative path of the folder to delete.
   * @throws {Error} If the path escapes the vault or the directory does not exist.
   */
  async deleteFolder(folderPath: string): Promise<void> {
    const resolved = this.resolveSafe(folderPath);
    await fs.rm(resolved, { recursive: true });
  }
}