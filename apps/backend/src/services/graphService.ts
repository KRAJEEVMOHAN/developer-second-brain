import pool from '../db';

interface Edge {
  target: string;
  symbol: string;
}

export interface CycleResult {
  path: string[];
  symbols: string[];
}

export class GraphService {
  /**
   * Finds all simple circular dependency paths in a repository's dependency graph.
   * Capped at a maximum depth of 5 and a maximum of 50 cycles for safety.
   */
  async findCircularDependencies(repoId: string): Promise<CycleResult[]> {
    const result = await pool.query(
      'SELECT source_file, target_file, symbol_name FROM relationships WHERE repo_id = $1',
      [repoId]
    );

    const adjList: Map<string, Edge[]> = new Map();
    for (const row of result.rows) {
      const src = row.source_file;
      const tgt = row.target_file;
      const sym = row.symbol_name;

      if (!adjList.has(src)) {
        adjList.set(src, []);
      }
      adjList.get(src)!.push({ target: tgt, symbol: sym });
    }

    const cycles: CycleResult[] = [];
    const recStack: string[] = [];
    const symbolStack: string[] = [];

    // Helper to normalize cycle path so rotations are identified as duplicates
    // E.g., [A, B, C, A] -> [A, B, C]. We rotate so the alphabetically smallest node is first.
    const normalizeCycle = (path: string[]) => {
      const copy = path.slice(0, -1); // remove trailing duplicate node
      let minIndex = 0;
      for (let i = 1; i < copy.length; i++) {
        if (copy[i] < copy[minIndex]) {
          minIndex = i;
        }
      }
      return [...copy.slice(minIndex), ...copy.slice(0, minIndex)];
    };

    // Helper to check if a cycle is already found (ignoring rotation)
    const isDuplicate = (newPath: string[]) => {
      const newPathNormalized = normalizeCycle(newPath);
      return cycles.some(c => {
        if (c.path.length !== newPath.length) return false;
        const existingNormalized = normalizeCycle(c.path);
        return existingNormalized.every((val, index) => val === newPathNormalized[index]);
      });
    };

    const dfs = (node: string, depth: number) => {
      if (depth > 5) return; // Restrict search depth to prevent stack overflow or massive cycles
      if (cycles.length >= 50) return; // Cap the total number of detected cycles

      const index = recStack.indexOf(node);
      if (index !== -1) {
        // Cycle detected!
        const cyclePath = recStack.slice(index);
        cyclePath.push(node); // close the cycle path

        const cycleSymbols: string[] = [];
        // Map edges in the stack to symbol names
        for (let i = index; i < recStack.length; i++) {
          cycleSymbols.push(symbolStack[i]);
        }

        if (!isDuplicate(cyclePath)) {
          cycles.push({
            path: cyclePath,
            symbols: cycleSymbols
          });
        }
        return;
      }

      recStack.push(node);
      const edges = adjList.get(node) || [];
      for (const edge of edges) {
        symbolStack.push(edge.symbol);
        dfs(edge.target, depth + 1);
        symbolStack.pop();
      }
      recStack.pop();
    };

    // Run DFS starting from each node in the adjacency list
    for (const node of adjList.keys()) {
      dfs(node, 0);
    }

    return cycles;
  }
}
