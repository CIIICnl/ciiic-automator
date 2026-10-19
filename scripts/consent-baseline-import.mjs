#!/usr/bin/env node
// Deliberate two-step CLI: inspection is read-only; --apply needs a written
// approval bound to the exact dry-run and current automation evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import { encryptionKey } from './consent-preflight.mjs';
import { createBaselineProvider } from '../src/services/consent/baseline-provider.js';
import { executeBaseline, readEncrypted, writeEncrypted, withLock } from '../src/services/consent/baseline-import.js';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

async function main() {
  const runPath = option('--run');
  const approvalPath = option('--approval');
  const automationPath = option('--automation-evidence');
  if (!runPath || !approvalPath || !automationPath) throw new Error('Run, approval and automation evidence paths required');
  const key = encryptionKey();
  const [run, approval, automationEvidence] = await Promise.all([runPath, approvalPath, automationPath].map(async (file) =>
    JSON.parse(await fs.readFile(file, 'utf8'))));
  const directory = path.dirname(path.resolve(runPath));
  if (directory !== path.dirname(path.resolve(run.snapshotPath)) || directory !== path.dirname(path.resolve(approvalPath)) ||
    directory !== path.dirname(path.resolve(automationPath))) throw new Error('Evidence must live beside the protected dry-run');
  const stat = await fs.stat(directory);
  if ((stat.mode & 0o077) !== 0) throw new Error('Register directory permissions must be 0700');
  for (const file of [runPath, approvalPath, automationPath, run.snapshotPath]) {
    const info = await fs.lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) {
      throw new Error('Protected evidence file permissions required');
    }
  }
  const snapshot = await readEncrypted(run.snapshotPath, key);
  const journalFile = path.join(directory, `${run.t0.replace(/[:.]/g, '-')}-baseline-register.enc.json`);
  const provider = createBaselineProvider({ folderId: Number(approval.targetFolderId) });
  const result = await withLock(directory, async () => {
    const journal = await readEncrypted(journalFile, key).catch((error) => {
      if (error.code === 'ENOENT') return {};
      throw error;
    });
    return executeBaseline({ snapshot, run, approval, key: process.env.CONSENT_HMAC_KEY || key, journal, provider,
      automationEvidence, apply: process.argv.includes('--apply'),
      save: (value) => writeEncrypted(journalFile, value, key) });
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch(() => {
  // Provider bodies, paths and personal data never enter the error stream.
  process.stderr.write('Baseline import stopped; inspect protected register and provider state before retry.\n');
  process.exitCode = 1;
});
