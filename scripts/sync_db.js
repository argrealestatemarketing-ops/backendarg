const { sequelize } = require('../src/models');

(async () => {
  try {
    console.log('[DB SYNC] Starting sequelize.sync({ alter: true })');
    await sequelize.sync({ alter: true });
    console.log('[DB SYNC] Completed');
  } catch (err) {
    console.error('[DB SYNC] Error during sync:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();