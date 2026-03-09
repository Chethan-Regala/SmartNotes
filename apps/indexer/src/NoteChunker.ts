import type { NoteChunk } from "./types"
import crypto from "crypto"

/**
 * Splits markdown notes into chunks.
 * Current implementation is simple paragraph-based splitting.
 */
export class NoteChunker {
  split(notePath: string, markdown: string): NoteChunk[] {
    const paragraphs = markdown
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    const chunks: NoteChunk[] = paragraphs.map((text, index) => {
      const id = crypto
        .createHash("sha1")
        .update(`${notePath}\0${index}\0${text}`)
        .digest("hex")

      return {
        id,
        notePath,
        text,
        position: index,
      }
    })

    return chunks
  }
}
