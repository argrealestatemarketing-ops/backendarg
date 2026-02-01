const ADODB = require('node-adodb');
const dbPath = 'C:\\Users\\n\\Desktop\\HR\\fingerprint_db\\fingerprint.mdb';
const provider = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source={DB};Mode=Read;Persist Security Info=False;'.replace('{DB}', dbPath);
console.log('Using provider:', provider);
const connection = ADODB.open(provider);
(async () => {
  try {
    const rows = await connection.query('SELECT TOP 1 * FROM [CHECKINOUT]');
    console.log('Rows:', rows);
  } catch (err) {
    console.error('ERROR running test query:');
    console.error(err);
    if (err && err.stack) console.error(err.stack);
  }
})();