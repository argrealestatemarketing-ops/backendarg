const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('../backend_dev.sqlite');

console.log('Updating root backend_dev.sqlite (numeric IDs only)...');

db.all('SELECT employee_id FROM users WHERE employee_id GLOB "[0-9]*"', (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  console.log('Found ' + rows.length + ' numeric IDs to update');
  let count = 0;
  
  rows.forEach(row => {
    if (/^\d+$/.test(row.employee_id)) {
      const numericId = parseInt(row.employee_id, 10);
      const newId = numericId.toString();
      
      if (newId !== row.employee_id) {
        db.run('UPDATE users SET employee_id = ? WHERE employee_id = ?', [newId, row.employee_id], (err) => {
          if (err) {
            console.error('Update error for ' + row.employee_id + ':', err.message);
          } else {
            console.log('Updated: ' + row.employee_id + ' -> ' + newId);
            count++;
          }
        });
      }
    }
  });
  
  setTimeout(() => {
    console.log('Root SQLite database update complete! ' + count + ' records updated');
    db.close();
  }, 2000);
});