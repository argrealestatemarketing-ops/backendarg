const LeaveBalance = require("../models/repositories/LeaveBalance");
const LeaveRequest = require("../models/repositories/LeaveRequest");
const AuditLog = require("../models/repositories/AuditLog");
const { auditLogger } = require("../utils/logger");

function formatDateOnly(date) {
  return new Date(date).toISOString().split("T")[0];
}

function getYearBounds(year) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { start, end };
}

function daysInclusive(start, end) {
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

function overlapDaysInYear(startDate, endDate, year) {
  const { start: yearStart, end: yearEnd } = getYearBounds(year);
  const start = startDate > yearStart ? startDate : yearStart;
  const end = endDate < yearEnd ? endDate : yearEnd;
  if (start > end) return 0;
  return daysInclusive(start, end);
}

function toLeaveRequestResponse(doc) {
  const startDate = doc.startDate || doc.fromDate;
  const endDate = doc.endDate || doc.toDate;
  return {
    id: doc._id.toString(),
    employeeId: doc.employeeId,
    employeeName: doc.employeeName,
    leaveType: doc.leaveType || "annual",
    fromDate: formatDateOnly(startDate),
    toDate: formatDateOnly(endDate),
    reason: doc.reason,
    status: doc.status,
    rejectionReason: doc.rejectionReason || null,
    approvedBy: doc.approvedBy || null,
    approvedAt: doc.approvedAt || null,
    createdAt: doc.createdAt
  };
}

async function resolveEmployeeId(req, res) {
  const employeeId = req.user?.employeeId;
  if (!employeeId) {
    res.status(400).json({
      success: false,
      error: "Employee ID not found in token"
    });
    return null;
  }

  let finalEmployeeId = employeeId;
  if (/^\d+$/.test(employeeId)) {
    const prefixed = `EMP${employeeId.toString().padStart(3, "0")}`;
    const prefixedExists = await LeaveBalance.exists({ employeeId: prefixed });
    if (prefixedExists) {
      finalEmployeeId = prefixed;
    }
  }
  return finalEmployeeId;
}

async function computeUsedDays(employeeId, year) {
  const { start: yearStart, end: yearEnd } = getYearBounds(year);
  const approvedRequests = await LeaveRequest.find({
    employeeId,
    status: "approved",
    startDate: { $lte: yearEnd },
    endDate: { $gte: yearStart }
  }).lean();

  return approvedRequests.reduce((total, request) => {
    return total + overlapDaysInYear(new Date(request.startDate), new Date(request.endDate), year);
  }, 0);
}

const getLeaveBalance = async (req, res) => {
  try {
    const employeeId = await resolveEmployeeId(req, res);
    if (!employeeId) return;

    const currentYear = new Date().getUTCFullYear();
    let balance = await LeaveBalance.findOne({
      employeeId,
      year: currentYear
    }).lean();

    if (!balance) {
      balance = await LeaveBalance.create({
        employeeId,
        year: currentYear,
        annualLeave: 20,
        sickLeave: 0,
        personalLeave: 0,
        maternityLeave: 0,
        paternityLeave: 0,
        otherLeave: 0
      });
      balance = balance.toObject();
    }

    const totalDays =
      Number(balance.totalDays || 0) ||
      Number(balance.annualLeave || 0) +
        Number(balance.sickLeave || 0) +
        Number(balance.personalLeave || 0) +
        Number(balance.maternityLeave || 0) +
        Number(balance.paternityLeave || 0) +
        Number(balance.otherLeave || 0);

    const usedDays = Number(balance.usedDays || 0) || (await computeUsedDays(employeeId, currentYear));
    const remainingDays = Math.max(Number(balance.remainingDays || totalDays - usedDays), 0);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        year: currentYear,
        totalDays,
        usedDays,
        remainingDays,
        breakdown: {
          annualLeave: Number(balance.annualLeave || 0),
          sickLeave: Number(balance.sickLeave || 0),
          personalLeave: Number(balance.personalLeave || 0),
          maternityLeave: Number(balance.maternityLeave || 0),
          paternityLeave: Number(balance.paternityLeave || 0),
          otherLeave: Number(balance.otherLeave || 0)
        }
      }
    });
  } catch (error) {
    auditLogger.error("Get leave balance error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to get leave balance"
    });
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    const employeeId = await resolveEmployeeId(req, res);
    if (!employeeId) return;

    const { status } = req.query;
    const filter = { employeeId };

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const requests = await LeaveRequest.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests.map((request) => toLeaveRequestResponse(request))
    });
  } catch (error) {
    auditLogger.error("Get leave requests error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to get leave requests"
    });
  }
};

