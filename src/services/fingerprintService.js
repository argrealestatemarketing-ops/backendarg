/*
  FingerprintService (Read-Only)
  - Uses node-adodb to read Microsoft Access .mdb/.accdb files on Windows
  - Strictly READ ONLY: queries only; no DML, no schema changes
  - Respects FINGERPRINT_DB_PATH configured via env -> resolved in src/config/config.js

  Usage:
    const fingerprint = require('../services/fingerprintService');
    await fingerprint.init();
    const exists = await fingerprint.employeeExists('EMP001');
    const attendance = await fingerprint.getTodayAttendance('EMP001');

  Notes:
  - Ensure Microsoft Access Database Engine is installed on host (ACE/OLEDB).
  - Do NOT commit any DB files. In dev place the Access file at path pointed by FINGERPRINT_DB_PATH.
*/

const fs = require("fs");
const config = require("../config/config");

let adodbModule = null;
let adodbLoadError = null;

function getAdodb() {
  if (adodbModule) return adodbModule;
  if (adodbLoadError) throw adodbLoadError;

  try {
    adodbModule = require("node-adodb");
    return adodbModule;
  } catch (error) {
    const moduleError = new Error("Fingerprint Access DB support is unavailable on this host. This is expected on non-Windows deployments.");
    moduleError.code = "FINGERPRINT_DB_UNSUPPORTED_PLATFORM";
    moduleError.cause = error;
    adodbLoadError = moduleError;
    throw moduleError;
  }
}


const DEFAULT_OPTIONS = {
  // Candidate providers; we try ACE then JET
  providers: [
    // Try modern ACE provider first (some systems have 16.0), then fall back to 12.0 and JET.
    "Provider=Microsoft.ACE.OLEDB.16.0;Data Source={DB};Mode=Read;Persist Security Info=False;",
    "Provider=Microsoft.ACE.OLEDB.12.0;Data Source={DB};Mode=Read;Persist Security Info=False;",
    "Provider=Microsoft.Jet.OLEDB.4.0;Data Source={DB};Mode=Read;Persist Security Info=False;"
  ],
  // Candidate tables & columns for common ZKTeco schemas
  userTables: [
    { table: "USERINFO", cols: ["PIN", "USERID", "EnrollNumber", "PINCODE"] },
    { table: "USER", cols: ["PIN", "USERID", "EnrollNumber"] },
    { table: "USERS", cols: ["PIN", "USERID"] }
  ],
  attendanceTables: [
    { table: "CHECKINOUT", cols: ["PIN", "CHECKTIME", "CHECK_DATE", "CHECK_TIME"] },
    { table: "ATTLOG", cols: ["PIN", "CHECKTIME"] },
    { table: "INOUT", cols: ["PIN", "CHECKTIME"] },
    { table: "LOG", cols: ["PIN", "CHECKTIME"] }
  ]
};

let connection = null;
let initialized = false;
let initializedError = null;

function sanitizeEmployeeId(id) {
  if (typeof id !== "string") return null;
  const v = id.trim();
  if (!v) return null;
  // Allow alphanumeric, underscore, hyphen (common IDs). Reject suspicious values to prevent injection.
  if (!/^[\w-]+$/.test(v)) return null;
  return v;
}

