const XLSX = require("xlsx");
const bcrypt = require("bcryptjs");
const User = require("../models/repositories/User");
const Attendance = require("../models/repositories/Attendance");

function toUtcDateOnly(dateString) {
  const [year, month, day] = dateString.split("-").map((v) => Number.parseInt(v, 10));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function dateRangeForDay(dateString) {
  const start = toUtcDateOnly(dateString);
  const end = new Date(start.getTime());
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function normalizeEmployeeCandidates(rawPin) {
  const value = String(rawPin).trim();
  const candidates = [value];

  if (/^\d+$/.test(value)) {
    const normalized = value.replace(/^0+/, "") || "0";
    candidates.push(`EMP${normalized.padStart(3, "0")}`);
    candidates.push(normalized.padStart(3, "0"));
    candidates.push(normalized.padStart(4, "0"));
  }

  return [...new Set(candidates)];
}

function extractUsersFromWorkbook(workbook) {
  const users = new Map();
  const sheetNamesLower = workbook.SheetNames.map((s) => s.toLowerCase());
  const usersSheetName = workbook.SheetNames[sheetNamesLower.indexOf("users")];

  if (usersSheetName) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[usersSheetName], { defval: null });
    for (const row of rows) {
      const pin = row.Pin || row.PIN || row.pin || row.EmployeeId || row.employeeId || row.EmployeeID || row.ID || row.Id;
      const name = row.Name || row.FullName || row.NAME;
      if (!pin) continue;

      const pinString = String(pin).trim();
      users.set(pinString, {
        pin: pinString,
        name: name ? String(name).trim() : null
      });
    }
  }

  return users;
}

function extractAttendanceRowsFromWorkbook(workbook) {
  const attendanceRows = [];
  const sheetNamesLower = workbook.SheetNames.map((s) => s.toLowerCase());
  const attendanceSheetName = workbook.SheetNames[sheetNamesLower.indexOf("attendance")];

  const parseRows = (rows) => {
    for (const row of rows) {
      const pin = row.Pin || row.PIN || row.pin || row.EmployeeId || row.employeeId || row.EmployeeID || row.ID || row.Id;
      const dateValue = row.Date || row.date || row.CheckDate || row.CHECKDATE || row.Check_Date;
      const timeValue = row.Time || row.time || row.CheckTime || row.CHECKTIME || row.Check_Time;
      if (!pin || !dateValue) continue;

      const parsed = timeValue ? new Date(`${dateValue} ${timeValue}`) : new Date(String(dateValue));
      if (Number.isNaN(parsed.getTime())) continue;

      attendanceRows.push({
        employeeId: String(pin).trim(),
        checkTime: parsed
      });
    }
  };

  if (attendanceSheetName) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[attendanceSheetName], { defval: null });
    parseRows(rows);
    return attendanceRows;
  }

  if (workbook.SheetNames.length > 0) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null });
    parseRows(rows);
  }

  return attendanceRows;
}

async function upsertUsers(users, summary, { dryRun, passwordHash }) {
  for (const [, userInfo] of users.entries()) {
    const employeeCandidates = normalizeEmployeeCandidates(userInfo.pin);
    const canonicalEmployeeId = employeeCandidates.find((id) => id.startsWith("EMP")) || employeeCandidates[0];
    const name = userInfo.name || `User ${canonicalEmployeeId}`;

    const existing = await User.findOne({
      employeeId: { $in: employeeCandidates }
    });

    if (existing) {
      const updates = {};
      if (!existing.name || !existing.name.trim()) {
        updates.name = name;
      }
      if (!existing.password) {
        updates.password = passwordHash;
        updates.mustChangePassword = true;
      }

      if (Object.keys(updates).length > 0) {
        summary.usersUpdated += 1;
        if (!dryRun) {
          await User.updateOne({ _id: existing._id }, { $set: updates });
        }
      }
      continue;
    }

    summary.usersCreated += 1;
    if (!dryRun) {
      try {
        await User.create({
          employeeId: canonicalEmployeeId,
          name,
          role: "employee",
          password: passwordHash,
          mustChangePassword: true,
          tokenVersion: 0,
          status: "active"
        });
      } catch (error) {
        summary.errors.push({
          type: "user_create",
          employeeId: canonicalEmployeeId,
          error: error.message
        });
      }
    }
  }
}

async function upsertAttendance(attendanceRows, summary, { dryRun }) {
  const rowsByEmployeeAndDate = new Map();

  for (const row of attendanceRows) {
    const employeeCandidates = normalizeEmployeeCandidates(row.employeeId);
    const canonicalEmployeeId = employeeCandidates.find((id) => id.startsWith("EMP")) || employeeCandidates[0];
    const dateKey = row.checkTime.toISOString().split("T")[0];
    const key = `${canonicalEmployeeId}::${dateKey}`;

    if (!rowsByEmployeeAndDate.has(key)) {
      rowsByEmployeeAndDate.set(key, []);
    }
    rowsByEmployeeAndDate.get(key).push(row.checkTime);
  }

  for (const [key, times] of rowsByEmployeeAndDate.entries()) {
    const [employeeId, dateKey] = key.split("::");
    times.sort((a, b) => a - b);

    const checkIn = times[0];
    const checkOut = times.length > 1 ? times[times.length - 1] : null;
    const checkInText = checkIn ? checkIn.toISOString().split("T")[1].substring(0, 8) : null;
    const checkOutText = checkOut ? checkOut.toISOString().split("T")[1].substring(0, 8) : null;

    const { start, end } = dateRangeForDay(dateKey);
    const existing = await Attendance.findOne({
      employeeId,
      date: { $gte: start, $lte: end }
    });

    if (!existing) {
      summary.attendanceCreated += 1;
      if (!dryRun) {
        await Attendance.create({
          employeeId,
          date: start,
          checkInTime: checkInText,
          checkOutTime: checkOutText,
          status: checkInText ? "present" : "absent"
        });
      }
      continue;
    }

    const updates = {};
    if (checkInText && existing.checkInTime !== checkInText) {
      updates.checkInTime = checkInText;
    }
    if (checkOutText && existing.checkOutTime !== checkOutText) {
      updates.checkOutTime = checkOutText;
    }
    if (Object.keys(updates).length > 0) {
      summary.attendanceUpdated += 1;
      if (!dryRun) {
        await Attendance.updateOne({ _id: existing._id }, { $set: updates });
      }
    }
  }
}

// Accepts a workbook path or workbook object and options { dryRun }
async function importFromWorkbook(workbook, { dryRun = false } = {}) {
  const summary = {
    usersFound: 0,
    usersCreated: 0,
    usersUpdated: 0,
    attendanceRowsFound: 0,
    attendanceCreated: 0,
    attendanceUpdated: 0,
    warnings: [],
    errors: []
  };

  try {
    let wb = workbook;
    if (typeof workbook === "string") {
      wb = XLSX.readFile(workbook);
    }

    const users = extractUsersFromWorkbook(wb);
    const attendanceRows = extractAttendanceRowsFromWorkbook(wb);

    summary.usersFound = users.size;
    summary.attendanceRowsFound = attendanceRows.length;

    const defaultPassword = process.env.IMPORT_DEFAULT_PASSWORD || "ChangeMe@123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await upsertUsers(users, summary, { dryRun, passwordHash });
    await upsertAttendance(attendanceRows, summary, { dryRun });

    return summary;
  } catch (error) {
    summary.errors.push({
      type: "general",
      error: error && error.message ? error.message : String(error)
    });
    return summary;
  }
}

module.exports = { importFromWorkbook };
