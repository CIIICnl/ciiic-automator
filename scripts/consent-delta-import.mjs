#!/usr/bin/env node
// Delta import after the Brevo baseline. `dry-run` and `go-no-go` are
// read-only; `apply` without --apply only inspects; `event-log` reads Brevo
// logs. Nothing here sends mail, switches writers or lifts a suppression.
import fs from 'node:fs/promises';
import path from 'node:path';
import { encryptionKey } from './consent-preflight.mjs';
import { brevoRequest, createBaselineProvider } from '../src/services/consent/baseline-provider.js';
import { readEncrypted, writeEncrypted, withLock } from '../src/services/consent/baseline-import.js';
import { assessGoNoGo, eventLogProof, executeDelta, prepareDelta, resolveBase } from '../src/services/consent/delta-import.js';

const stamp = (iso) => iso.replace(/[:.]/g, '-');

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }

// Same protection as the baseline CLI: everything lives in one 0700
// directory, every file 0600 and no symlinks.
async function protectedDirectory(files) {
  const directory = path.dirname(path.resolve(files[0]));
  if (files.some((file) => path.dirname(path.resolve(file)) !== directory)) throw new Error('Evidence must live beside the protected dry-run');
  if (((await fs.stat(directory)).mode & 0o077) !== 0) throw new Error('Register directory permissions must be 0700');
  for (const file of files) {
    const info = await fs.lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error('Protected evidence file permissions required');
  }
  return directory;
}

const registerOf = (directory, record) => path.join(directory,
  `${stamp(record.t0)}-${record.kind === 'delta' ? 'delta' : 'baseline'}-register.enc.json`);

async function loadBase(key, checksumKey) {
  const basePath = option('--base-run');
  if (!basePath) throw new Error('Base run path required');
  const record = await readJson(basePath);
  const directory = await protectedDirectory([basePath, record.snapshotPath]);
  const [snapshot, journal] = await Promise.all([readEncrypted(record.snapshotPath, key), readEncrypted(registerOf(directory, record), key)]);
  return { directory, base: resolveBase({ record, snapshot, journal, key: checksumKey }) };
}

async function stableInventory(provider) {
  const first = await provider.inventory();
  const second = await provider.inventory();
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Source changed during read-only scan; retry later');
  return { ...second, target: provider.resolveTarget(second.lists) };
}

