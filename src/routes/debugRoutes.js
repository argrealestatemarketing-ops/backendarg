const express = require("express");
const router = express.Router();
const debugController = require("../controllers/debugController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware.verifyAccessToken.bind(authMiddleware));
router.use(roleMiddleware(["hr", "admin"]));

// Dev-only routes to inspect DB
router.get("/users", debugController.getUsers);
router.get("/leave-balances", debugController.getLeaveBalances);
router.get("/all", debugController.getAll);

// Dev-only import endpoint for fingerprint DB (fingerprint service removed)
// router.post("/import/fingerprint", debugController.importFingerprint);

module.exports = router;
