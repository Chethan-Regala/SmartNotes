"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexingEngine = void 0;
const NoteChunker_1 = require("./NoteChunker");
const IndexQueue_1 = require("./IndexQueue");
/**
 * Coordinates the incremental indexing pipeline.
 */
class IndexingEngine {
    constructor(vault, embedder) {
        this.vault = vault;
        this.embedder = embedder;
        this.chunker = new NoteChunker_1.NoteChunker();
        this.queue = new IndexQueue_1.IndexQueue();
    }
    /**
     * Schedule indexing for a note.
     */
    scheduleUpdate(notePath) {
        const job = {
            type: "update",
            notePath,
        };
        this.queue.enqueue(job);
        this.queue.process(this.processJob.bind(this));
    }
    /**
     * Schedule deletion of a note from the index.
     */
    scheduleDelete(notePath) {
        const job = {
            type: "delete",
            notePath,
        };
        this.queue.enqueue(job);
        this.queue.process(this.processJob.bind(this));
    }
    /**
     * Process jobs coming from the queue.
     */
    async processJob(job) {
        if (job.type === "update") {
            await this.indexNote(job.notePath);
        }
        if (job.type === "delete") {
            await this.removeNote(job.notePath);
        }
    }
    /**
     * Full indexing pipeline for a note.
     */
    async indexNote(notePath) {
        const markdown = await this.vault.readNote(notePath);
        const chunks = this.chunker.split(notePath, markdown);
        const chunkTexts = chunks.map((c) => c.text);
        const embeddings = await this.embedder.embed(chunkTexts);
        return {
            notePath,
            chunks,
            embeddings,
        };
    }
    /**
     * Remove a note from the index.
     * (Implementation placeholder for future index storage layer)
     */
    async removeNote(notePath) {
        // Future implementation:
        // remove embeddings from vector store
        // remove chunks from registry table
        console.log(`Remove note from index: ${notePath}`);
    }
}
exports.IndexingEngine = IndexingEngine;
