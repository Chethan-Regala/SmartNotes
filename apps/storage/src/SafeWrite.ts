/**
 * @file SafeWrite.ts
 * @description Atomic file writing utilities for the Smart Notes vault.
 *
 * A naive `fs.writeFile` call truncates the target file before writing new
 * content. If the process crashes, is killed, or loses power mid-write, the
 * file is left empty or partially written, corrupting the user's note.
 *
 * This module solves that problem with the write-to-temp-then-rename pattern,
 * which is the standard technique used by databases, editors, and package
 * managers to achieve crash-safe persistence:
 *
 * 1. Write the full content to a sibling `.tmp` file.
 * 2. Best-effort `fsync` the temp file on platforms that support it reliably.
 * 3. Atomically `rename` the temp file over the target path.
 *
 * On POSIX systems `rename(2)` is guaranteed to be atomic by the kernel - the
 * target path will always point to either the old file or the new file, never
 * to a partially written state. On Windows, `fs.rename` provides a best-effort
 * equivalent that is safe for single-writer scenarios like Smart Notes.
 */

import { open, rename, writeFile } from "fs/promises";
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
 * - A best-effort `fsync` flushes the OS write-back cache to durable storage
 *   before the rename on platforms where this succeeds reliably.
 * - `rename` atomically replaces the target path in a single kernel operation.
 *   At no point is the target path missing or partially updated.
 *
 * ### Cleanup on failure
 * If any step throws, the `.tmp` file may be left on disk. This is intentional
 * - a stale `.tmp` file is harmless and will be overwritten on the next write
 * attempt. The original file is always preserved.
 *
 * @param filePath - Absolute path to the destination file.
 *                   The parent directory must already exist.
 * @param content  - UTF-8 Markdown string to write.
 * @returns A promise that resolves once the file has been written and the
 *          target path has been atomically updated.
 *
 * @throws {Error} If the temp file cannot be written or renamed. A failed
 *                 best-effort `fsync` is ignored to preserve cross-platform
 *                 compatibility, especially on Windows.
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
  // Place the temp file beside the destination so rename stays on the same
  // filesystem and retains its atomic replace semantics.
  const tempPath = `${filePath}.tmp`;

  // If the process dies here the original file is still untouched.
  await writeFile(tempPath, content, "utf8");

  let fileHandle: FileHandle | undefined;

  try {
    // Open read-only to obtain a descriptor for sync without risking truncation.
    fileHandle = await open(tempPath, "r");
    await fileHandle.sync();
  } catch {
    // Some Windows environments reject fsync on newly written files with EPERM.
    // The atomic rename is still the required correctness boundary for desktop use.
  } finally {
    await fileHandle?.close();
  }

  await rename(tempPath, filePath);
}
