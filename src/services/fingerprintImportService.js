const { sequelize, User, Attendance } = require("../models");
const fingerprint = require("./fingerprintService");

// importFingerprint(options)
// options: { startDate: Date|string, endDate: Date|string, dryRun: boolean }
// returns summary object
async function importFingerprint({ startDate, endDate, dryRun = false } = {}) {
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
    await fingerprint.init();

    const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : new Date();

    // Fetch users from fingerprint DB
    const users = await fingerprint.getAllUsers();
    summary.usersFound = users.length;

    // Upsert users
    await sequelize.authenticate();

    for (const u of users) {
        const rawPin = u.pin;
      const employeeIdCandidate = String(rawPin).trim();
      const name = u.name || u.userId || `User ${employeeIdCandidate}`;

      // Normalize pin variants to try when matching or upserting
      const pinCandidates = new Set();
      pinCandidates.add(employeeIdCandidate);
      // If pin is numeric-like, add zero-padded and EMP-prefixed variants
      if (/^\d+$/.test(employeeIdCandidate)) {
        const num = employeeIdCandidate.replace(/^0+/, "");
        const padded3 = employeeIdCandidate.padStart(3, "0");
        const padded4 = employeeIdCandidate.padStart(4, "0");
        pinCandidates.add(num);
        pinCandidates.add(padded3);
        pinCandidates.add(padded4);
        pinCandidates.add("EMP" + num.padStart(3, "0"));
        pinCandidates.add("EMP" + padded3);
      } else {
        // Also try trimming leading zeros if present
        pinCandidates.add(employeeIdCandidate.replace(/^0+/, ""));
      }

      // Try find existing by any candidate
      let existing = null;
      for (const p of pinCandidates) {
        if (!p) continue;
        existing = await User.findOne({ where: { employeeId: p } });
        if (existing) break;
      }

      if (existing) {
        const updates = {};
        if (!existing.name || existing.name.trim().length === 0) updates.name = name;
        if (Object.keys(updates).length > 0) {
          summary.usersUpdated++;
          if (!dryRun) try { await existing.update(updates); } catch (err) { summary.errors.push({ type: "user_update", employeeId: existing.employeeId, error: err.message }); }
        }
        continue;
      }

      // Create new user using canonical pin (prefer EMP### if pin numeric)
      let newEmployeeId = employeeIdCandidate;
      if (/^\d+$/.test(employeeIdCandidate)) newEmployeeId = "EMP" + employeeIdCandidate.replace(/^0+/, "").padStart(3, "0");

      summary.usersCreated++;
      if (!dryRun) {
        try {
          await User.create({
            employeeId: newEmployeeId,
            name,
            email: null,
            role: "employee",
            password: null,
            mustChangePassword: true,
            tokenVersion: 0
          });
        } catch (err) {
          summary.errors.push({ type: "user_create", employeeId: newEmployeeId, error: err.message });
        }
      } else {
        summary.warnings.push({ type: "dry_run_user", employeeId: newEmployeeId, name });
      }
    }

    // Fetch attendance rows in range
    const attendanceRows = await fingerprint.getAttendanceInRange(start, end);
    summary.attendanceRowsFound = attendanceRows.length;

    // Group by employee & date
    const byEmpDate = new Map();
    for (const r of attendanceRows) {
      const d = r.checkTime;
      const dateKey = d.toISOString().split("T")[0];
      const key = `${r.employeeId}::${dateKey}`;
      if (!byEmpDate.has(key)) byEmpDate.set(key, []);
      byEmpDate.get(key).push(r.checkTime);
    }

    for (const [key, times] of byEmpDate.entries()) {
      const [employeeId, date] = key.split("::");
      times.sort((a,b) => a - b);
      const checkIn = times[0];
      const checkOut = times.length > 1 ? times[times.length - 1] : null;

        // Try to find an existing user matching this employeeId using several variants
      const attemptPins = new Set();
      attemptPins.add(employeeId);
      attemptPins.add(employeeId.replace(/^0+/, ""));
      if (/^\d+$/.test(employeeId)) {
        attemptPins.add("EMP" + employeeId.replace(/^0+/, "").padStart(3, "0"));
        attemptPins.add(employeeId.padStart(3, "0"));
      }

      let employeeIdToUse = employeeId;
      for (const p of attemptPins) {
        const exists = await User.findOne({ where: { employeeId: p } });
        if (exists) { employeeIdToUse = p; break; }
      }

      // upsert attendance
      const where = { employeeId: employeeIdToUse, date };
      const defaults = {
        checkInTime: checkIn ? checkIn.toTimeString().split(" ")[0] : null,
        checkOutTime: checkOut ? checkOut.toTimeString().split(" ")[0] : null,
        status: checkIn ? "present" : "absent"
      };

      try {
        const [row, created] = await Attendance.findOrCreate({ where, defaults });
        if (created) {
          summary.attendanceCreated++;
        } else {
          // Update if times differ
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
    summary.errors.push({ type: "general", error: err.message });
    return summary;
  }
}

module.exports = { importFingerprint };