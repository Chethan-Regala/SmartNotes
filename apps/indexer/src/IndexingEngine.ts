import { VaultAdapter } from "./adapters/VaultAdapter"
import { EmbeddingAdapter } from "./adapters/EmbeddingAdapter"
import { IndexStore } from "./adapters/IndexStore"
import { NoteChunker } from "./NoteChunker"
import { IndexQueue } from "./IndexQueue"
import { IndexResult, IndexJob } from "./types"

/**
 * Coordinates the incremental indexing pipeline.
 */
export class IndexingEngine {
  private vault: VaultAdapter
  private embedder: EmbeddingAdapter
  private store: IndexStore
  private chunker: NoteChunker
  private queue: IndexQueue

  constructor(
    vault: VaultAdapter,
    embedder: EmbeddingAdapter,
    store: IndexStore
  ) {
    this.vault = vault
    this.embedder = embedder
    this.store = store
    this.chunker = new NoteChunker()
    this.queue = new IndexQueue()
  }

  /**
   * Schedule indexing for a note.
   */
  scheduleUpdate(notePath: string) {
    const job: IndexJob = {
      type: "update",
      notePath,
    }

    this.queue.enqueue(job)

    this.queue.process(this.processJob.bind(this))
  }

  /**
   * Schedule deletion of a note from the index.
   */
  scheduleDelete(notePath: string) {
    const job: IndexJob = {
      type: "delete",
      notePath,
    }

    this.queue.enqueue(job)

    this.queue.process(this.processJob.bind(this))
  }

  /**
   * Process jobs coming from the queue.
   */
  private async processJob(job: IndexJob) {
    if (job.type === "update") {
      await this.indexNote(job.notePath)
    }

    if (job.type === "delete") {
      await this.removeNote(job.notePath)
    }
  }

  /**
   * Full indexing pipeline for a note.
   */
  private async indexNote(notePath: string): Promise<IndexResult> {
    const markdown = await this.vault.readNote(notePath)

    const chunks = this.chunker.split(notePath, markdown)

    const chunkTexts = chunks.map((c) => c.text)

    const embeddings = await this.embedder.embed(chunkTexts)

    const result: IndexResult = {
      notePath,
      chunks,
      embeddings,
    }

    await this.store.saveChunks(notePath, chunks, embeddings)

    return result
  }

  /**
   * Remove a note from the index.
   */
  private async removeNote(notePath: string) {
    await this.store.deleteNote(notePath)
  }
}
