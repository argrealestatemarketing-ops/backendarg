const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const fs = require("fs");
const path = require("path");

// Wrapper function to properly bind the middleware
const verifyAuth = (req, res, next) => {
  return authMiddleware.verifyAccessToken(req, res, next);
};

// HR-only import endpoint (fingerprint direct import is intentionally disabled)
// router.post("/import/fingerprint", verifyAuth, roleMiddleware(["hr"]), adminController.importFingerprint);

// HR-only file upload import endpoint (accepts .xlsx/.xls/.csv)
const multer = require("multer");
const uploadDir = path.resolve(process.cwd(), "tmp", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExtensions = new Set([".xlsx", ".xls", ".csv"]);
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExtensions.has(extension)) {
      cb(new Error("Unsupported file type. Use .xlsx, .xls, or .csv"));
      return;
    }
    cb(null, true);
  }
});
router.post("/import/upload", verifyAuth, roleMiddleware(["hr", "admin"]), upload.single("file"), adminController.importFromFile);

// HR-only: fingerprint sync remains intentionally disabled
// router.post("/sync/fingerprint", verifyAuth, roleMiddleware(["hr"]), adminController.syncFingerprintData);

module.exports = router;
