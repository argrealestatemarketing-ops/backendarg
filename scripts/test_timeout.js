// Simulate slow DB response to test timeout path
process.env.FINGERPRINT_DB_PATH = './fingerprint_db/zk_attendance.mdb';

const ADODB = require('node-adodb');
// Monkeypatch ADODB.open to return a connection whose query never resolves
const originalOpen = ADODB.open;
ADODB.open = (connStr) => ({
  query: (sql) => {
    // Let the init() 'CHECKINOUT' probe succeed quickly, but make other queries hang
    if (typeof sql === 'string' && sql.toUpperCase().includes('CHECKINOUT')) {
      return Promise.resolve([]);
    }
    return new Promise(() => {}); // never resolves
  }
});

const fingerprint = require('../src/services/fingerprintService');

(async () => {
  try {
    await fingerprint.init();
    const start = Date.now();
    try {
      await fingerprint.employeeExists('EMP001');
      console.log('Unexpected: employeeExists returned without timeout');
    } catch (err) {
      const duration = Date.now() - start;
      console.error('Test timeout result:', err && err.code, err && err.message, `(duration ${duration}ms)`);
    }
  } finally {
    // Restore
    ADODB.open = originalOpen;
  }
})();
