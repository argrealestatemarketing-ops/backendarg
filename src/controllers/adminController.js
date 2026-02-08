const fileImporter = require("../services/fileImportService");
const ImportJob = require("../models/repositories/ImportJob");
const AuditLog = require("../models/repositories/AuditLog");
const { auditLogger } = require("../utils/logger");

const importFingerprint = async (req, res) => {
  res.status(410).json({
    success: false, 
    error: "Fingerprint import service has been removed",
    message: "This feature is no longer available"
  });
};

// POST /api/admin/import/upload (multipart/form-data, file field `file`, optional dryRun boolean)
const importFromFile = async (req, res) => {
  const userId = req.user ? String(req.user.id) : null;
  const actorEmployeeId = req.user ? req.user.employeeId : null;
  const file = req.file;
  const dryRun = req.body && (req.body.dryRun === "true" || req.body.dryRun === "1" || req.body.dryRun === true);

  if (!file) return res.status(400).json({ success: false, error: "No file uploaded. Use field name \"file\" with .xlsx or .xls or .csv" });

  let job = null;
  try {
    job = await ImportJob.create({
      type: "file_upload",
      status: "running",
      startedAt: new Date(),
      createdBy: userId
    });

    const summary = await fileImporter.importFromWorkbook(file.path, { dryRun });

    job.status = "completed";
    job.finishedAt = new Date();
    job.summary = summary;
    job.result = summary;
    await job.save();

    try {
      await AuditLog.create({
        actorId: userId || "unknown",
        actorEmployeeId: actorEmployeeId || "unknown",
        targetEmployeeId: "N/A",
        action: "file_import_completed",
        details: {
          jobId: String(job._id),
          dryRun,
          summary
        },
        createdAt: new Date()
      });
    } catch (auditError) {
      auditLogger.warn("Failed to persist import completion audit log", {
        error: auditError.message,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, summary, jobId: job._id.toString() });
  } catch (err) {
    if (job) {
      job.status = "failed";
      job.finishedAt = new Date();
      job.error = err && err.message ? err.message : String(err);
      job.summary = { error: job.error };
      try {
        await job.save();
      } catch (saveErr) {
        auditLogger.error("Failed to persist file import job", {
          error: saveErr.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    auditLogger.error("Admin importFromFile error", {
      error: err && err.message ? err.message : String(err),
      timestamp: new Date().toISOString()
    });

    try {
      await AuditLog.create({
        actorId: userId || "unknown",
        actorEmployeeId: actorEmployeeId || "unknown",
        targetEmployeeId: "N/A",
        action: "file_import_failed",
        details: {
          dryRun,
          error: err && err.message ? err.message : String(err)
        },
        createdAt: new Date()
      });
    } catch (auditError) {
      auditLogger.warn("Failed to persist import failure audit log", {
        error: auditError.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({ success: false, error: "File import failed", details: err && err.message ? err.message : String(err) });
  }
};

// POST /api/admin/sync/fingerprint (disabled)
const syncFingerprintData = async (req, res) => {
  // Fingerprint sync service is intentionally disabled
  res.status(410).json({ 
    success: false, 
    error: "Fingerprint sync service has been removed",
    message: "This feature is no longer available"
  });
};

module.exports = { importFingerprint, importFromFile, syncFingerprintData };
