/**
 * @file VaultDemo.ts
 * @description End-to-end demonstration of the Smart Notes filesystem vault.
 *
 * Walks through every VaultManager operation in sequence so contributors and
 * reviewers can verify the storage layer works correctly against a real
 * filesystem without needing a running application.
 *
 * Run with:
 *   npx ts-node apps/storage/src/demo/VaultDemo.ts
 *
 * A temporary `demo-vault/` directory is created in the current working
 * directory and fully cleaned up by the end of the demo.
 */

import path from "path";
import { VaultManager } from "../VaultManager";
import { VaultOptions } from "../types";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Prints a numbered step header to make console output easy to follow. */
function logStep(step: number, description: string): void {
  console.log(`\n[Step ${step}] ${description}`);
  console.log("─".repeat(50));
}

/** Prints a success confirmation for the current step. */
function logSuccess(message: string): void {
  console.log(`  ✓ ${message}`);
}

// ---------------------------------------------------------------------------
// Demo runner
// ---------------------------------------------------------------------------

/**
 * Runs a complete end-to-end walkthrough of all {@link VaultManager} operations.
 *
 * ### Operations demonstrated
 * 1.  Initialise `VaultManager` with a local demo-vault root.
 * 2.  Create a folder inside the vault.
 * 3.  Create a new markdown note.
 * 4.  Read the note back from disk and print its content.
 * 5.  Update the note with new content.
 * 6.  Read the updated content to confirm the overwrite.
 * 7.  List all notes in the vault and print their metadata.
 * 8.  Rename the note to a new path.
 * 9.  Delete the renamed note.
 * 10. Delete the containing folder.
 *
 * The vault directory is fully removed at the end so the demo leaves no
 * artefacts on disk.
 */
async function runDemo(): Promise<void> {
  console.log("=".repeat(50));
  console.log("  Smart Notes — Vault Storage Demo");
  console.log("=".repeat(50));

  // ── Step 1: Initialise VaultManager ──────────────────────────────────────
  logStep(1, "Initialise VaultManager");

  const options: VaultOptions = {
    rootPath: path.resolve(process.cwd(), "demo-vault"),
  };

  const vault = new VaultManager(options);

  logSuccess(`Vault root: ${options.rootPath}`);

  // ── Step 2: Create a folder ───────────────────────────────────────────────
  logStep(2, "Create folder  →  notes/");

  await vault.createFolder("notes");

  logSuccess('Created folder "notes/"');

  // ── Step 3: Create a note ─────────────────────────────────────────────────
  logStep(3, "Create note  →  notes/hello.md");

  const initialContent = "# Hello Smart Notes\n\nThis is the initial content.";
  await vault.createNote("notes/hello.md", initialContent);

  logSuccess('Created "notes/hello.md"');
  console.log(`  Content written:\n\n    ${initialContent.replace(/\n/g, "\n    ")}`);

  // ── Step 4: Read the note ─────────────────────────────────────────────────
  logStep(4, "Read note  ←  notes/hello.md");

  const readContent = await vault.readNote("notes/hello.md");

  logSuccess("Read note successfully");
  console.log(`  Content read:\n\n    ${readContent.replace(/\n/g, "\n    ")}`);

  // ── Step 5: Update the note ───────────────────────────────────────────────
  logStep(5, "Update note  →  notes/hello.md");

  const updatedContent =
    "# Updated Note\n\nThis content was written by updateNote().";
  await vault.updateNote("notes/hello.md", updatedContent);

  logSuccess('Updated "notes/hello.md"');

  // Confirm the update landed on disk.
  const confirmedContent = await vault.readNote("notes/hello.md");
  console.log(
    `  Content after update:\n\n    ${confirmedContent.replace(/\n/g, "\n    ")}`
  );

  // ── Step 6: Create a second note so the listing is non-trivial ───────────
  logStep(6, "Create a second note  →  notes/second.md");

  await vault.createNote(
    "notes/second.md",
    "# Second Note\n\nAnother note for the listing demo."
  );

  logSuccess('Created "notes/second.md"');

  // ── Step 7: List all notes ────────────────────────────────────────────────
  logStep(7, "List all notes in vault");

  const notes = await vault.listNotes();

  logSuccess(`Found ${notes.length} note(s):`);
  notes.forEach((meta, index) => {
    console.log(`\n  Note #${index + 1}`);
    console.log(`    path      : ${meta.path}`);
    console.log(`    name      : ${meta.name}`);
    console.log(`    createdAt : ${new Date(meta.createdAt).toISOString()}`);
    console.log(`    updatedAt : ${new Date(meta.updatedAt).toISOString()}`);
  });

  // ── Step 8: Rename the first note ─────────────────────────────────────────
  logStep(8, "Rename note  →  notes/hello.md  →  notes/renamed.md");

  await vault.renameNote("notes/hello.md", "notes/renamed.md");

  logSuccess('Renamed "notes/hello.md" → "notes/renamed.md"');

  // ── Step 9: Delete the renamed note ──────────────────────────────────────
  logStep(9, "Delete note  →  notes/renamed.md");

  await vault.deleteNote("notes/renamed.md");

  logSuccess('Deleted "notes/renamed.md"');

  // ── Step 10: Delete the second note ──────────────────────────────────────
  logStep(10, "Delete note  →  notes/second.md");

  await vault.deleteNote("notes/second.md");

  logSuccess('Deleted "notes/second.md"');

  // ── Step 11: Delete the folder ────────────────────────────────────────────
  logStep(11, "Delete folder  →  notes/");

  await vault.deleteFolder("notes");

  logSuccess('Deleted folder "notes/"');

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("  Vault demo completed successfully.");
  console.log("  The demo-vault/ directory has been fully cleaned up.");
  console.log("=".repeat(50) + "\n");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

runDemo().catch((error: unknown) => {
  console.error("\n[Demo] Fatal error:", error);
  process.exit(1);
});