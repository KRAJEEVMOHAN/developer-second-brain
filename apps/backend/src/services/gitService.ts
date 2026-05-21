import { exec } from 'child_process';
import * as fs from 'fs';

export class GitService {
  /**
   * Clone a remote Git repository to the target path.
   * Uses a shallow clone to save bandwidth and storage.
   */
  async cloneRepository(url: string, targetPath: string, branch?: string): Promise<void> {
    // Clean up target path if it already exists
    if (fs.existsSync(targetPath)) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    }

    // Build clone command
    // --depth 1 for shallow clone
    // --branch <branch> if branch is specified
    let command = `git clone --depth 1`;
    if (branch) {
      // Basic sanitization to prevent command injection via branch name
      const sanitizedBranch = branch.replace(/[^a-zA-Z0-9_\-\/\.]/g, '');
      command += ` --branch "${sanitizedBranch}"`;
    }
    
    // Basic sanitization for URL
    const sanitizedUrl = url.replace(/["$`]/g, '');
    command += ` "${sanitizedUrl}" "${targetPath}"`;

    return new Promise<void>((resolve, reject) => {
      exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Git clone failed for URL: ${url}. Error:`, error.message);
          console.error('Stderr:', stderr);
          reject(new Error(`Git clone failed: ${stderr || error.message}`));
        } else {
          resolve();
        }
      });
    });
  }
}
