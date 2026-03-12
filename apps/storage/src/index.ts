/**
 * @file index.ts
 * @description Public API surface for the Smart Notes filesystem storage module.
 *
 * All consumers — the Indexer, Retriever, Electron main process, and any other
 * internal package — should import exclusively from this entry point rather
 * than reaching into internal modules directly. This keeps the module boundary
 * stable and allows internal refactoring without breaking callers.
 *
 * ### What is exported
 * - {@link VaultManager}   — Concrete vault implementation; the primary class consumers instantiate.
 * - {@link VaultOptions}   — Configuration shape passed to the `VaultManager` constructor.
 * - {@link VaultNoteMeta}  — Lightweight note metadata returned by listing operations.
 * - {@link VaultService}   — Interface for typing references to the vault without coupling
 *                            to the concrete implementation (useful for testing with mocks).
 * - {@link writeFileAtomic} — Low-level atomic write utility, exposed for packages that
 *                             need crash-safe file persistence outside the vault abstraction.
 *
 * ### What is intentionally omitted
 * Internal helpers (`PathValidator`, `FileSystemUtils`), raw data shapes used
 * only inside the module (`VaultNote`), and demo code (`VaultDemo`) are not
 * exported. Consumers should never need to depend on implementation details.
 *
 * @example
 * ```ts
 * import { VaultManager, VaultService } from "@smart-notes/storage";
 * import type { VaultOptions, VaultNoteMeta } from "@smart-notes/storage";
 *
 * const vault: VaultService = new VaultManager({ rootPath: "/notes" });
 * const notes: VaultNoteMeta[] = await vault.listNotes();
 * ```
 */

/** Concrete vault manager — the primary class consumers instantiate. */
export { VaultManager } from "./VaultManager";

/**
 * Public type contracts for the storage module.
 *
 * Exported as `export type` to ensure they are erased at compile time and
 * never included in runtime bundles that do not need them.
 */
export type { VaultOptions, VaultNoteMeta, VaultService } from "./types";

/**
 * Atomic file write utility.
 *
 * Exposed for packages (e.g. the Indexer) that need crash-safe file
 * persistence independently of the vault abstraction layer.
 */
export { writeFileAtomic } from "./SafeWrite";