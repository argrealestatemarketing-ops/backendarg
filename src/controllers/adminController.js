const fileImporter = require("../services/fileImportService");
const ImportJob = require("../models/mongo/ImportJob");

const importFingerprint = async (req, res) => {
  const { startDate, endDate, dryRun } = req.body || {};
  // Fingerprint service has been removed
  res.status(410).json({ 
    success: false, 
    error: "Fingerprint import service has been removed",
    message: "This feature is no longer available"
  });
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
  // Fingerprint service has been removed
  res.status(410).json({ 
    success: false, 
    error: "Fingerprint sync service has been removed",
    message: "This feature is no longer available"
  });
};

module.exports = { importFingerprint, importFromFile, syncFingerprintToMongo };