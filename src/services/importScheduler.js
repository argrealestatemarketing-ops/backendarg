const cron = require("node-cron");
// Fingerprint import service has been removed
const { ImportJob } = require("../models");

function startScheduler() {
  const enabled = process.env.IMPORT_SCHEDULE_ENABLED !== "false";
  if (!enabled) {
    console.info("[ImportScheduler] Disabled by IMPORT_SCHEDULE_ENABLED=false");
    return;
  }

  const schedule = process.env.IMPORT_SCHEDULE_CRON || "0 2 * * *"; // daily at 02:00
  console.info(`[ImportScheduler] Scheduling import job with cron: "${schedule}"`);

  try {
    cron.schedule(schedule, async () => {
      console.info("[ImportScheduler] Cron triggered import job");
      let job = null;
      try {
        job = await ImportJob.create({ type: "fingerprint", status: "running", startedAt: new Date() });
        const summary = await importer.importFingerprint({ /* defaults to last 30 days */ });
        job.status = "success";
        job.endedAt = new Date();
        job.summary = JSON.stringify(summary);
        await job.save();
        console.info("[ImportScheduler] Import job success", summary);
      } catch (err) {
        if (job) {
          job.status = "failed";
          job.endedAt = new Date();
          job.summary = JSON.stringify({ error: err && err.message ? err.message : String(err) });
          try { await job.save(); } catch (e) { console.error("[ImportScheduler] Failed to persist job:", e); }
        }
        console.error("[ImportScheduler] Import job failed:", err && err.message ? err.message : err);
      }
    }, { scheduled: true });
  } catch (err) {
    console.error("[ImportScheduler] Failed to schedule import job:", err && err.message ? err.message : err);
  }
}

module.exports = { startScheduler };