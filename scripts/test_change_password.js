const fetch = require('node-fetch').default;
const qs = require('querystring');
const { User } = require('../src/models');

// Small helper to do JSON POST using node-fetch
async function postJson(url, body, headers = {}) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

(async () => {
  try {
    // Create test user (if not exists). If running against SQLite fallback, ensure column exists.
    const employeeId = 'TEMPCP';

    // Ensure SQLite has must_change_password column when used as fallback
    try {
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = process.env.SQLITE_FILE || 'backend_dev.sqlite';
      const db = new sqlite3.Database(dbPath);
      const pragma = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info('users')", (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      const hasCol = Array.isArray(pragma) && pragma.some(c => c.name === 'must_change_password');
      if (!hasCol) {
        await new Promise((resolve, reject) => {
          db.run("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0", (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        console.log('Added must_change_password column to sqlite users table');
      }
      db.close();
    } catch (e) {
      // Ignore if not applicable
    }

    let user = await User.findOne({ where: { employeeId } });
    if (!user) {
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash('temp123', 10);
      user = await User.create({ employeeId, name: 'Temporal', email: 'temp@example.com', role: 'employee', password: hashed, mustChangePassword: true });
      console.log('Created user', user.employeeId);
    } else {
      await user.update({ mustChangePassword: true, password: await require('bcryptjs').hash('temp123', 10) });
      console.log('Updated user for test', user.employeeId);
    }

    // Attempt login with default password
    const base = process.env.BASE_URL || 'http://localhost:39772';
    const loginResp = await postJson(base + '/api/auth/login', { employeeId, password: 'temp123' });
    console.log('Login response:', loginResp.data);

    const token = loginResp.data.token;
    if (!token) throw new Error('No token returned from login');

    // Call change-password
    const newPass = 'newStrongPass1';
    const changeResp = await postJson(base + '/api/auth/change-password', { newPassword: newPass }, { Authorization: `Bearer ${token}` });
    console.log('Change password response:', changeResp);

    // Re-login with new password
    const login2 = await postJson(base + '/api/auth/login', { employeeId, password: newPass });
    console.log('Login after change:', login2.data);

    // Check that mustChangePassword is false
    console.log('MustChangePassword after:', login2.data.user.mustChangePassword);
  } catch (e) {
    console.error('Test failed:', e && e.response ? e.response.data : e.message ? e.message : e);
  }
})();