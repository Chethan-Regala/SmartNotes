"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexQueue = void 0;
/**
 * Simple sequential job queue for indexing tasks.
 * Ensures indexing operations run in order.
 */
class IndexQueue {
    constructor() {
        this.queue = [];
        this.running = false;
    }
    enqueue(job) {
        this.queue.push(job);
    }
    async process(handler) {
        if (this.running)
            return;
        this.running = true;
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (!job)
                continue;
            try {
                await handler(job);
            }
            catch (err) {
                console.error("Index job failed:", err);
            }
        }
        this.running = false;
    }
}
exports.IndexQueue = IndexQueue;