async function dryRun({ key, checksumKey, provider, write }) {
  const { directory, base } = await loadBase(key, checksumKey);
  const startedAt = new Date().toISOString();
  const inventory = await stableInventory(provider);
  const snapshotPath = path.join(directory, `${stamp(startedAt)}-delta-snapshot.enc.json`);
  const { snapshot, record } = prepareDelta({ base, inventory, startedAt, completedAt: new Date().toISOString(),
    key: checksumKey, snapshotPath });
  if (!write) return { record, lists: inventory.lists };
  await writeEncrypted(snapshotPath, snapshot, key);
  // The file holds exactly the record that the approval's runSha256 binds.
  const runRecord = path.join(directory, `${stamp(startedAt)}-delta-dryrun.json`);
  await fs.writeFile(runRecord, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  return { record: { ...record, runRecord } };
}

async function main() {
  const command = process.argv[2];
  const key = encryptionKey();
  const checksumKey = process.env.CONSENT_HMAC_KEY || key;
  // The delta never creates a list; the folder ID only satisfies the shared provider.
  const provider = createBaselineProvider({ folderId: 1 });
  let result;
  if (command === 'dry-run') {
    result = (await dryRun({ key, checksumKey, provider, write: true })).record;
  } else if (command === 'go-no-go') {
    const evidencePath = option('--automation-evidence');
    const automationEvidence = evidencePath ? await readJson(evidencePath).catch(() => null) : null;
    const { record, lists } = await dryRun({ key, checksumKey, provider, write: false });
    result = assessGoNoGo({ record, automationEvidence, lists, maxAgeDays: Number(option('--max-age-days') ?? 3),
      rblOpen: option('--rbl') !== 'resolved' });
  } else if (command === 'apply' || command === 'event-log') {
    const runPath = option('--run');
    if (!runPath) throw new Error('Run path required');
    const run = await readJson(runPath);
    const journalFile = registerOf(path.dirname(path.resolve(runPath)), run);
    if (command === 'event-log') {
      const directory = await protectedDirectory([runPath, run.snapshotPath]);
      const snapshot = await readEncrypted(run.snapshotPath, key);
      result = await withLock(directory, async () => {
        const journal = await readEncrypted(journalFile, key);
        if (journal.t0 !== run.t0 || journal.readback?.result?.verified !== true) throw new Error('Delta not applied and verified');
        const proof = await eventLogProof({ request: (method, endpoint) => brevoRequest(method, endpoint, null, fetch),
          addresses: new Set(snapshot.plan.rows.map((row) => row.email)), since: run.t0, until: new Date().toISOString() });
        journal.eventLog = proof;
        journal.readback.eventLogVerified = proof.verified;
        await writeEncrypted(journalFile, journal, key);
        return proof;
      });
    } else {
      const approvalPath = option('--approval');
      const automationPath = option('--automation-evidence');
      if (!approvalPath || !automationPath) throw new Error('Run, approval and automation evidence paths required');
      const directory = await protectedDirectory([runPath, approvalPath, automationPath, run.snapshotPath]);
      const snapshot = await readEncrypted(run.snapshotPath, key);
      const [approval, automationEvidence] = await Promise.all([readJson(approvalPath), readJson(automationPath)]);
      result = await withLock(directory, async () => {
        const journal = await readEncrypted(journalFile, key).catch((error) => {
          if (error.code === 'ENOENT') return {};
          throw error;
        });
        return executeDelta({ snapshot, run, approval, key: checksumKey, journal, provider, automationEvidence,
          apply: process.argv.includes('--apply'), save: (value) => writeEncrypted(journalFile, value, key) });
      });
    }
  } else {
    throw new Error('Command required: dry-run, go-no-go, apply or event-log');
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

// Only fixed messages from this tool reach stderr; provider bodies, paths and
// addresses never do.
const SAFE = /^(Command required: .*|Base run path required|Run path required|Run, approval and automation evidence paths required|Evidence must live beside the protected dry-run|Register directory permissions must be 0700|Protected evidence file permissions required|Base run is not applied and verified|Base consent policy required|Dedicated Brevo CIIIC list ID required|Duplicate Brevo identity|Target list drift|Source changed during read-only scan; retry later|Provider changed during inventory|Approved delta dry-run does not match source export|Approved delta rows do not match checksum|Current account and list automation evidence required|Provider or writer route already switched|Journal belongs to another dry-run|Mailchimp source drift; new dry-run and approval required|Brevo destination drift; new dry-run and approval required|Brevo LANGUAGE enumeration (drift|changed|missing)|Suppression journal checksum drift|Suppression read-back failed|Journal row checksum drift|Applied contact changed; manual reconciliation required|Uncertain provider outcome; manual reconciliation required|Brevo contact changed after inventory; new dry-run and approval required|Brevo contact no longer matches base; manual reconciliation required|Provider outcome unknown; read-back required before retry|Provider read-back mismatch|Full read-back failed: \{[a-zA-Z0-9":,]*\}|Sample read-back failed|Delta not applied and verified|Valid event-log window required|Provider pagination shape changed|Provider count changed during scan; retry later|Provider pagination stalled|Brevo (GET|PUT|POST) failed \(\d{3}\)|CONSENT_EXPORT_KEY must be 32-byte hex|MAILCHIMP_API_KEY required|Brevo API key required|BREVO_CIIIC_LIST_ID does not match the CIIIC nieuwsbrief list|Brevo target list name is ambiguous|Read-only provider request failed: HTTP \d{3}|Accepted sources and a policy notice required)$/;

main().catch((error) => {
  const message = error?.code === 'EEXIST' ? 'Another import holds the lock' : error?.code === 'ENOENT' ? 'Input file missing'
    : error?.name === 'TimeoutError' ? 'Provider timeout'
    : SAFE.test(error?.message ?? '') ? error.message : 'unlisted failure';
  process.stderr.write(`Delta import stopped: ${message}; inspect protected register and provider state before retry.\n`);
  process.exitCode = 1;
});
