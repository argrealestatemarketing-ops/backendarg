// Migration helper: add must_change_password, password_changed_at, token_version and audit_logs table when missing
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

(async () => {
  try {
    const dbPath = process.env.SQLITE_FILE || 'backend_dev.sqlite';
    if (!fs.existsSync(dbPath)) {
      console.log('SQLite DB file not found at', dbPath, ' - skipping migration helper (ensure your DB is configured).');
      return;
    }

    const db = new sqlite3.Database(dbPath);

    // check users table exists
    const tableInfo = await new Promise((resolve, reject) => db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (e, r) => e ? reject(e) : resolve(r)));
    if (!tableInfo || tableInfo.length === 0) {
      console.error('Users table not found in sqlite DB - cannot migrate');
      db.close();
      return;
    }

    // Add columns if missing
    const pragma = await new Promise((resolve, reject) => db.all("PRAGMA table_info('users')", (err, rows) => err ? reject(err) : resolve(rows)));
    const cols = (pragma || []).map(c => c.name);

    if (!cols.includes('must_change_password')) {
      await new Promise((resolve, reject) => db.run("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0", (err) => err ? reject(err) : resolve()));
      console.log('Added must_change_password column');
    }
    if (!cols.includes('password_changed_at')) {
      await new Promise((resolve, reject) => db.run("ALTER TABLE users ADD COLUMN password_changed_at DATETIME", (err) => err ? reject(err) : resolve()));
      console.log('Added password_changed_at column');
    }
    if (!cols.includes('token_version')) {
      await new Promise((resolve, reject) => db.run("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0", (err) => err ? reject(err) : resolve()));
      console.log('Added token_version column');
    }
    if (!cols.includes('failed_login_attempts')) {
      await new Promise((resolve, reject) => db.run("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0", (err) => err ? reject(err) : resolve()));
      console.log('Added failed_login_attempts column');
    }
    if (!cols.includes('locked_until')) {
      await new Promise((resolve, reject) => db.run("ALTER TABLE users ADD COLUMN locked_until DATETIME", (err) => err ? reject(err) : resolve()));
      console.log('Added locked_until column');
    }

    // Add audit_logs table if missing
    const auditInfo = await new Promise((resolve, reject) => db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'", (e, r) => e ? reject(e) : resolve(r)));
    if (!auditInfo || auditInfo.length === 0) {
      await new Promise((resolve, reject) => db.run(`CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER,
        actor_employee_id TEXT,
        target_employee_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => err ? reject(err) : resolve()));
      console.log('Created audit_logs table');
    }

    db.close();
    console.log('Migration helper completed');
  } catch (err) {
    console.error('Migration helper error:', err && err.message ? err.message : err);
  }
})();