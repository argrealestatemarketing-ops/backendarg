const importer = require('../src/services/fingerprintImportService');

// Usage: node scripts/import_fingerprint.js [startDate] [endDate] [--dry-run]
// Dates format: YYYY-MM-DD

(async () => {
  try {
    const args = process.argv.slice(2);
    const start = args[0] ? new Date(args[0]) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const end = args[1] ? new Date(args[1]) : new Date();
    const dryRun = args.includes('--dry-run') || args.includes('-d');

    console.log('[IMPORT] Running fingerprint import', { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], dryRun });

    const summary = await importer.importFingerprint({ startDate: start, endDate: end, dryRun });

    console.log('[IMPORT] Summary:', JSON.stringify(summary, null, 2));

    if (summary.errors && summary.errors.length > 0) {
      // Helpful hint for common provider error
      const providerMissing = summary.errors.some(e => (e.type === 'general' && /provider|Access Database Engine/i.test(e.error)) || (e.code === 'FINGERPRINT_DB_PROVIDER_MISSING'));
      if (providerMissing) {
        console.error('\n[IMPORT] Provider error detected: please install the Microsoft Access Database Engine (ACE) matching your Node/Office bitness. See README for details.');
      }
      process.exit(2);
    }

    process.exit(0);
  } catch (err) {
    console.error('[IMPORT] Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();