const fetch = require('node-fetch').default;

async function run() {
  const loginRes = await fetch('http://127.0.0.1:39772/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'EMP001', password: '123456' })
  });
  const loginJson = await loginRes.json();
  console.log('LOGIN:', loginRes.status, loginJson);
  if (!loginJson.token) process.exit(1);
  const token = loginJson.token;

  const balRes = await fetch('http://127.0.0.1:39772/api/leave/balance/EMP001', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const balJson = await balRes.json();
  console.log('BALANCE:', balRes.status, balJson);
}

run().catch(e => { console.error('ERR', e); process.exit(1); });