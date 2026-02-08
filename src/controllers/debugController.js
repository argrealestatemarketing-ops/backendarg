const User = require("../models/repositories/User");
const LeaveBalance = require("../models/repositories/LeaveBalance");
const LeaveRequest = require("../models/repositories/LeaveRequest");
const Attendance = require("../models/repositories/Attendance");
const { auditLogger } = require("../utils/logger");

const getUsers = async (req, res) => {
  try {
    const users = await User.find({}, { employeeId: 1, name: 1, email: 1, role: 1 }).lean();
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    auditLogger.error("Debug getUsers error", { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
};

const getLeaveBalances = async (req, res) => {
  try {
    const items = await LeaveBalance.find({}).lean();
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    auditLogger.error("Debug getLeaveBalances error", { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: "Failed to fetch leave balances" });
  }
};

const getAll = async (req, res) => {
  try {
    const users = await User.find({}, { employeeId: 1, name: 1, email: 1, role: 1 }).lean();
    const leaveBalances = await LeaveBalance.find({}).lean();
    const leaveRequests = await LeaveRequest.find({}).sort({ createdAt: -1 }).limit(500).lean();
    const attendance = await Attendance.find({}).sort({ createdAt: -1 }).limit(500).lean();

    res.json({ success: true, users, leaveBalances, leaveRequests, attendance });
  } catch (err) {
    auditLogger.error("Debug getAll error", { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: "Failed to fetch data" });
  }
};

// POST /api/debug/import/fingerprint
const importFingerprint = async (req, res) => {
  return res.status(410).json({
    success: false,
    error: "Fingerprint import service has been removed",
    message: "This endpoint is no longer available"
  });
};

module.exports = { getUsers, getLeaveBalances, getAll, importFingerprint };
