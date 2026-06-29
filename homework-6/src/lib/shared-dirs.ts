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

/**
 * Reduce an arbitrary id to a safe single path segment — defense in depth against path
 * traversal when an id is interpolated into a filename. Any character outside `[A-Za-z0-9_-]`
 * (notably `/`, `\`, `.`) is replaced; an empty result falls back to `invalid`.
 */
export function sanitizeSegment(id: string): string {
  const cleaned = String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
  return cleaned.length > 0 ? cleaned : 'invalid';
}

/** Write `obj` as pretty JSON to `path`. */
export function writeJson(path: string, obj: unknown): void {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

/** Read and parse a JSON file at `path`. */
export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** List `*.result.json` filenames directly in `dir` (sorted). */
export function listResultFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.result.json'))
    .sort();
}

/** List `*.result.json` filenames in the results dir (sorted). */
export function listResultFiles(dirs: SharedDirs): string[] {
  return listResultFilesIn(dirs.results);
}