async function init() {
  if (initialized) return;

  const dbPath = config.FINGERPRINT_DB_PATH;
  if (!dbPath) {
    initializedError = new Error("FINGERPRINT_DB_PATH not configured");
    initializedError.code = "FINGERPRINT_DB_MISSING";
    console.warn("[FingerprintService] FINGERPRINT_DB_PATH not set. Feature disabled.");
    initialized = true; // mark to avoid re-trying repeatedly
    return;
  }

  if (!fs.existsSync(dbPath)) {
    initializedError = new Error(`Fingerprint DB file not found at ${dbPath}`);
    initializedError.code = "FINGERPRINT_DB_NOT_FOUND";
    console.error("[FingerprintService] DB file not found:", dbPath);
    initialized = true;
    return;
  }

  let ADODB;
  try {
    ADODB = getAdodb();
  } catch (error) {
    initializedError = error;
    console.warn("[FingerprintService] node-adodb unavailable. Feature disabled on this host.");
    initialized = true;
    return;
  }

  // Try providers
  for (const providerTemplate of DEFAULT_OPTIONS.providers) {
    const connStr = providerTemplate.replace("{DB}", dbPath);
    try {
      // Create an ADODB connection (node-adodb uses open with conn string)
      connection = ADODB.open(connStr);
      // Quick test query - get schema version or top 1 from CHECKINOUT if table exists
      try {
        // We do a harmless limited query to validate connectivity
        await connection.query("SELECT TOP 1 1 FROM [CHECKINOUT]");
        initialized = true;
        console.info("[FingerprintService] Connected to Access DB using provider. Path:", dbPath);
        return;
      } catch {
        // Table may not exist. Consider this provider valid; keep it as active provider.
        initialized = true;
        console.info("[FingerprintService] Provider accepted (table test failed but provider seems usable).");
        return;
      }
    } catch (err) {
      // Detect provider-missing errors and provide a helpful message
      const msg = err && (err.message || (err.process && err.process.message)) ? (err.message || err.process.message) : String(err);
      if (/Provider cannot be found|provider cannot be found|Could not find|class not registered/i.test(msg)) {
        initializedError = new Error("Required OLEDB provider not found on this host. Install Microsoft Access Database Engine (ACE) matching your Node/Office bitness (eg. Microsoft Access Database Engine 2016 Redistributable x64).");
        initializedError.code = "FINGERPRINT_DB_PROVIDER_MISSING";
        console.error("[FingerprintService] Provider missing:", msg);
        initialized = true;
        return;
      }

      // Try next provider
      connection = null;
      continue;
    }
  }

  initializedError = new Error("Could not connect to fingerprint Access DB - no provider succeeded");
  initializedError.code = "FINGERPRINT_DB_CONN_FAILED";
  console.error("[FingerprintService] Initialization failed - provider connection failed");
  initialized = true;
}

function _ensureReadyOrThrow() {
  if (!initialized) throw new Error("FingerprintService not initialized");
  if (initializedError) {
    const e = initializedError;
    throw e;
  }
  if (!connection) {
    const e = new Error("No connection available");
    e.code = "FINGERPRINT_DB_CONN_FAILED";
    throw e;
  }
}

// Cache discovered table and columns to speed up lookups after first detection
let cachedUserTable = null;
let cachedUserCols = null;

// Execute a query with a timeout (avoids long blocking queries)
async function executeQueryWithTimeout(sql, timeoutMs = 2000) {
  const start = Date.now();
  if (!connection) {
    const e = new Error("No connection available");
    e.code = "FINGERPRINT_DB_CONN_FAILED";
    throw e;
  }

  const queryPromise = connection.query(sql);

  // Wrap query promise with manual timeout to avoid unbounded waits
  const wrapped = new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error("Fingerprint DB query timed out");
      err.code = "FINGERPRINT_DB_TIMEOUT";
      reject(err);
    }, timeoutMs);

    queryPromise.then((rows) => {
      clearTimeout(t);
      resolve(rows);
    }).catch((err) => {
      clearTimeout(t);
      reject(err);
    });
  });

  try {
    const rows = await wrapped;
    const duration = Date.now() - start;
    console.info(`[FingerprintService] Query success (${duration}ms): ${sql}`);
    return rows;
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err && (err.message || (err.process && err.process.message)) ? (err.message || err.process.message) : String(err);
    console.warn(`[FingerprintService] Query failed (${duration}ms): ${sql} -> ${msg}`);
    // Detect provider-related spawn errors and tag them for upstream handling
    if (/Spawn .*cscript.exe error|Provider cannot be found|provider cannot be found|class not registered/i.test(msg)) {
      const e = new Error("Fingerprint DB provider or runtime is missing on host. Install the Microsoft Access Database Engine (ACE) matching your platform.");
      e.code = "FINGERPRINT_DB_PROVIDER_MISSING";
      e.durationMs = duration;
      throw e;
    }

    err && (err.durationMs = duration);
    throw err;
  }
}

