const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("backend_dev.sqlite");

db.all("SELECT id, employee_id, name, email, role, must_change_password FROM users", (err, rows) => {
  if (err) {
    console.error("ERR", err);
  } else {
    console.log("USERS", rows);
  }
  db.close();
});
