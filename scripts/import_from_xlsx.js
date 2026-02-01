// CLI to import from an Excel/CSV file
// Usage: node scripts/import_from_xlsx.js <path-to-file> [--dry-run]

const path = require('path');
(async () => {
  try {
    const args = process.argv.slice(2);
    const file = args[0];
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    if (!file) return console.error('Usage: node scripts/import_from_xlsx.js <file> [--dry-run]');

    const importer = require('../src/services/fileImportService');
    console.log('[IMPORT_FILE] Importing from file:', file, { dryRun });
    const summary = await importer.importFromWorkbook(file, { dryRun });
    console.log('[IMPORT_FILE] Summary:', JSON.stringify(summary, null, 2));
    if (summary.errors && summary.errors.length > 0) process.exit(2);
    process.exit(0);
  } catch (err) {
    console.error('[IMPORT_FILE] Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();