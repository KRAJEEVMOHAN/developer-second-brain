import * as fs from 'fs';
import * as path from 'path';

export class ParserService {
  /**
   * Parse a repository directory.
   * Currently walks the directory and reads file contents.
   * In the future, this will use Tree-sitter for AST parsing.
   */
  async parseRepository(repoPath: string): Promise<Array<{ file: string, content: string }>> {
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Directory not found: ${repoPath}`);
    }

    const files = await this.getAllFiles(repoPath);
    const results: Array<{ file: string, content: string }> = [];

    for (const file of files) {
      // Skip ignore patterns
      if (this.shouldIgnore(file)) {
        continue;
      }

      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        results.push({
          file: path.relative(repoPath, file),
          content,
        });
      } catch (err) {
        console.error(`Failed to read file: ${file}`, err);
      }
    }

    return results;
  }

  /**
   * Recursively get all files in a directory.
   */
  private async getAllFiles(dirPath: string): Promise<string[]> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const res = path.resolve(dirPath, entry.name);
      return entry.isDirectory() ? this.getAllFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
  }

  /**
   * Check if a file should be ignored (e.g., node_modules, .git).
   */
  private shouldIgnore(filePath: string): boolean {
    const ignorePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.vscode',
      'package-lock.json',
      'yarn.lock',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.ico',
      '.pdf',
      '.zip',
      '.gz'
    ];
    
    return ignorePatterns.some(pattern => filePath.includes(pattern));
  }
}
