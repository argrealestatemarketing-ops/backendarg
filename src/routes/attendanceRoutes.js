const express = require("express");
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/today/:employeeId", authMiddleware.verifyAccessToken.bind(authMiddleware), attendanceController.getTodayStatus);
router.get("/monthly/:employeeId", authMiddleware.verifyAccessToken.bind(authMiddleware), attendanceController.getMonthlyAttendance);
router.get("/detail/:employeeId/:date", authMiddleware.verifyAccessToken.bind(authMiddleware), attendanceController.getAttendanceDetail);
router.get("/not-checked-in", authMiddleware.verifyAccessToken.bind(authMiddleware), roleMiddleware(["hr"]), attendanceController.getNotCheckedInToday);

// Read-only test endpoint to query fingerprint Access DB (fingerprint service removed)
// router.get("/test/:employeeId", attendanceController.testFingerprintAttendance);
// Read-only test endpoint to query Employee Excel
router.get("/test-excel/:employeeId", authMiddleware.verifyAccessToken.bind(authMiddleware), roleMiddleware(["hr", "admin"]), attendanceController.testExcelEmployee);

module.exports = router;