async function employeeExists(employeeId) {
  await init();
  try {
    _ensureReadyOrThrow();
  } catch (e) {
    throw e;
  }

  const id = sanitizeEmployeeId(employeeId);
  if (!id) return false;

  console.info(`[FingerprintService] employeeExists START for: ${id}`);
  const overallStart = Date.now();

  // Overall timeout for the whole existence check (e.g. 2500ms)
  const overallTimeoutMs = 2500;

  const detection = async () => {
    // If we discovered a good table/cols earlier, use that single OR query (fast)
    if (cachedUserTable && Array.isArray(cachedUserCols) && cachedUserCols.length > 0) {
      const where = cachedUserCols.map(c => `[${c}] = '${id.replace("'", "''")}'`).join(" OR ");
      const sql = `SELECT TOP 1 1 FROM [${cachedUserTable}] WHERE ${where}`;
      const rows = await executeQueryWithTimeout(sql, 2000);
      return Array.isArray(rows) && rows.length > 0;
    }

    // No cache - probe each candidate table once using an OR of likely columns
    for (const t of DEFAULT_OPTIONS.userTables) {
      const where = t.cols.map(c => `[${c}] = '${id.replace("'", "''")}'`).join(" OR ");
      const sql = `SELECT TOP 1 1 FROM [${t.table}] WHERE ${where}`;
      try {
        const rows = await executeQueryWithTimeout(sql, 2000);
        if (Array.isArray(rows) && rows.length > 0) {
          // Cache the table/cols to speed up subsequent requests
          cachedUserTable = t.table;
          cachedUserCols = t.cols;
          return true;
        }
      } catch (err) {
        // If timeout occurs - bubble up immediately for fast failure
        if (err && err.code === "FINGERPRINT_DB_TIMEOUT") throw err;
        // Otherwise continue to next candidate (table/column may not exist)
        continue;
      }
    }

    return false;
  };

  // Race the detection against an overall timeout
  try {
    const result = await Promise.race([
      detection(),
      new Promise((_, reject) => setTimeout(() => {
        const err = new Error("Fingerprint DB existence check timed out");
        err.code = "FINGERPRINT_DB_TIMEOUT";
        reject(err);
      }, overallTimeoutMs))
    ]);

    const overallDuration = Date.now() - overallStart;
    console.info(`[FingerprintService] employeeExists END for ${id} (duration ${overallDuration}ms)`);
    return result;
  } catch (err) {
    const overallDuration = Date.now() - overallStart;
    console.warn(`[FingerprintService] employeeExists ERROR for ${id} (duration ${overallDuration}ms): ${err && err.message}`);
    throw err;
  }
}

async function getTodayAttendance(employeeId) {
  await init();
  try { _ensureReadyOrThrow(); } catch (e) { throw e; }

  const id = sanitizeEmployeeId(employeeId);
  if (!id) return null;

  // Query recent records from candidate attendance tables
  const records = [];
  for (const t of DEFAULT_OPTIONS.attendanceTables) {
    // Try multiple possible time column names
    const cols = t.cols;
    for (const timeCol of cols.filter(c => /check|time/i.test(c))) {
      const sql = `SELECT [${t.cols[0]}] AS [PIN], [${timeCol}] AS [CHECKTIME] FROM [${t.table}] WHERE [${t.cols[0]}] = '${id.replace("'", "''")}' ORDER BY [${timeCol}] DESC`;
      try {
        const rows = await connection.query(sql);
        if (Array.isArray(rows) && rows.length > 0) {
          for (const r of rows) {
            if (r && r.CHECKTIME) {
              records.push({ employeeId: r.PIN?.toString(), checkTime: new Date(r.CHECKTIME) });
            }
          }
        }
      } catch {
        // ignore and continue
        continue;
      }
    }
  }

  if (records.length === 0) return null;

  // Filter for today's date (server local date)
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().split("T")[0];

  const todayRecords = records.filter(r => r.checkTime && r.checkTime.toISOString().split("T")[0] === targetDate)
    .sort((a,b) => a.checkTime - b.checkTime);

  if (todayRecords.length === 0) return null;

  const checkIn = todayRecords[0].checkTime;
  const checkOut = todayRecords.length > 1 ? todayRecords[todayRecords.length - 1].checkTime : null;

  const formatTime = (d) => {
    if (!d) return null;
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  };

  return {
    employeeId: id,
    date: targetDate,
    checkIn: formatTime(checkIn),
    checkOut: formatTime(checkOut)
  };
}

