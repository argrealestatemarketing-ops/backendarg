const { Attendance, sequelize } = require("../models");
const fingerprintService = require("../services/fingerprintService");

const getTodayStatus = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    if (!employeeId || typeof employeeId !== "string") {
      return res.status(400).json({ 
        success: false,
        error: "Valid employee ID is required" 
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const attendanceRecord = await Attendance.findOne({
      where: {
        employeeId: employeeId,
        date: today
      }
    });

    if (!attendanceRecord) {
      return res.status(200).json({
        success: true,
        status: "not_checked_in",
        checkInTime: null,
        checkOutTime: null,
        date: today
      });
    }

    res.status(200).json({
      success: true,
      status: attendanceRecord.status,
      checkInTime: attendanceRecord.checkInTime,
      checkOutTime: attendanceRecord.checkOutTime,
      date: today
    });
  } catch (error) {
    console.error("Get today status error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to get today status" 
    });
  }
};

const getMonthlyAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { year, month } = req.query;

    if (!employeeId) {
      return res.status(400).json({ 
        success: false,
        error: "Employee ID is required" 
      });
    }

    if (!year || !month) {
      return res.status(400).json({ 
        success: false,
        error: "Year and month query parameters are required" 
      });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid year or month format" 
      });
    }

    // Create start and end dates for the month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0); // Last day of the month

    const monthlyAttendance = await Attendance.findAll({
      where: {
        employeeId: employeeId,
        date: {
          [sequelize.Op.gte]: startDate,
          [sequelize.Op.lte]: endDate
        }
      },
      order: [['date', 'ASC']]
    });

    res.status(200).json({
      success: true,
      month: monthNum,
      year: yearNum,
      count: monthlyAttendance.length,
      data: monthlyAttendance
    });
  } catch (error) {
    console.error("Get monthly attendance error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to get monthly attendance" 
    });
  }
};

// Test endpoint to read attendance for today from Fingerprint Access DB (READ ONLY)
const testFingerprintAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "Employee ID is required" });
    }

    try {
      const attendance = await fingerprintService.getTodayAttendance(employeeId);
      return res.status(200).json({ success: true, data: attendance || null });
    } catch (err) {
      console.error("[Attendance] Fingerprint DB error:", err && err.message ? err.message : err);
      if (err && (err.code === "FINGERPRINT_DB_MISSING" || err.code === "FINGERPRINT_DB_NOT_FOUND" || err.code === "FINGERPRINT_DB_CONN_FAILED")) {
        return res.status(503).json({ success: false, error: "Fingerprint database unavailable" });
      }
      if (err && err.code === "FINGERPRINT_DB_TIMEOUT") {
        return res.status(503).json({ success: false, error: "Fingerprint database timeout" });
      }
      return res.status(500).json({ success: false, error: "Failed to query fingerprint attendance" });
    }
  } catch (error) {
    console.error("Test fingerprint attendance error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};



const getAttendanceDetail = async (req, res) => {
  try {
    const { employeeId, date } = req.params;

    if (!employeeId || !date) {
      return res.status(400).json({ 
        success: false,
        error: "Employee ID and date are required" 
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        success: false,
        error: "Date must be in YYYY-MM-DD format" 
      });
    }

    const attendanceRecord = await Attendance.findOne({
      where: {
        employeeId: employeeId,
        date: date
      }
    });

    if (!attendanceRecord) {
      return res.status(404).json({ 
        success: false,
        error: "No attendance record found for this date" 
      });
    }

    res.status(200).json({
      success: true,
      data: attendanceRecord
    });
  } catch (error) {
    console.error("Get attendance detail error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to get attendance detail" 
    });
  }
};

const getNotCheckedInToday = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    
    const { User } = require("../models");

    // Get all employees
    const employees = await User.findAll({
      where: {
        role: "employee"
      },
      attributes: ["id", "employeeId", "name", "email"]
    });

    // Get all attendance records for today
    const attendanceRecords = await Attendance.findAll({
      where: {
        date: today
      },
      attributes: ["employeeId", "status"]
    });

    // Create a map for quick lookup
    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      attendanceMap.set(record.employeeId, record.status);
    });

    // Find employees who are not checked in today
    const notCheckedIn = employees
      .map(employee => {
        const attendanceStatus = attendanceMap.get(employee.employeeId);
        return {
          employeeId: employee.employeeId,
          name: employee.name,
          email: employee.email,
          checkedIn: attendanceStatus === "present"
        };
      })
      .filter(emp => !emp.checkedIn);

    res.status(200).json({
      success: true,
      count: notCheckedIn.length,
      data: notCheckedIn
    });
  } catch (error) {
    console.error("Get not checked-in error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to get not checked-in employees" 
    });
  }
};


const excelService = require("../services/excelEmployeeService");

const testExcelEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) return res.status(400).json({ success: false, error: "Employee ID is required" });

    if (!excelService || !excelService.isEnabled()) {
      return res.status(503).json({ success: false, error: "Employee Excel source not configured" });
    }

    try {
      await excelService.init();
    } catch (e) {
      console.error("[Attendance] Employee Excel init failed:", e && e.message ? e.message : e);
      return res.status(503).json({ success: false, error: "Employee Excel file unavailable" });
    }

    try {
      const exists = await Promise.resolve(excelService.employeeExists(employeeId));
      return res.status(200).json({ success: true, exists });
    } catch (e) {
      console.error("[Attendance] Employee Excel lookup failed:", e && e.message ? e.message : e);
      return res.status(503).json({ success: false, error: "Employee Excel file unavailable" });
    }
  } catch (error) {
    console.error("Test Employee Excel error:", error);
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
