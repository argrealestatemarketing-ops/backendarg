const express = require("express");
const leaveController = require("../controllers/leaveController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Wrapper function to properly bind the middleware
const verifyAuth = (req, res, next) => {
  return authMiddleware.verifyAccessToken(req, res, next);
};

// Employee routes (employeeId comes from JWT, NOT URL params)
router.get("/balance", verifyAuth, leaveController.getLeaveBalance);
router.get("/requests", verifyAuth, leaveController.getLeaveRequests);
router.post("/request", verifyAuth, leaveController.requestLeave);

// HR routes
router.get("/all", verifyAuth, roleMiddleware(["hr"]), leaveController.getAllLeaveRequests);
router.post("/approve/:requestId", verifyAuth, roleMiddleware(["hr"]), leaveController.approveLeaveRequest);
router.post("/reject/:requestId", verifyAuth, roleMiddleware(["hr"]), leaveController.rejectLeaveRequest);
router.get("/pending/count", verifyAuth, roleMiddleware(["hr"]), leaveController.getPendingLeaveRequestsCount);

module.exports = router;
