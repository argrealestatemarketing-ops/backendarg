const { sequelize, User, LeaveBalance } = require('../src/models');

async function seedBalances() {
  try {
    await sequelize.authenticate();
    console.log('[SEED] DB connected. Seeding leave balances...');

    const users = await User.findAll({ attributes: ['employeeId'] });
    const year = new Date().getFullYear();
    let created = 0;

    for (const u of users) {
      const employeeId = u.employeeId;
      const [lb, lbCreated] = await LeaveBalance.findOrCreate({
        where: { employeeId, year },
        defaults: { totalDays: 20, usedDays: 0, remainingDays: 20 }
      });
      if (lbCreated) {
        created++;
        console.log(`[SEED] Created leave balance for ${employeeId} (${year})`);
      }
    }

    console.log(`[SEED] Done. Created ${created} leave balance(s).`);
  } catch (err) {
    console.error('[SEED] Error seeding leave balances:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

seedBalances();