const cron = require("node-cron");
const ImportJob = require("../models/repositories/ImportJob");
const { auditLogger } = require("../utils/logger");

/**
 * Scheduler currently performs operational maintenance only.
 * Fingerprint auto-import was removed, so this keeps import jobs healthy by
 * marking stale "running" jobs as failed.
 */
function startScheduler() {
  const enabled = process.env.IMPORT_SCHEDULE_ENABLED !== "false";
  if (!enabled) {
    auditLogger.info("Import scheduler disabled by configuration", {
      timestamp: new Date().toISOString()
    });
    return;
  }

  const schedule = process.env.IMPORT_SCHEDULE_CRON || "*/30 * * * *"; // every 30 minutes
  const maxRunningMinutes = Number.parseInt(process.env.IMPORT_JOB_MAX_MINUTES || "120", 10);

  auditLogger.info("Import scheduler started", {
    schedule,
    maxRunningMinutes,
    timestamp: new Date().toISOString()
  });

  cron.schedule(
    schedule,
    async () => {
      const staleBefore = new Date(Date.now() - maxRunningMinutes * 60 * 1000);
      try {
        const result = await ImportJob.updateMany(
          { status: "running", startedAt: { $lt: staleBefore } },
          {
            $set: {
              status: "failed",
              finishedAt: new Date(),
              error: "Marked failed by scheduler: stale running job"
            }
          }
        );

        if (result.modifiedCount > 0) {
          auditLogger.warn("Scheduler marked stale import jobs as failed", {
            modifiedCount: result.modifiedCount,
            staleBefore: staleBefore.toISOString(),
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        auditLogger.error("Import scheduler execution failed", {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    },
    { scheduled: true }
  );
}

module.exports = { startScheduler };
