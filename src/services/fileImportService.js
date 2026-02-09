const ExcelJS = require("exceljs");
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

async function extractUsersFromWorkbook(workbook) {
  const users = new Map();
  const worksheet = workbook.getWorksheet("users") || workbook.worksheets[0];
  if (!worksheet) return users;

  // Get header row
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.map((h) => (h === undefined || h === null ? null : String(h).trim()));

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const rowObj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber] || `col${colNumber}`;
      rowObj[key] = cell.value === undefined ? null : cell.value;
    });

    const pin = rowObj.Pin || rowObj.PIN || rowObj.pin || rowObj.EmployeeId || rowObj.employeeId || rowObj.EmployeeID || rowObj.ID || rowObj.Id;
    const name = rowObj.Name || rowObj.FullName || rowObj.NAME;
    if (!pin) return;

    const pinString = String(pin).trim();
    users.set(pinString, {
      pin: pinString,
      name: name ? String(name).trim() : null
    });
  });

  return users;
}

function extractAttendanceRowsFromWorkbook(workbook) {
  const attendanceRows = [];
  const worksheet = workbook.getWorksheet("attendance") || workbook.worksheets[0];
  if (!worksheet) return attendanceRows;

  // Get header row
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.map((h) => (h === undefined || h === null ? null : String(h).trim()));

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowObj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber] || `col${colNumber}`;
      rowObj[key] = cell.value === undefined ? null : cell.value;
    });

    const pin = rowObj.Pin || rowObj.PIN || rowObj.pin || rowObj.EmployeeId || rowObj.employeeId || rowObj.EmployeeID || rowObj.ID || rowObj.Id;
    const dateValue = rowObj.Date || rowObj.date || rowObj.CheckDate || rowObj.CHECKDATE || rowObj.Check_Date;
    const timeValue = rowObj.Time || rowObj.time || rowObj.CheckTime || rowObj.CHECKTIME || rowObj.Check_Time;
    if (!pin || !dateValue) continue;

    const parsed = timeValue ? new Date(`${dateValue} ${timeValue}`) : new Date(String(dateValue));
    if (Number.isNaN(parsed.getTime())) continue;

    attendanceRows.push({
      employeeId: String(pin).trim(),
      checkTime: parsed
    });
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
      const workbookPath = workbook;
      const reader = new ExcelJS.Workbook();
      await reader.xlsx.readFile(workbookPath);
      wb = reader;
    }

    const users = await extractUsersFromWorkbook(wb);
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
