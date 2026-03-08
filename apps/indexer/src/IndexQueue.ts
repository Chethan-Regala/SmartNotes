import { IndexJob } from "./types"

/**
 * Simple sequential job queue for indexing tasks.
 * Ensures indexing operations run in order.
 */
export class IndexQueue {
  private queue: IndexJob[] = []
  private running = false

  enqueue(job: IndexJob) {
    this.queue.push(job)
  }

  async process(handler: (job: IndexJob) => Promise<void>) {
    if (this.running) return

    this.running = true

    while (this.queue.length > 0) {
      const job = this.queue.shift()

      if (!job) continue

      try {
        await handler(job)
      } catch (err) {
        console.error("Index job failed:", err)
      }
    }

    this.running = false
  }
}
