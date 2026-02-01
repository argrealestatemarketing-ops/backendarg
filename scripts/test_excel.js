// Simple script to exercise Excel employee service
const path = require('path');
const excelService = require('../src/services/excelEmployeeService');

(async () => {
  try {
    const sample = process.argv[2];
    if (sample) process.env.EMPLOYEE_EXCEL_PATH = sample;

    console.log('EMPLOYEE_EXCEL_PATH:', process.env.EMPLOYEE_EXCEL_PATH || '(not set)');

    await excelService.init();
    console.log('Excel service enabled:', excelService.isEnabled());
    const testIds = ['EMP001', '12345', 'HR001'];
    for (const id of testIds) {
      try {
        const exists = excelService.employeeExists(id);
        console.log(`Exists ${id}:`, exists);
      } catch (e) {
        console.error('Lookup error for', id, e && e.message ? e.message : e);
      }
    }
  } catch (err) {
    console.error('Test Excel failed:', err && err.message ? err.message : err);
  }
})();