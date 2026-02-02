const LeaveBalance = require("../models/mongo/LeaveBalance");
const LeaveRequest = require("../models/mongo/LeaveRequest");

const getLeaveBalance = async (req, res) => {
  try {
    // Extract employeeId from JWT, NOT from URL params
    const employeeId = req.user?.employeeId;

    if (!employeeId) {
      console.error("[LEAVE] No employeeId in JWT token");
      return res.status(400).json({ 
        success: false,
        error: "Employee ID not found in token" 
      });
    }

    const currentYear = new Date().getFullYear();
    
    let balance = await LeaveBalance.findOne({
      where: {
        employeeId: employeeId,
        year: currentYear
      }
    });

    // Fallback: if employeeId is numeric, try EMP-prefixed format (EMP###)
    if (!balance && /^\d+$/.test(employeeId)) {
      const prefixed = "EMP" + employeeId.toString().padStart(3, "0");
      balance = await LeaveBalance.findOne({
        where: {
          employeeId: prefixed,
          year: currentYear
        }
      });
      if (balance) {
        console.info(`[LEAVE] Found leave balance by mapping ${employeeId} -> ${prefixed}`);
      }
    }

    if (!balance) {
      console.warn(`[LEAVE] Leave balance not found for employee: ${employeeId}`);
      return res.status(404).json({ 
        success: false,
        error: "Leave balance not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error("[LEAVE] Get leave balance error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to get leave balance" 
    });
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    // Extract employeeId from JWT, NOT from URL params
    const employeeId = req.user?.employeeId;
    const { status } = req.query;

    if (!employeeId) {
      console.error("[LEAVE] No employeeId in JWT token");
      return res.status(400).json({ 
        success: false,
        error: "Employee ID not found in token" 
      });
    }

    let whereClause = { employeeId: employeeId };
    
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      whereClause.status = status;
    }

    const requests = await LeaveRequest.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error("[LEAVE] Get leave requests error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to get leave requests" 
    });
  }
};

const requestLeave = async (req, res) => {
  try {
    // Extract employeeId from JWT, NOT from URL params
    const employeeId = req.user?.employeeId;
    const { fromDate, toDate, reason } = req.body;

    if (!employeeId) {
      console.error("[LEAVE] No employeeId in JWT token");
      return res.status(400).json({ 
        success: false,
        error: "Employee ID not found in token" 
      });
    }

    // Validation
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        error: "From date and to date are required"
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Reason is required"
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
      return res.status(400).json({
        success: false,
        error: "Dates must be in YYYY-MM-DD format"
      });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (from > to) {
      return res.status(400).json({
        success: false,
        error: "From date must be before to date"
      });
    }

    if (from < new Date()) {
      return res.status(400).json({
        success: false,
        error: "Cannot request leave for past dates"
      });
    }

    const newLeaveRequest = await LeaveRequest.create({
      employeeId,
      employeeName: req.user.name,
      fromDate,
      toDate,
      reason: reason.trim(),
      status: "pending"
    });

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: newLeaveRequest
    });
  } catch (error) {
    console.error("Request leave error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to request leave" 
    });
  }
};

const getAllLeaveRequests = async (req, res) => {
  try {
    const { status } = req.query;

    let whereClause = {};
    
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      whereClause.status = status;
    }

    const requests = await LeaveRequest.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error("Get all leave requests error:", error);
    res.status(500).json({ 
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

    const leaveRequest = await LeaveRequest.findByPk(parseInt(requestId));

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

    await leaveRequest.update({
      status: "approved",
      approvedAt: new Date(),
      approvedBy: req.user.name
    });

    res.status(200).json({
      success: true,
      message: "Leave request approved",
      data: leaveRequest
    });
  } catch (error) {
    console.error("Approve leave request error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to approve leave request" 
    });
  }
};

const rejectLeaveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const leaveRequest = await LeaveRequest.findByPk(parseInt(requestId));

    if (!leaveRequest) {
      return res.status(404).json({ success: false, error: "Leave request not found" });
    }

    await leaveRequest.update({
      status: "rejected",
      rejectionReason: reason
    });

    res.status(200).json({
      success: true,
      message: "Leave request rejected",
      data: leaveRequest
    });
  } catch (error) {
    console.error("Reject leave request error:", error);
    res.status(500).json({ success: false, error: "Failed to reject leave request" });
  }
};

const getPendingLeaveRequestsCount = async (req, res) => {
  try {
    const count = await LeaveRequest.count({
      where: {
        status: "pending"
      }
    });

    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error("Get pending leave requests count error:", error);
    res.status(500).json({ success: false, error: "Failed to get pending leave requests count" });
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
