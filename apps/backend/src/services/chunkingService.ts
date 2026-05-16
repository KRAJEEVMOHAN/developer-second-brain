export class ChunkingService {
  /**
   * Split file content into meaningful chunks.
   * Currently uses a simple line-based chunking strategy.
   * In the future, this will use AST data to chunk by function/class.
   */
  chunkFile(file: string, content: string, linesPerChunk: number = 30, overlap: number = 5): Array<{
    file: string;
    content: string;
    startLine: number;
    endLine: number;
  }> {
    const lines = content.split('\n');
    const chunks: Array<{
      file: string;
      content: string;
      startLine: number;
      endLine: number;
    }> = [];

    if (lines.length <= linesPerChunk) {
      return [{
        file,
        content,
        startLine: 1,
        endLine: lines.length
      }];
    }

    let i = 0;
    while (i < lines.length) {
      const end = Math.min(i + linesPerChunk, lines.length);
      const chunkLines = lines.slice(i, end);
      
      chunks.push({
        file,
        content: chunkLines.join('\n'),
        startLine: i + 1,
        endLine: end
      });

      // Move forward by linesPerChunk minus overlap
      i += (linesPerChunk - overlap);
      
      // Prevent infinite loop if overlap >= linesPerChunk
      if (linesPerChunk <= overlap) {
        i += linesPerChunk;
      }
    }

    return chunks;
  }
}
