"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IndexingEngine_1 = require("../IndexingEngine");
/**
 * Simple in-memory demo implementations
 */
class DemoVault {
    async readNote(notePath) {
        return `
# Example Note

This is the first paragraph.

This is another paragraph about Smart Notes.
`;
    }
    async listNotes() {
        return ["demo.md"];
    }
}
class DemoEmbedder {
    async embed(chunks) {
        return chunks.map(() => [Math.random(), Math.random(), Math.random()]);
    }
}
class DemoStore {
    async saveChunks(notePath, chunks, embeddings) {
        console.log("Indexed note:", notePath);
        console.log("Chunks:", chunks.length);
        console.log("Embeddings:", embeddings.length);
    }
    async deleteNote(notePath) {
        console.log("Deleted note:", notePath);
    }
}
async function runDemo() {
    const engine = new IndexingEngine_1.IndexingEngine(new DemoVault(), new DemoEmbedder(), new DemoStore());
    engine.scheduleUpdate("demo.md");
}
runDemo();