// Helper: try to list candidate tables dynamically (best-effort)
async function discoverTables() {
  const tables = new Set();
  try {
    // MSysObjects may be restricted, but try to list user tables
    const rows = await executeQueryWithTimeout("SELECT [Name] FROM MSysObjects WHERE [Type]=1 AND [Flags]=0", 2000);
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const n = r.Name || r.NAME || null;
        if (n && typeof n === "string" && !n.startsWith("~") && !n.toUpperCase().startsWith("MSYS")) tables.add(n);
      }
    }
  } catch (err) {
    if (err && err.code === "FINGERPRINT_DB_PROVIDER_MISSING") throw err;
    // ignore other errors - fallback to known candidates
  }

  // Add fallback candidates from DEFAULT_OPTIONS
  for (const t of DEFAULT_OPTIONS.userTables) tables.add(t.table);
  for (const t of DEFAULT_OPTIONS.attendanceTables) tables.add(t.table);

  return Array.from(tables);
}

// Try to parse Access date/time values (handles strings and OLE numeric serials)
function parseAccessDate(v) {
  if (!v && v !== 0) return null;
  if (typeof v === "number") {
    // OLE Automation date: days since 1899-12-30
    const days = v;
    const ms = (days - 25569) * 86400 * 1000; // convert to JS epoch (1970-01-01)
    return new Date(ms);
  }
  // Try string parsing first
  const s = String(v).trim();
  // Common formats: 'YYYY-MM-DD HH:mm:ss', 'MM/DD/YYYY HH:mm:ss', etc.
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) return new Date(parsed);

  // Last resort: try to replace common separators and parse
  const replaced = s.replace(/\//g, "-");
  const p2 = Date.parse(replaced);
  if (!isNaN(p2)) return new Date(p2);

  return null;
}

// Fetch a best-effort list of users from the fingerprint Access DB
async function getAllUsers(limit = 2000) {
  await init();
  try { _ensureReadyOrThrow(); } catch (e) { throw e; }

  const found = new Map();

  // If a cached table was detected earlier, prefer it
  const candidates = cachedUserTable ? [{ table: cachedUserTable, cols: cachedUserCols }] : DEFAULT_OPTIONS.userTables;

  // Try primary candidates first
  for (const t of candidates) {
    const selectCols = Array.from(new Set([t.cols[0], ...(t.cols.slice(1) || [])]));
    const colsSql = selectCols.map(c => `[${c}]`).join(", ");
    const sql = `SELECT TOP ${limit} ${colsSql} FROM [${t.table}]`;
    try {
      const rows = await executeQueryWithTimeout(sql, 5000);
      if (Array.isArray(rows) && rows.length > 0) {
        for (const r of rows) {
          if (!r) continue;
          const pin = r[t.cols[0]] ? String(r[t.cols[0]]).trim() : null;
          if (!pin) continue;
          if (!found.has(pin)) {
            // Attempt to find a name field
            const name = r.Name || r.NAME || r.UserName || r.USERNAME || r.FullName || r.FULLNAME || null;
            const userId = (r.USERID || r.EnrollNumber || r.PINCODE || null);
            found.set(pin, { pin, userId: userId ? String(userId) : null, name: name ? String(name) : null, raw: r });
            // Cache successful detection
            cachedUserTable = t.table;
            cachedUserCols = t.cols;
          }
        }
      }
    } catch (err) {
      if (err && err.code === "FINGERPRINT_DB_PROVIDER_MISSING") throw err;
      // ignore other table errors
      continue;
    }
  }

  // If nothing found, attempt broader discovery across tables
  if (found.size === 0) {
    const tables = await discoverTables();
    for (const table of tables) {
      const sql = `SELECT TOP ${Math.min(limit, 200)} * FROM [${table}]`;
      try {
        const rows = await executeQueryWithTimeout(sql, 3000);
        if (Array.isArray(rows) && rows.length > 0) {
          // Try to detect a candidate pin column from first row keys
          const keys = Object.keys(rows[0]).map(k => k.toString());
          const pinKey = keys.find(k => /^pin$/i.test(k) || /^enroll/i.test(k) || /^userid$/i.test(k) || /^pincode$/i.test(k));
          const nameKey = keys.find(k => /name|fullname|username/i.test(k));
          if (!pinKey) continue;
          for (const r of rows) {
            if (!r) continue;
            const pin = r[pinKey] ? String(r[pinKey]).trim() : null;
            if (!pin) continue;
            if (!found.has(pin)) {
              const name = nameKey ? (r[nameKey] ? String(r[nameKey]) : null) : null;
              const userId = r.UserID || r.EnrollNumber || null;
              found.set(pin, { pin, userId: userId ? String(userId) : null, name, raw: r });
              // Cache this discovery
              cachedUserTable = table;
              cachedUserCols = [pinKey, nameKey].filter(Boolean);
            }
          }
        }
      } catch (err) {
        if (err && err.code === "FINGERPRINT_DB_PROVIDER_MISSING") throw err;
        continue;
      }
    }
  }

  return Array.from(found.values());
}

