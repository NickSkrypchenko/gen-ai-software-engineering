#!/usr/bin/env node
/**
 * coverage-gate — PreToolUse(Bash) hook that BLOCKS `git push` when line coverage < 80%.
 *
 * Wiring: `.claude/settings.json` registers this on PreToolUse with matcher "Bash".
 * Claude Code passes the tool call as JSON on stdin; an exit code of 2 blocks the tool.
 *
 * Behavior:
 *   1. Read the tool payload. If it is not a Bash `git push`, allow (exit 0).
 *   2. Otherwise run the coverage suite (unless COVERAGE_GATE_SKIP_RUN=1), then read
 *      coverage/coverage-summary.json and compare total line coverage to the minimum.
 *   3. lines.pct < min → print why, exit 2 (block). Else exit 0 (allow).
 *
 * Env seams (used by the demo/tests; defaults match the hard gate):
 *   COVERAGE_GATE_MIN       minimum line % (default 80)
 *   COVERAGE_GATE_SKIP_RUN  "1" to skip re-running coverage (read existing summary)
 *   COVERAGE_GATE_SUMMARY   override path to coverage-summary.json
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIN = Number(process.env.COVERAGE_GATE_MIN ?? '80');
const SUMMARY_PATH =
  process.env.COVERAGE_GATE_SUMMARY ?? resolve(REPO_DIR, 'coverage', 'coverage-summary.json');

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function isGitPush(payload) {
  if (payload?.tool_name && payload.tool_name !== 'Bash') return false;
  const command = payload?.tool_input?.command ?? '';
  return /\bgit\s+push\b/.test(command);
}

function fail(msg) {
  process.stderr.write(`coverage-gate: ${msg}\n`);
  process.exit(2); // block the tool call
}

function allow(msg) {
  if (msg) process.stderr.write(`coverage-gate: ${msg}\n`);
  process.exit(0);
}

let payload = {};
try {
  const raw = readStdin();
  payload = raw ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

if (!isGitPush(payload)) allow(); // not a push — nothing to gate

if (process.env.COVERAGE_GATE_SKIP_RUN !== '1') {
  try {
    execSync('npm run test:cov', { cwd: REPO_DIR, stdio: 'ignore' });
  } catch {
    fail('coverage run failed — blocking push.');
  }
}

if (!existsSync(SUMMARY_PATH)) {
  fail(`no coverage summary at ${SUMMARY_PATH} — run \`npm run test:cov\` first.`);
}

let pct;
try {
  const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
  pct = summary.total.lines.pct;
} catch (err) {
  fail(`could not parse coverage summary: ${String(err)}`);
}

if (pct < MIN) {
  fail(`line coverage ${pct}% is below the ${MIN}% gate — push blocked.`);
}

allow(`line coverage ${pct}% ≥ ${MIN}% — push allowed.`);
