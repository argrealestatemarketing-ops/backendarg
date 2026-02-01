const XLSX = require("xlsx");
const { sequelize, User, Attendance } = require("../models");

// Accepts a workbook path or a workbook object and options { dryRun }
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

    // Heuristics: look for sheets named 'users' and 'attendance' (case-insensitive)
    const sheetNames = wb.SheetNames.map(s => s.toLowerCase());
    const usersSheetName = wb.SheetNames[sheetNames.indexOf("users")];
    const attendanceSheetName = wb.SheetNames[sheetNames.indexOf("attendance")];

    const users = new Map();

    // If a users sheet exists, parse users
    if (usersSheetName) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[usersSheetName], { defval: null });
      for (const r of rows) {
        // Accept common columns: Pin, EmployeeId, Name
        const pin = r.Pin || r.PIN || r.pin || r.EmployeeId || r.employeeId || r.EmployeeID || (r.ID || r.Id) || null;
        const name = r.Name || r.FullName || r.NAME || null;
        if (!pin) continue;
        users.set(String(pin).trim(), { pin: String(pin).trim(), name: name ? String(name).trim() : null });
      }
    }

    // If attendance sheet exists, parse attendance rows
    const attendanceRows = [];
    if (attendanceSheetName) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[attendanceSheetName], { defval: null });
      for (const r of rows) {
        const pin = r.Pin || r.PIN || r.pin || r.EmployeeId || r.employeeId || r.EmployeeID || (r.ID || r.Id) || null;
        const dateVal = r.Date || r.date || r.CheckDate || r.Check_Date || null;
        const timeVal = r.Time || r.time || r.CheckTime || r.Check_Time || null;
        const checkType = r.Type || r.type || r.CheckType || null; // optional
        if (!pin || !dateVal) continue;

        // Combine date + time if provided
        let dt = null;
        if (timeVal) {
          dt = new Date(String(dateVal) + " " + String(timeVal));
        } else {
          dt = new Date(String(dateVal));
        }
        if (isNaN(dt.getTime())) {
          summary.warnings.push({ row: r, reason: "Unparsable date/time" });
          continue;
        }
        attendanceRows.push({ employeeId: String(pin).trim(), checkTime: dt });
      }
    }

    // If no dedicated sheets, try first sheet as combined layout
    if (!usersSheetName && !attendanceSheetName && wb.SheetNames.length > 0) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
      for (const r of rows) {
        const pin = r.Pin || r.PIN || r.pin || r.EmployeeId || r.employeeId || r.EmployeeID || (r.ID || r.Id) || null;
        const name = r.Name || r.FullName || r.NAME || null;
        const dateVal = r.Date || r.date || r.CheckDate || r.Check_Date || null;
        const timeVal = r.Time || r.time || r.CheckTime || r.Check_Time || null;
        if (pin && (dateVal || name)) {
          if (name) users.set(String(pin).trim(), { pin: String(pin).trim(), name: String(name).trim() });
          if (dateVal) {
            let dt = null;
            if (timeVal) dt = new Date(String(dateVal) + " " + String(timeVal));
            else dt = new Date(String(dateVal));
            if (!isNaN(dt.getTime())) attendanceRows.push({ employeeId: String(pin).trim(), checkTime: dt });
            else summary.warnings.push({ row: r, reason: "Unparsable date/time" });
          }
        }
      }
    }

    summary.usersFound = users.size;
    summary.attendanceRowsFound = attendanceRows.length;

    await sequelize.authenticate();

    // Prepare default password (configurable via IMPORT_DEFAULT_PASSWORD)
    const bcrypt = require("bcryptjs");
    const defaultPwd = process.env.IMPORT_DEFAULT_PASSWORD || "123456";
    const defaultPwdHash = await bcrypt.hash(defaultPwd, 10);

    // Upsert users
    for (const [pin, u] of users.entries()) {
      const name = u.name || `User ${pin}`;
      // Reuse importFingerprint-style normalization: canonical EMP### for numeric
      let candidate = pin;
      if (/^\d+$/.test(pin)) candidate = "EMP" + pin.replace(/^0+/, "").padStart(3, "0");

      const existing = await User.findOne({ where: { employeeId: candidate } }) || await User.findOne({ where: { employeeId: pin } });
      if (existing) {
        const updates = {};
        if (!existing.name || existing.name.trim().length === 0) updates.name = name;
        // If existing user somehow has no password (shouldn't happen), set default and require change
        if (!existing.password) {
          updates.password = defaultPwdHash;
          updates.mustChangePassword = true;
        }
        if (Object.keys(updates).length > 0) {
          summary.usersUpdated++;
          if (!dryRun) await existing.update(updates);
        }
      } else {
        summary.usersCreated++;
        if (!dryRun) {
          try {
            await User.create({ employeeId: candidate, name, email: null, role: "employee", password: defaultPwdHash, mustChangePassword: true, tokenVersion: 0 });
          } catch (err) {
            summary.errors.push({ type: "user_create", employeeId: candidate, error: err.message });
          }
        }
      }
    }

    // Upsert attendance rows
    const byEmpDate = new Map();
    for (const r of attendanceRows) {
      const d = r.checkTime;
      const dateKey = d.toISOString().split("T")[0];
      const key = `${r.employeeId}::${dateKey}`;
      if (!byEmpDate.has(key)) byEmpDate.set(key, []);
      byEmpDate.get(key).push(d);
    }

    for (const [key, times] of byEmpDate.entries()) {
      const [employeeId, date] = key.split("::");
      times.sort((a,b) => a - b);
      const checkIn = times[0];
      const checkOut = times.length > 1 ? times[times.length - 1] : null;

      // Try existing EMP mapping
      let employeeIdToUse = employeeId;
      if (/^\d+$/.test(employeeId)) employeeIdToUse = "EMP" + employeeId.replace(/^0+/, "").padStart(3, "0");

      const where = { employeeId: employeeIdToUse, date };
      const defaults = { checkInTime: checkIn ? checkIn.toTimeString().split(" ")[0] : null, checkOutTime: checkOut ? checkOut.toTimeString().split(" ")[0] : null, status: checkIn ? "present" : "absent" };

      try {
        const [row, created] = await Attendance.findOrCreate({ where, defaults });
        if (created) summary.attendanceCreated++;
        else {
          const updates = {};
          const existingIn = row.checkInTime ? row.checkInTime : null;
          const existingOut = row.checkOutTime ? row.checkOutTime : null;
          const newIn = defaults.checkInTime;
          const newOut = defaults.checkOutTime;
          if (newIn && existingIn !== newIn) updates.checkInTime = newIn;
          if (newOut && existingOut !== newOut) updates.checkOutTime = newOut;
          if (Object.keys(updates).length > 0) {
            summary.attendanceUpdated++;
            if (!dryRun) await row.update(updates);
          }
        }
      } catch (err) {
        summary.errors.push({ type: "attendance_upsert", key, error: err.message });
      }
    }

    return summary;
  } catch (err) {
    summary.errors.push({ type: "general", error: err && err.message ? err.message : String(err) });
    return summary;
  }
}

module.exports = { importFromWorkbook };