const requestLeave = async (req, res) => {
  try {
    const employeeId = await resolveEmployeeId(req, res);
    if (!employeeId) return;

    const { fromDate, toDate, reason, leaveType } = req.body || {};
    const normalizedLeaveType = leaveType || "annual";
    const allowedLeaveTypes = ["annual", "sick", "personal", "maternity", "paternity", "other"];

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        error: "From date and to date are required"
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: "Reason is required"
      });
    }

    if (!allowedLeaveTypes.includes(normalizedLeaveType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid leave type"
      });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Use YYYY-MM-DD"
      });
    }

    if (from > to) {
      return res.status(400).json({
        success: false,
        error: "From date must be before or equal to to date"
      });
    }

    if (from < today) {
      return res.status(400).json({
        success: false,
        error: "Cannot request leave for past dates"
      });
    }

    const newLeaveRequest = await LeaveRequest.create({
      employeeId,
      employeeName: req.user.name || employeeId,
      leaveType: normalizedLeaveType,
      startDate: from,
      endDate: to,
      reason: String(reason).trim(),
      status: "pending"
    });

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: toLeaveRequestResponse(newLeaveRequest)
    });
  } catch (error) {
    auditLogger.error("Request leave error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to request leave"
    });
  }
};

const getAllLeaveRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const requests = await LeaveRequest.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests.map((request) => toLeaveRequestResponse(request))
    });
  } catch (error) {
    auditLogger.error("Get all leave requests error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to get leave requests"
    });
  }
};

const approveLeaveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: "Request ID is required"
      });
    }

    const leaveRequest = await LeaveRequest.findById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: "Leave request not found"
      });
    }

    if (leaveRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Cannot approve a ${leaveRequest.status} request`
      });
    }

    leaveRequest.status = "approved";
    leaveRequest.approvedAt = new Date();
    leaveRequest.approvedBy = req.user.employeeId;
    leaveRequest.rejectionReason = null;
    await leaveRequest.save();

    try {
      await AuditLog.create({
        actorId: String(req.user.id),
        actorEmployeeId: req.user.employeeId,
        targetEmployeeId: leaveRequest.employeeId,
        action: "leave_approve",
        details: {
          leaveRequestId: String(leaveRequest._id),
          leaveType: leaveRequest.leaveType,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate
        },
        createdAt: new Date()
      });
    } catch (auditError) {
      auditLogger.warn("Failed to persist leave approval audit log", {
        error: auditError.message,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: "Leave request approved",
      data: toLeaveRequestResponse(leaveRequest)
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, error: "Invalid request ID format" });
    }

    auditLogger.error("Approve leave request error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to approve leave request"
    });
  }
};

const rejectLeaveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body || {};

    if (!requestId) {
      return res.status(400).json({ success: false, error: "Request ID is required" });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, error: "Rejection reason is required" });
    }

    const leaveRequest = await LeaveRequest.findById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({ success: false, error: "Leave request not found" });
    }

    leaveRequest.status = "rejected";
    leaveRequest.rejectionReason = String(reason).trim();
    leaveRequest.approvedAt = null;
    leaveRequest.approvedBy = null;
    await leaveRequest.save();

    try {
      await AuditLog.create({
        actorId: String(req.user.id),
        actorEmployeeId: req.user.employeeId,
        targetEmployeeId: leaveRequest.employeeId,
        action: "leave_reject",
        details: {
          leaveRequestId: String(leaveRequest._id),
          leaveType: leaveRequest.leaveType,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          rejectionReason: leaveRequest.rejectionReason
        },
        createdAt: new Date()
      });
    } catch (auditError) {
      auditLogger.warn("Failed to persist leave rejection audit log", {
        error: auditError.message,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: "Leave request rejected",
      data: toLeaveRequestResponse(leaveRequest)
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, error: "Invalid request ID format" });
    }

    auditLogger.error("Reject leave request error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ success: false, error: "Failed to reject leave request" });
  }
};

const getPendingLeaveRequestsCount = async (req, res) => {
  try {
    const count = await LeaveRequest.countDocuments({ status: "pending" });
    return res.status(200).json({ success: true, count });
  } catch (error) {
    auditLogger.error("Get pending leave requests count error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ success: false, error: "Failed to get pending leave requests count" });
  }
};

module.exports = {
  getLeaveBalance,
  getLeaveRequests,
  requestLeave,
  getAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  getPendingLeaveRequestsCount
};
