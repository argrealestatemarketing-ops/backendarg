const importer = require("../services/fingerprintImportService");
const fileImporter = require("../services/fileImportService");
const mongoSync = require("../services/fingerprintToMongoService");
const { ImportJob } = require("../models");

const importFingerprint = async (req, res) => {
  const { startDate, endDate, dryRun } = req.body || {};
  const userId = req.user ? req.user.dbUserId : null;

  // Record job as running
  let job = null;
  try {
    job = await ImportJob.create({ type: "fingerprint", status: "running", startedAt: new Date(), createdBy: userId });

    const summary = await importer.importFingerprint({ startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined, dryRun: !!dryRun });

    job.status = "success";
    job.endedAt = new Date();
    job.summary = JSON.stringify(summary);
    await job.save();

    res.json({ success: true, summary, jobId: job.id });
  } catch (err) {
    if (job) {
      job.status = "failed";
      job.endedAt = new Date();
      job.summary = JSON.stringify({ error: err && err.message ? err.message : String(err) });
      try { await job.save(); } catch (e) { console.error("[ADMIN] Failed to persist import job:", e); }
    }
    console.error("[ADMIN] importFingerprint error:", err && err.message ? err.message : err);
    res.status(500).json({ success: false, error: "Import failed", details: err && err.message ? err.message : String(err) });
  }
};

// POST /api/admin/import/upload (multipart/form-data, file field `file`, optional dryRun boolean)
const importFromFile = async (req, res) => {
  const userId = req.user ? req.user.dbUserId : null;
  const file = req.file;
  const dryRun = req.body && (req.body.dryRun === "true" || req.body.dryRun === "1" || req.body.dryRun === true);

  if (!file) return res.status(400).json({ success: false, error: "No file uploaded. Use field name \"file\" with .xlsx or .xls or .csv" });

  let job = null;
  try {
    job = await ImportJob.create({ type: "file_import", status: "running", startedAt: new Date(), createdBy: userId });

    const summary = await fileImporter.importFromWorkbook(file.path, { dryRun });

    job.status = "success";
    job.endedAt = new Date();
    job.summary = JSON.stringify(summary);
    await job.save();

    res.json({ success: true, summary, jobId: job.id });
  } catch (err) {
    if (job) {
      job.status = "failed";
      job.endedAt = new Date();
      job.summary = JSON.stringify({ error: err && err.message ? err.message : String(err) });
      try { await job.save(); } catch (e) { console.error("[ADMIN] Failed to persist file import job:", e); }
    }
    console.error("[ADMIN] importFromFile error:", err && err.message ? err.message : err);
    res.status(500).json({ success: false, error: "File import failed", details: err && err.message ? err.message : String(err) });
  }
};

// POST /api/admin/sync/fingerprint-to-mongo
const syncFingerprintToMongo = async (req, res) => {
  const userId = req.user ? req.user.dbUserId : null;
  const dryRun = req.body && (req.body.dryRun === "true" || req.body.dryRun === "1" || req.body.dryRun === true);
  const defaultPassword = req.body && req.body.defaultPassword ? req.body.defaultPassword : process.env.IMPORT_DEFAULT_PASSWORD || "123456";

  // Record job as running
  let job = null;
  try {
    job = await ImportJob.create({ type: "fingerprint_to_mongo", status: "running", startedAt: new Date(), createdBy: userId });

    const summary = await mongoSync.syncFingerprintUsersToMongo({ dryRun: !!dryRun, defaultPassword });

    job.status = "success";
    job.endedAt = new Date();
    job.summary = JSON.stringify(summary);
    await job.save();

    res.json({ success: true, summary, jobId: job.id });
  } catch (err) {
    if (job) {
      job.status = "failed";
      job.endedAt = new Date();
      job.summary = JSON.stringify({ error: err && err.message ? err.message : String(err) });
      try { await job.save(); } catch (e) { console.error("[ADMIN] Failed to persist sync job:", e); }
    }
    console.error("[ADMIN] syncFingerprintToMongo error:", err && err.message ? err.message : err);
    // Do not leak internal errors to client
    res.status(500).json({ success: false, error: "Sync failed" });
  }
};

module.exports = { importFingerprint, importFromFile, syncFingerprintToMongo };