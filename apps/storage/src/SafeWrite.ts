/**
 * @file SafeWrite.ts
 * @description Atomic file writing utilities for the Smart Notes vault.
 *
 * A naive `fs.writeFile` call truncates the target file before writing new
 * content. If the process crashes, is killed, or loses power mid-write, the
 * file is left empty or partially written — corrupting the user's note.
 *
 * This module solves that problem with the **write-to-temp-then-rename**
 * pattern, which is the standard technique used by databases, editors, and
 * package managers to achieve crash-safe persistence:
 *
 * 1. Write the full content to a sibling `.tmp` file.
 * 2. `fsync` the temp file to guarantee the bytes reach the storage medium.
 * 3. Atomically `rename` the temp file over the target path.
 *
 * On POSIX systems `rename(2)` is guaranteed to be atomic by the kernel — the
 * target path will always point to either the old file or the new file, never
 * to a partially written state. On Windows, `fs.rename` provides a best-effort
 * equivalent that is safe for single-writer scenarios like Smart Notes.
 */

import { writeFile, rename, open } from "fs/promises";
import type { FileHandle } from "fs/promises";

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Writes `content` to `filePath` atomically, preventing partial writes.
 *
 * ### Why atomic writes matter
 * A regular `fs.writeFile` first truncates the destination file then writes
 * bytes incrementally. Any interruption between those two steps (crash, SIGKILL,
 * power loss) leaves the file empty or corrupted. Because Smart Notes operates
 * offline-first with no network backup, a corrupted note cannot be recovered.
 *
 * ### How this function stays safe
 * - Content is written to a temporary file (`<filePath>.tmp`) so the original
 *   file is untouched until the new content is fully on disk.
 * - `fsync` flushes the OS write-back cache to durable storage before the
 *   rename, preventing scenarios where the rename lands but the data is still
 *   only in a volatile cache.
 * - `rename` atomically replaces the target path in a single kernel operation.
 *   At no point is the target path missing or partially updated.
 *
 * ### Cleanup on failure
 * If any step throws, the `.tmp` file may be left on disk. This is intentional
 * — a stale `.tmp` file is harmless and will be overwritten on the next write
 * attempt. The original file is always preserved.
 *
 * @param filePath - Absolute path to the destination file.
 *                   The parent directory must already exist.
 * @param content  - UTF-8 Markdown string to write.
 * @returns A promise that resolves once the file has been durably written and
 *          the target path has been atomically updated.
 *
 * @throws {Error} If the temp file cannot be written, fsynced, or renamed.
 *                 The original file at `filePath` is left untouched on failure.
 *
 * @example
 * ```ts
 * await writeFileAtomic("/vault/notes/daily.md", "# Today\n\nHello.");
 * ```
 */
export async function writeFileAtomic(
  filePath: string,
  content: string
): Promise<void> {
  // Step 1 — Derive a sibling temp path.
  //
  // Placing the temp file in the same directory as the target is important:
  // `rename` is only guaranteed to be atomic when both paths are on the same
  // filesystem / mount point. A temp file in /tmp could be on a different
  // device, forcing the kernel to fall back to a non-atomic copy+delete.
  const tempPath = `${filePath}.tmp`;

  // Step 2 — Write the full content to the temp file.
  //
  // If the process dies here the original file is completely unaffected
  // because we have not touched it yet.
  await writeFile(tempPath, content, "utf8");

  // Step 3 — fsync the temp file to durable storage.
  //
  // `writeFile` may return before the OS has flushed its write-back cache.
  // Without fsync, a crash after the rename but before the cache flush can
  // leave the destination file pointing to an inode with no data. Opening the
  // file with the `r` flag (read) is sufficient to obtain a descriptor for
  // fsyncing without risking an accidental truncation.
  let fileHandle: FileHandle | undefined;

  try {
    fileHandle = await open(tempPath, "r");
    await fileHandle.sync();
  } finally {
    // Always close the handle — even if fsync throws — to avoid leaking
    // file descriptors. The error (if any) propagates naturally after this.
    await fileHandle?.close();
  }

  // Step 4 — Atomically replace the target path with the temp file.
  //
  // After this line completes, readers opening `filePath` will see the new
  // content. The old inode is released by the OS once all existing handles
  // to it are closed. The `.tmp` file no longer exists on disk.
  await rename(tempPath, filePath);
}