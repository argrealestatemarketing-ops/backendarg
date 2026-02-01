const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend_dev.sqlite');

db.serialize(() => {
  db.all("PRAGMA table_info('users')", (err, rows) => {
    if (err) {
      console.error('ERR PRAGMA', err);
      process.exit(1);
    }
    console.log('SCHEMA:', rows);

    db.all('SELECT * FROM users', (err2, rows2) => {
      if (err2) {
        console.error('ERR SELECT', err2);
        process.exit(1);
      }
      console.log('USERS:', rows2);
      process.exit(0);
    });
  });
});