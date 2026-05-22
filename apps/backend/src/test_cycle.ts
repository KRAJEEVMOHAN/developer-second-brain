import pool from './db';
import { GraphService } from './services/graphService';

async function runCycleTest() {
  console.log('--- STARTING CIRCULAR DEPENDENCIES DIAGNOSTIC TEST ---');
  
  const repoId = 'test-cycle-repo-' + Math.random().toString(36).substr(2, 5);
  console.log(`Using temporary test repo_id: ${repoId}`);

  try {
    // 1. Insert temporary repository
    await pool.query(
      "INSERT INTO repositories (id, name, status) VALUES ($1, $2, $3)",
      [repoId, 'Test Cycle Repo', 'indexed']
    );

    // 2. Insert relationships
    console.log('Inserting test relationships...');
    
    // Cycle A <-> B
    await pool.query(
      "INSERT INTO relationships (repo_id, source_file, target_file, symbol_name) VALUES ($1, $2, $3, $4)",
      [repoId, 'src/A.ts', 'src/B.ts', 'classB']
    );
    await pool.query(
      "INSERT INTO relationships (repo_id, source_file, target_file, symbol_name) VALUES ($1, $2, $3, $4)",
      [repoId, 'src/B.ts', 'src/A.ts', 'classA']
    );

    // No cycle C -> D
    await pool.query(
      "INSERT INTO relationships (repo_id, source_file, target_file, symbol_name) VALUES ($1, $2, $3, $4)",
      [repoId, 'src/C.ts', 'src/D.ts', 'classD']
    );

    // Cycle D -> E -> F -> D
    await pool.query(
      "INSERT INTO relationships (repo_id, source_file, target_file, symbol_name) VALUES ($1, $2, $3, $4)",
      [repoId, 'src/D.ts', 'src/E.ts', 'classE']
    );
    await pool.query(
      "INSERT INTO relationships (repo_id, source_file, target_file, symbol_name) VALUES ($1, $2, $3, $4)",
      [repoId, 'src/E.ts', 'src/F.ts', 'classF']
    );
    await pool.query(
      "INSERT INTO relationships (repo_id, source_file, target_file, symbol_name) VALUES ($1, $2, $3, $4)",
      [repoId, 'src/F.ts', 'src/D.ts', 'classD_ref']
    );

    // 3. Instantiate GraphService and run detector
    console.log('Running GraphService cycle detector...');
    const graphService = new GraphService();
    const cycles = await graphService.findCircularDependencies(repoId);

    console.log('\n--- DETECTED CYCLES ---');
    console.log(JSON.stringify(cycles, null, 2));
    
    // 4. Verify results
    if (cycles.length === 2) {
      console.log('\nSUCCESS: Found exactly 2 cycles as expected.');
    } else {
      console.error(`\nFAILURE: Expected 2 cycles but found ${cycles.length}.`);
    }

    // Double check specific cycles
    const hasAB = cycles.some(c => c.path.includes('src/A.ts') && c.path.includes('src/B.ts'));
    const hasDEF = cycles.some(c => c.path.includes('src/D.ts') && c.path.includes('src/E.ts') && c.path.includes('src/F.ts'));
    
    if (hasAB && hasDEF) {
      console.log('SUCCESS: Both cycles are correct.');
    } else {
      console.error('FAILURE: Detected cycles do not match expected paths.');
    }

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    // 5. Clean up database
    console.log('\nCleaning up database records...');
    try {
      // ON DELETE CASCADE will clean up relationships automatically when repo is deleted
      await pool.query("DELETE FROM repositories WHERE id = $1", [repoId]);
      console.log('Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.error('Failed to clean up records:', cleanupErr);
    }
  }

  console.log('\n--- CIRCULAR DEPENDENCIES DIAGNOSTIC TEST COMPLETED ---');
  process.exit(0);
}

runCycleTest();
