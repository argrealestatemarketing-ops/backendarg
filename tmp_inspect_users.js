const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("backend_dev.sqlite");

db.all("PRAGMA table_info('users')", (err, rows) => {
  if (err) {
    console.error("ERR", err);
  } else {
    console.log("SCHEMA", rows);
  }
  db.close();
});
