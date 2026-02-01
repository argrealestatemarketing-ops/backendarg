const { sequelize, User, LeaveBalance, Attendance, ImportJob } = require('../src/models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('[LIST] DB OK');

    const users = await User.findAll({ attributes: ['employeeId','name','email','role','mustChangePassword'], limit: 200, order: [['employeeId','ASC']] });
    console.log(`Users (${users.length}):`);
    for (const u of users) console.log(' -', u.employeeId, '|', u.name, '| role:', u.role, '| mustChange:', u.mustChangePassword);

    const lbs = await LeaveBalance.findAll({ limit: 200, order: [['employeeId','ASC']] });
    console.log(`\nLeaveBalances (${lbs.length}):`);
    for (const lb of lbs) console.log(' -', lb.employeeId, lb.year, `total:${lb.totalDays}`, `used:${lb.usedDays}`, `remain:${lb.remainingDays}`);

    const att = await Attendance.findAll({ limit: 200, order: [['date','DESC']] });
    console.log(`\nAttendance (${att.length} recent rows):`);
    for (const a of att.slice(0, 50)) console.log(' -', a.employeeId, a.date, a.checkInTime, a.checkOutTime, a.status);

    const jobs = await ImportJob.findAll({ limit: 50, order: [['startedAt','DESC']] });
    console.log(`\nImportJobs (${jobs.length}):`);
    for (const j of jobs) console.log(' -', j.id, j.type, j.status, j.startedAt, j.endedAt, j.createdBy);

    process.exit(0);
  } catch (err) {
    console.error('[LIST] Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();