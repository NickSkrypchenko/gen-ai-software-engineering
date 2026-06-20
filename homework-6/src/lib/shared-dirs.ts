/**
 * Shared-directory protocol helpers (the only filesystem boundary for the pipeline).
 *
 *   input/      ← integrator drops the initial transaction message
 *   processing/ ← an agent holds a message here while working on it
 *   output/     ← an agent writes its enriched result for the next agent
 *   results/    ← final outcomes + audit.log + pipeline-summary.json
 *
 * `clearDirs` unlinks individual files (preserving `.gitkeep`) — never `rm -rf`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface SharedDirs {
  root: string;
  input: string;
  processing: string;
  output: string;
  results: string;
}

/** Resolve the four shared sub-directories under `root` (default: `<cwd>/shared`). */
export function resolveSharedDirs(root: string): SharedDirs {
  const base = resolve(root);
  return {
    root: base,
    input: join(base, 'input'),
    processing: join(base, 'processing'),
    output: join(base, 'output'),
    results: join(base, 'results'),
  };
}

/** Ensure all four shared sub-directories exist. */
export function ensureDirs(dirs: SharedDirs): void {
  for (const dir of [dirs.input, dirs.processing, dirs.output, dirs.results]) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Remove generated files from every shared sub-directory (keeps `.gitkeep`). No recursion. */
export function clearDirs(dirs: SharedDirs): void {
  for (const dir of [dirs.input, dirs.processing, dirs.output, dirs.results]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name === '.gitkeep') continue;
      unlinkSync(join(dir, name));
    }
  }
}

/** Write `obj` as pretty JSON to `path`. */
export function writeJson(path: string, obj: unknown): void {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

/** Read and parse a JSON file at `path`. */
export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** List `*.result.json` filenames in the results dir (sorted). */
export function listResultFiles(dirs: SharedDirs): string[] {
  if (!existsSync(dirs.results)) return [];
  return readdirSync(dirs.results)
    .filter((n) => n.endsWith('.result.json'))
    .sort();
}
