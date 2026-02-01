const { User, LeaveBalance, LeaveRequest, Attendance } = require("../models");
const importer = require("../services/fingerprintImportService");

const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ["id","employeeId","name","email","role"] });
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    console.error("[DEBUG] getUsers error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
};

const getLeaveBalances = async (req, res) => {
  try {
    const items = await LeaveBalance.findAll();
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    console.error("[DEBUG] getLeaveBalances error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch leave balances" });
  }
};

const getAll = async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ["id","employeeId","name","email","role"] });
    const leaveBalances = await LeaveBalance.findAll();
    const leaveRequests = await LeaveRequest.findAll();
    const attendance = await Attendance.findAll({ limit: 500 });

    res.json({ success: true, users, leaveBalances, leaveRequests, attendance });
  } catch (err) {
    console.error("[DEBUG] getAll error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch data" });
  }
};

// POST /api/debug/import/fingerprint
const importFingerprint = async (req, res) => {
  try {
    const { startDate, endDate, dryRun } = req.body || {};

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const summary = await importer.importFingerprint({ startDate: start, endDate: end, dryRun: !!dryRun });

    res.json({ success: true, summary });
  } catch (err) {
    console.error("[DEBUG] importFingerprint error:", err);
    res.status(500).json({ success: false, error: "Failed to run import", details: err.message });
  }
};

module.exports = { getUsers, getLeaveBalances, getAll, importFingerprint };