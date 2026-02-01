const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const fingerprint = require("./fingerprintService");
const config = require("../config/config");

// Default Mongo URI (configurable via MONGO_URI env)
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hr_attendance";
const MONGO_DBNAME = process.env.MONGO_DBNAME || null; // optional

async function syncFingerprintUsersToMongo({ dryRun = false, defaultPassword = "123456" } = {}) {
  const summary = {
    totalRead: 0,
    validUsers: 0,
    inserted: 0,
    skipped: 0,
    ignored: 0,
    errors: []
  };

  let client;
  try {
    // Initialize fingerprint service (may throw meaningful errors we should catch)
    await fingerprint.init();

    // Read users from Access DB
    const rows = await fingerprint.getAllUsers(5000);
    summary.totalRead = Array.isArray(rows) ? rows.length : 0;

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = MONGO_DBNAME ? client.db(MONGO_DBNAME) : client.db();
    const col = db.collection("users");

    // Ensure unique index on employeeId
    try {
      await col.createIndex({ employeeId: 1 }, { unique: true, background: true });
    } catch (idxErr) {
      // Log but do not fail; if another index exists or creation fails due to duplicates, we'll handle inserts gracefully
      console.warn("[Fingerprint->Mongo] Warning: could not create unique index on users.employeeId:", idxErr.message || idxErr);
    }

    // Precompute hashed default password
    const pwdHash = await bcrypt.hash(defaultPassword, 10);

    // Process rows with filters
    for (const r of rows) {
      try {
        const rawPin = r.pin || r.PIN || r.EmployeeId || r.userId || r.userId || null;
        const pinStr = rawPin !== null && rawPin !== undefined ? String(rawPin).trim() : null;
        const nameRaw = r.name || r.NAME || r.FullName || r.USERNAME || r.userName || null;
        const name = nameRaw !== null && nameRaw !== undefined ? String(nameRaw).trim() : null;

        // Filter invalid names
        if (!name || name.length === 0 || /^\s*$/.test(name) || /^empty$/i.test(name)) {
          summary.ignored++;
          continue;
        }

        if (!pinStr) {
          summary.ignored++;
          continue;
        }

        // Convert employeeId to string and canonicalize exactly as specified
        const employeeId = String(pinStr);

        summary.validUsers++;

        // Check if exists
        const existing = await col.findOne({ employeeId });
        if (existing) {
          summary.skipped++;
          continue; // Do nothing
        }

        const doc = {
          employeeId,
          fullName: name,
          passwordHash: pwdHash,
          mustChangePassword: true,
          role: "employee",
          source: "fingerprint",
          active: true,
          createdAt: new Date()
        };

        if (!dryRun) {
          try {
            await col.insertOne(doc);
            summary.inserted++;
          } catch (insErr) {
            // If insert fails due to duplicate key (race, concurrent), treat as skipped
            if (insErr && insErr.code === 11000) {
              summary.skipped++;
            } else {
              summary.errors.push({ employeeId, error: insErr.message || String(insErr) });
            }
          }
        }
      } catch (rowErr) {
        summary.errors.push({ row: r, error: rowErr.message || String(rowErr) });
      }
    }

    return summary;
  } catch (err) {
    // Map known fingerprint service errors to clearer messages
    if (err && err.code === "FINGERPRINT_DB_NOT_FOUND") {
      const e = new Error("Fingerprint DB file not found at configured path. Please set FINGERPRINT_DB_PATH correctly.");
      e.code = err.code;
      throw e;
    }
    if (err && err.code === "FINGERPRINT_DB_PROVIDER_MISSING") {
      const e = new Error("Fingerprint DB provider runtime missing on host (ACE). Install the Microsoft Access Database Engine matching your platform.");
      e.code = err.code;
      throw e;
    }

    // Generic
    const e = new Error("Failed to sync fingerprint users to MongoDB: " + (err && err.message ? err.message : String(err)));
    e.original = err;
    throw e;
  } finally {
    if (client) await client.close();
  }
}

module.exports = { syncFingerprintUsersToMongo };
