#!/usr/bin/env node
/*
  Usage: node scripts/sync_fingerprint_to_mongo.js [--dry-run] [--password=123456]
  - Reads users from configured FINGERPRINT_DB_PATH and safely inserts into MongoDB (no updates).
  - Observes rules: do not modify Access DB; do not overwrite existing Mongo users.
*/

(async function main(){
  const argv = require('minimist')(process.argv.slice(2));
  const dryRun = !!argv['dry-run'] || !!argv.dryrun || !!argv.d;
  const password = argv.password || argv.p || process.env.IMPORT_DEFAULT_PASSWORD || '123456';

  // Allow overriding fingerprint DB path via --db-path for convenience (won't modify the source Access DB)
  if (argv['db-path']) {
    process.env.FINGERPRINT_DB_PATH = argv['db-path'];
    console.log('[SYNC] Using fingerprint DB path from --db-path:', process.env.FINGERPRINT_DB_PATH);
  }

  // Now require the service (after possibly setting env)
  const { syncFingerprintUsersToMongo } = require('../src/services/fingerprintToMongoService');

  console.log('[SYNC] Starting fingerprint->Mongo sync', { dryRun });

  try {
    const summary = await syncFingerprintUsersToMongo({ dryRun, defaultPassword: password });
    console.log('[SYNC] Summary:', JSON.stringify(summary, null, 2));
    if (summary.errors && summary.errors.length > 0) process.exit(2);
    process.exit(0);
  } catch (err) {
    console.error('[SYNC] Failed:', err && err.message ? err.message : String(err));
    process.exit(1);
  }
})();
