const fs = require('fs');
const path = require('path');
const { sequelize, User, LeaveBalance, LeaveRequest, Attendance } = require('../src/models');

async function dump() {
  try {
    await sequelize.authenticate();
    const users = await User.findAll({ attributes: ['employeeId','name','email','role'] });
    const leaveBalances = await LeaveBalance.findAll();
    const leaveRequests = await LeaveRequest.findAll();
    const attendance = await Attendance.findAll({ limit: 1000 });

    const obj = {
      users: users.map(u => u.toJSON()),
      leaveBalances: leaveBalances.map(x => x.toJSON()),
      leaveRequests: leaveRequests.map(x => x.toJSON()),
      attendance: attendance.map(x => x.toJSON()),
      exportedAt: new Date().toISOString()
    };

    const outPath = path.join(__dirname, '..', 'data_dump.json');
    fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), 'utf8');
    console.log('[DUMP] Wrote data to', outPath);
  } catch (err) {
    console.error('[DUMP] Error:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

dump();