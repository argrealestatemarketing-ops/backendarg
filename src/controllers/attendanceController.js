const Attendance = require("../models/repositories/Attendance");
const User = require("../models/repositories/User");
const excelService = require("../services/excelEmployeeService");
const { auditLogger } = require("../utils/logger");

function formatDateOnly(date) {
  return date.toISOString().split("T")[0];
}

function startOfDay(dateString) {
  const d = new Date(dateString);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dateString) {
  const d = new Date(dateString);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function resolveEmployeeScope(req, res) {
  const employeeId = (req.params.employeeId || "").trim();

  if (!employeeId) {
    res.status(400).json({
      success: false,
      error: "Valid employee ID is required"
    });
    return null;
  }

  if (req.user && req.user.role === "employee" && req.user.employeeId !== employeeId) {
    res.status(403).json({
      success: false,
      error: "Forbidden: You can only access your own attendance"
    });
    return null;
  }

  return employeeId;
}

function toAttendanceResponse(record) {
  return {
    id: record._id.toString(),
    employeeId: record.employeeId,
    date: formatDateOnly(new Date(record.date)),
    checkInTime: record.checkInTime || null,
    checkOutTime: record.checkOutTime || null,
    status: record.status || "absent"
  };
}

const getTodayStatus = async (req, res) => {
  try {
    const employeeId = resolveEmployeeScope(req, res);
    if (!employeeId) return;

    const today = formatDateOnly(new Date());
    const record = await Attendance.findOne({
      employeeId,
      date: { $gte: startOfDay(today), $lte: endOfDay(today) }
    }).lean();

    if (!record) {
      return res.status(200).json({
        success: true,
        status: "not_checked_in",
        checkInTime: null,
        checkOutTime: null,
        date: today
      });
    }

    return res.status(200).json({
      success: true,
      ...toAttendanceResponse(record)
    });
  } catch (error) {
    auditLogger.error("Get today status error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to get today status"
    });
  }
};

const getMonthlyAttendance = async (req, res) => {
  try {
    const employeeId = resolveEmployeeScope(req, res);
    if (!employeeId) return;

    const yearNum = Number.parseInt(req.query.year, 10);
    const monthNum = Number.parseInt(req.query.month, 10);

    if (!Number.isInteger(yearNum) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        error: "Invalid year or month format"
      });
    }

    const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));

    const monthlyAttendance = await Attendance.find({
      employeeId,
      date: { $gte: startDate, $lte: endDate }
    })
      .sort({ date: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      month: monthNum,
      year: yearNum,
      count: monthlyAttendance.length,
      data: monthlyAttendance.map((record) => toAttendanceResponse(record))
    });
  } catch (error) {
    auditLogger.error("Get monthly attendance error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to get monthly attendance"
    });
  }
};

const getAttendanceDetail = async (req, res) => {
  try {
    const employeeId = resolveEmployeeScope(req, res);
    if (!employeeId) return;

    const { date } = req.params;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: "Date must be in YYYY-MM-DD format"
      });
    }

    const attendanceRecord = await Attendance.findOne({
      employeeId,
      date: { $gte: startOfDay(date), $lte: endOfDay(date) }
    }).lean();

    if (!attendanceRecord) {
      return res.status(404).json({
        success: false,
        error: "No attendance record found for this date"
      });
    }

    return res.status(200).json({
      success: true,
      data: toAttendanceResponse(attendanceRecord)
    });
  } catch (error) {
    auditLogger.error("Get attendance detail error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to get attendance detail"
    });
  }
};

const getNotCheckedInToday = async (req, res) => {
  try {
    const today = formatDateOnly(new Date());
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const [employees, attendanceRecords] = await Promise.all([
      User.find(
        { role: "employee", status: { $ne: "inactive" } },
        { employeeId: 1, name: 1, email: 1 }
      ).lean(),
      Attendance.find(
        {
          date: { $gte: todayStart, $lte: todayEnd },
          status: { $in: ["present", "late", "half_day"] }
        },
        { employeeId: 1 }
      ).lean()
    ]);

    const checkedInSet = new Set(attendanceRecords.map((record) => record.employeeId));
    const notCheckedIn = employees
      .filter((employee) => !checkedInSet.has(employee.employeeId))
      .map((employee) => ({
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email || null,
        checkedIn: false
      }));

    return res.status(200).json({
      success: true,
      count: notCheckedIn.length,
      data: notCheckedIn
    });
  } catch (error) {
    auditLogger.error("Get not checked-in employees error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      error: "Failed to get not checked-in employees"
    });
  }
};

const testFingerprintAttendance = async (req, res) => {
  return res.status(410).json({
    success: false,
    error: "Fingerprint service has been removed",
    message: "This endpoint is no longer available"
  });
};

const testExcelEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "Employee ID is required" });
    }

    if (!excelService || !excelService.isEnabled()) {
      return res.status(503).json({ success: false, error: "Employee Excel source not configured" });
    }

    await excelService.init();
    const exists = await Promise.resolve(excelService.employeeExists(employeeId));
    return res.status(200).json({ success: true, exists });
  } catch (error) {
    auditLogger.error("Test Employee Excel error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    if (error.code === "EMPLOYEE_EXCEL_MISSING") {
      return res.status(503).json({ success: false, error: "Employee Excel file unavailable" });
    }

    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = {
  getTodayStatus,
  getMonthlyAttendance,
  getAttendanceDetail,
  getNotCheckedInToday,
  testFingerprintAttendance,
  testExcelEmployee
};