// Fetch attendance records between startDate and endDate (inclusive). Dates are strings 'YYYY-MM-DD' or Date objects.
async function getAttendanceInRange(startDate, endDate) {
  await init();
  try { _ensureReadyOrThrow(); } catch (e) { throw e; }

  const normalize = d => (d instanceof Date ? d : new Date(d));
  const start = normalize(startDate);
  const end = normalize(endDate);

  // Build SQL-like date strings 'YYYY-MM-DD HH:mm:ss'
  const fmt = d => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  const startSql = fmt(start);
  const endSql = fmt(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59));

  const results = [];

  for (const t of DEFAULT_OPTIONS.attendanceTables) {
    const timeCols = t.cols.filter(c => /check|time/i.test(c));
    const pinCol = t.cols[0];
    // If there is a separate date & time columns, prefer combining them
    const hasDateCol = t.cols.find(c => /date/i.test(c));
    const hasTimeCol = t.cols.find(c => /time/i.test(c));

    // Try combined column if available
    if (timeCols.length > 0) {
      const timeCol = timeCols[0];
      const sql = `SELECT [${pinCol}] AS [PIN], [${timeCol}] AS [CHECKTIME] FROM [${t.table}] WHERE [${timeCol}] BETWEEN '${startSql}' AND '${endSql}' ORDER BY [${timeCol}] ASC`;
      try {
        const rows = await executeQueryWithTimeout(sql, 10000);
        if (Array.isArray(rows) && rows.length > 0) {
          for (const r of rows) {
            if (!r) continue;
            if (!r.PIN || !r.CHECKTIME) continue;
            const parsed = parseAccessDate(r.CHECKTIME);
            if (!parsed) continue; // skip unparsable
            results.push({ employeeId: String(r.PIN).trim(), checkTime: parsed, raw: r });
          }
        }
      } catch {
        // ignore table errors
      }
    }

    // If separate date/time columns exist, combine them
    if (hasDateCol && hasTimeCol) {
      const sql = `SELECT [${pinCol}] AS [PIN], [${hasDateCol}] AS [CHECKDATE], [${hasTimeCol}] AS [CHECKTIME] FROM [${t.table}] WHERE ([${hasDateCol}] BETWEEN '${startSql.split(" ")[0]}' AND '${endSql.split(" ")[0]}') ORDER BY [${hasDateCol}] ASC`;
      try {
        const rows = await executeQueryWithTimeout(sql, 10000);
        if (Array.isArray(rows) && rows.length > 0) {
          for (const r of rows) {
            if (!r) continue;
            if (!r.PIN || (!r.CHECKDATE && !r.CHECKTIME)) continue;
            // Combine into single value
            let dt = null;
            if (r.CHECKDATE && r.CHECKTIME) dt = parseAccessDate(`${r.CHECKDATE} ${r.CHECKTIME}`);
            else dt = parseAccessDate(r.CHECKDATE || r.CHECKTIME);
            if (!dt) continue;
            results.push({ employeeId: String(r.PIN).trim(), checkTime: dt, raw: r });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return results.sort((a,b) => a.checkTime - b.checkTime);
}

module.exports = {
  init,
  employeeExists,
  getTodayAttendance,
  getAllUsers,
  getAttendanceInRange
};
