const fingerprint = require('../src/services/fingerprintService');
const config = require('../src/config/config');

(async () => {
  console.log('FINGERPRINT_DB_PATH:', config.FINGERPRINT_DB_PATH);
  try {
    await fingerprint.init();
    const exists = await fingerprint.employeeExists('EMP001');
    console.log('employeeExists EMP001 ->', exists);
    const attendance = await fingerprint.getTodayAttendance('EMP001');
    console.log('getTodayAttendance EMP001 ->', attendance);
  } catch (err) {
    console.error('Error running fingerprint checks:', err && err.message ? err.message : err);
  }
})();
