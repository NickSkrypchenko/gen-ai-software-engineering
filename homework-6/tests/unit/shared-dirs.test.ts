import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearDirs,
  ensureDirs,
  listResultFiles,
  readJson,
  resolveSharedDirs,
  writeJson,
} from '../../src/lib/shared-dirs';

describe('shared-dirs helpers', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'shared-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('resolveSharedDirs builds the four sub-dir paths', () => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    expect(dirs.input.endsWith('shared/input')).toBe(true);
    expect(dirs.results.endsWith('shared/results')).toBe(true);
  });

  it('ensureDirs creates all four; clearDirs removes files but keeps .gitkeep', () => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    ensureDirs(dirs);
    writeFileSync(join(dirs.input, '.gitkeep'), '');
    writeJson(join(dirs.input, 'a.json'), { x: 1 });
    writeJson(join(dirs.results, 'b.result.json'), { y: 2 });

    clearDirs(dirs);
    expect(readdirSync(dirs.input)).toEqual(['.gitkeep']);
    expect(readdirSync(dirs.results)).toEqual([]);
  });

  it('clearDirs is a no-op for a non-existent dir', () => {
    const dirs = resolveSharedDirs(join(root, 'never-made'));
    expect(() => clearDirs(dirs)).not.toThrow();
  });

  it('writeJson + readJson round-trips', () => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    ensureDirs(dirs);
    const file = join(dirs.results, 'r.json');
    writeJson(file, { decision: 'APPROVE' });
    expect(readJson<{ decision: string }>(file).decision).toBe('APPROVE');
  });

  it('listResultFiles returns only *.result.json, sorted', () => {
    const dirs = resolveSharedDirs(join(root, 'shared'));
    ensureDirs(dirs);
    writeJson(join(dirs.results, 'TXN002.result.json'), {});
    writeJson(join(dirs.results, 'TXN001.result.json'), {});
    writeJson(join(dirs.results, 'pipeline-summary.json'), {});
    expect(listResultFiles(dirs)).toEqual(['TXN001.result.json', 'TXN002.result.json']);
  });

  it('listResultFiles returns [] when results dir is absent', () => {
    const dirs = resolveSharedDirs(join(root, 'absent'));
    expect(listResultFiles(dirs)).toEqual([]);
  });
});
