// Helper to run fingerprint import in dry-run with an explicit DB path (useful when shell env assignment is difficult on Windows)
const path = require('path');

process.env.FINGERPRINT_DB_PATH = 'C:\\Users\\n\\Desktop\\HR\\fingerprint_db\\fingerprint.mdb';

(async () => {
  try {
    const importer = require('../src/services/fingerprintImportService');
    console.log('[RUN_IMPORT_DRY] Starting dry-run fingerprint import (FINGERPRINT_DB_PATH=', process.env.FINGERPRINT_DB_PATH, ')');
    const summary = await importer.importFingerprint({ dryRun: true });
    console.log('[RUN_IMPORT_DRY] Summary:');
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[RUN_IMPORT_DRY] Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();