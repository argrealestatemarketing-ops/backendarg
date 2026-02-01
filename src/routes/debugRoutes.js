const express = require("express");
const router = express.Router();
const debugController = require("../controllers/debugController");

// Dev-only routes to inspect DB
router.get("/users", debugController.getUsers);
router.get("/leave-balances", debugController.getLeaveBalances);
router.get("/all", debugController.getAll);

// Dev-only import endpoint for fingerprint DB (POST body: { startDate, endDate, dryRun })
router.post("/import/fingerprint", debugController.importFingerprint);

module.exports = router;