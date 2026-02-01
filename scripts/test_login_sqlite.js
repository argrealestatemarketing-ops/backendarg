const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../src/config/config');

const db = new sqlite3.Database('backend_dev.sqlite');

db.serialize(() => {
  db.get("SELECT * FROM users WHERE employee_id = ?", ['EMP001'], async (err, row) => {
    if (err) {
      console.error('SQLite query error:', err);
      process.exit(1);
    }
    if (!row) {
      console.error('User not found in SQLite');
      process.exit(1);
    }
    const isValid = await bcrypt.compare('123456', row.password);
    console.log('User row:', { id: row.id, employee_id: row.employee_id, email: row.email });
    console.log('Password valid:', isValid);
    if (!isValid) process.exit(1);
    const token = jwt.sign({ id: row.id, employeeId: row.employee_id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE });
    console.log('Generated token:', token);
    console.log('Decoded token:', jwt.decode(token));
    process.exit(0);
  });
});