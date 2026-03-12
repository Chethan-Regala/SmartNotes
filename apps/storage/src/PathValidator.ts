/**
 * @file PathValidator.ts
 * @description Secure path resolution and validation for the Smart Notes vault.
 *
 * All filesystem paths supplied by the application layer must be validated
 * before being handed to Node's `fs` APIs. Without this guard a maliciously
 * or accidentally crafted relative path such as `../../etc/passwd` could
 * escape the vault root and read or overwrite arbitrary files on the host.
 *
 * Every storage operation should call {@link resolveVaultPath} to obtain a
 * safe absolute path and then {@link validateVaultPath} to assert containment
 * before proceeding with any filesystem I/O.
 */

import path from "path";

// ---------------------------------------------------------------------------
// Path Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a vault-relative path to a normalised absolute filesystem path.
 *
 * The function joins `rootPath` and `relativePath`, then calls `path.resolve`
 * which both normalises redundant separators / dot segments and anchors the
 * result to an absolute path regardless of the process working directory.
 *
 * **This function alone does not guarantee containment.** Always follow up
 * with {@link validateVaultPath} to assert that the resolved path is still
 * inside the vault root.
 *
 * @param rootPath     - Absolute path to the vault's root directory.
 *                       Must be an absolute path; passing a relative root
 *                       produces unpredictable results.
 * @param relativePath - Path supplied by the caller, relative to `rootPath`.
 *                       May contain `.` or `..` segments — these are resolved
 *                       by `path.resolve` and then checked by the validator.
 * @returns The normalised, absolute path produced by joining the two inputs.
 *
 * @example
 * ```ts
 * resolveVaultPath("/vault", "notes/daily.md");
 * // → "/vault/notes/daily.md"
 *
 * resolveVaultPath("/vault", "./projects/../ideas/x.md");
 * // → "/vault/ideas/x.md"
 * ```
 */
export function resolveVaultPath(
  rootPath: string,
  relativePath: string
): string {
  // path.resolve joins the segments left-to-right and normalises the result
  // into an absolute path, collapsing any `.` and `..` components in one step.
  return path.resolve(rootPath, relativePath);
}

// ---------------------------------------------------------------------------
// Containment Validation
// ---------------------------------------------------------------------------

/**
 * Asserts that `resolvedPath` is located inside `rootPath`.
 *
 * ### Security rationale
 * A path traversal attack uses sequences such as `../` to walk up the
 * directory tree past the intended root. Even after normalisation a path
 * like `/vault/../etc/passwd` collapses to `/etc/passwd`, which is outside
 * the vault. This function prevents such escapes by verifying that the
 * normalised absolute path still begins with the normalised root prefix.
 *
 * The root prefix check uses a trailing-separator sentinel (`rootWithSep`)
 * to avoid false positives where the vault root is `/vault` but the resolved
 * path is `/vault-backup/secret` — without the sentinel both strings would
 * share the prefix `/vault`.
 *
 * ### Usage pattern
 * ```ts
 * const resolved = resolveVaultPath(rootPath, userSuppliedPath);
 * validateVaultPath(rootPath, resolved); // throws if outside vault
 * await fs.readFile(resolved, "utf8");   // safe to proceed
 * ```
 *
 * @param rootPath     - Absolute path to the vault's root directory.
 *                       Normalised internally before comparison.
 * @param resolvedPath - The fully resolved absolute path to validate.
 *                       Typically the return value of {@link resolveVaultPath}.
 *
 * @throws {Error} When `resolvedPath` does not begin with the vault root prefix,
 *                 indicating a path traversal attempt or misconfiguration.
 *
 * @example
 * ```ts
 * // Safe — resolvedPath is inside the vault.
 * validateVaultPath("/vault", "/vault/notes/daily.md"); // no-op
 *
 * // Unsafe — resolvedPath escapes the vault root.
 * validateVaultPath("/vault", "/etc/passwd");
 * // → throws Error: Path traversal detected …
 * ```
 */
export function validateVaultPath(
  rootPath: string,
  resolvedPath: string
): void {
  // Normalise both sides independently so that inconsistent trailing slashes
  // or mixed separators on Windows do not produce false negatives.
  const normalisedRoot = path.normalize(rootPath);
  const normalisedResolved = path.normalize(resolvedPath);

  // Append the platform separator so that a vault at "/vault" cannot be
  // bypassed by a resolved path of "/vault-escape/file.md".
  // We also accept an exact match (resolvedPath === root) to allow operations
  // directly on the vault root directory itself (e.g. listing).
  const rootWithSep = normalisedRoot.endsWith(path.sep)
    ? normalisedRoot
    : normalisedRoot + path.sep;

  const isInsideVault =
    normalisedResolved === normalisedRoot ||
    normalisedResolved.startsWith(rootWithSep);

  if (!isInsideVault) {
    throw new Error(
      `Path traversal detected: resolved path is outside the vault root.\n` +
        `  Vault root    : ${normalisedRoot}\n` +
        `  Resolved path : ${normalisedResolved}\n` +
        `Ensure all paths are relative to the vault root and contain no ` +
        `traversal segments (e.g. "../").`
    );
  }
}