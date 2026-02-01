const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Wrapper function to properly bind the middleware
const verifyAuth = (req, res, next) => {
  return authMiddleware.verifyAccessToken(req, res, next);
};

// HR-only import endpoint (fingerprint service removed)
// router.post("/import/fingerprint", verifyAuth, roleMiddleware(["hr"]), adminController.importFingerprint);

// HR-only file upload import endpoint (accepts .xlsx/.xls/.csv)
const multer = require("multer");
const upload = multer({ dest: "tmp/uploads" });
router.post("/import/upload", verifyAuth, roleMiddleware(["hr"]), upload.single("file"), adminController.importFromFile);

// HR-only: sync users from fingerprint Access DB into MongoDB (fingerprint service removed)
// router.post("/sync/fingerprint-to-mongo", verifyAuth, roleMiddleware(["hr"]), adminController.syncFingerprintToMongo);

module.exports = router;