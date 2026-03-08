import { IndexingEngine } from "../IndexingEngine"
import { VaultAdapter } from "../adapters/VaultAdapter"
import { EmbeddingAdapter } from "../adapters/EmbeddingAdapter"
import { IndexStore } from "../adapters/IndexStore"
import { NoteChunk } from "../types"

/**
 * Simple in-memory demo implementations
 */

class DemoVault implements VaultAdapter {
  async readNote(notePath: string): Promise<string> {
    return `
# Example Note

This is the first paragraph.

This is another paragraph about Smart Notes.
`
  }

  async listNotes(): Promise<string[]> {
    return ["demo.md"]
  }
}

class DemoEmbedder implements EmbeddingAdapter {
  async embed(chunks: string[]): Promise<number[][]> {
    return chunks.map(() => [Math.random(), Math.random(), Math.random()])
  }
}

class DemoStore implements IndexStore {
  async saveChunks(
    notePath: string,
    chunks: NoteChunk[],
    embeddings: number[][]
  ): Promise<void> {
    console.log("Indexed note:", notePath)
    console.log("Chunks:", chunks.length)
    console.log("Embeddings:", embeddings.length)
  }

  async deleteNote(notePath: string): Promise<void> {
    console.log("Deleted note:", notePath)
  }
}

async function runDemo() {
  const engine = new IndexingEngine(
    new DemoVault(),
    new DemoEmbedder(),
    new DemoStore()
  )

  engine.scheduleUpdate("demo.md")
}

runDemo()
