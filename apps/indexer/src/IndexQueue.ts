import { IndexJob } from "./types"

/**
 * Simple sequential job queue for indexing tasks.
 * Ensures indexing operations run in order.
 */
export class IndexQueue {
  private queue: IndexJob[] = []
  private processing: Promise<void> | null = null

  enqueue(job: IndexJob) {
    this.queue.push(job)
  }

  process(handler: (job: IndexJob) => Promise<void>): Promise<void> {
    if (this.processing) return this.processing

    this.processing = (async () => {
      while (this.queue.length > 0) {
        const job = this.queue.shift()
        if (!job) continue

        await handler(job)
      }
    })().finally(() => {
      this.processing = null
    })

    return this.processing
  }
}
