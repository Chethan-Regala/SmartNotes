"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteChunker = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Splits markdown notes into chunks.
 * Current implementation is simple paragraph-based splitting.
 */
class NoteChunker {
    split(notePath, markdown) {
        const paragraphs = markdown
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        const chunks = paragraphs.map((text, index) => {
            const id = crypto_1.default
                .createHash("sha1")
                .update(notePath + index + text)
                .digest("hex");
            return {
                id,
                notePath,
                text,
                position: index,
            };
        });
        return chunks;
    }
}
exports.NoteChunker = NoteChunker;
