const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const config = require("../config/config");

let enabled = false;
let employeeSet = new Set();
let idToNameMap = new Map();
let fileMtime = null;
let watcher = null;

const CANDIDATE_HEADERS = [
  "employeeid", "employee id", "employee", "empid", "emp id", "emp", "id", "eid", "badge", "badgeid", "badge id", "cardno", "card_no", "card no"
];

function normalizeId(val) {
  if (val === undefined || val === null) return null;
  return String(val).trim();
}

async function loadFromFile() {
  const filePath = config.EMPLOYEE_EXCEL_PATH;
  if (!filePath) {
    enabled = false;
    return;
  }

  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolved)) {
    enabled = true; // considered enabled but missing file is an error state
    throw Object.assign(new Error("Employee Excel file not found"), { code: "EMPLOYEE_EXCEL_MISSING", path: resolved });
  }

  const stat = fs.statSync(resolved);
  fileMtime = stat.mtimeMs;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolved);
  const worksheet = workbook.worksheets[0];

  // Convert worksheet to array-of-arrays similar to xlsx.utils.sheet_to_json(header=1)
  const rows = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const rowVals = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value === null || cell.value === undefined ? "" : (cell.text || String(cell.value));
      rowVals.push(val);
    });
    rows.push(rowVals);
  });

  if (!rows || rows.length === 0) {
    employeeSet = new Set();
    idToNameMap = new Map();
    enabled = true;
    return;
  }

  // Attempt to detect header row and employee id column
  const headerRow = rows[0].map(h => (h === undefined || h === null) ? "" : String(h).trim().toLowerCase());
  let idColIndex = -1;
  let nameColIndex = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const val = headerRow[i];
    if (!val) continue;
    for (const c of CANDIDATE_HEADERS) {
      if (val.includes(c)) {
        idColIndex = i;
        break;
      }
    }
    if (idColIndex !== -1) break;
  }

  // Heuristic for name column
  for (let i = 0; i < headerRow.length; i++) {
    const val = headerRow[i];
    if (!val) continue;
    if (val.includes("name") || val.includes("fullname") || val.includes("first name") || val.includes("last name")) {
      nameColIndex = i;
      break;
    }
  }

  // If we didn't find an id header, assume first column is id
  if (idColIndex === -1) idColIndex = 0;

  const ids = new Set();
  const map = new Map();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawId = row[idColIndex];
    const id = normalizeId(rawId);
    if (id && id.length > 0) {
      ids.add(id);
      const nameVal = nameColIndex !== -1 ? normalizeId(row[nameColIndex]) : null;
      if (nameVal) map.set(id, nameVal);
    }
  }

  employeeSet = ids;
  idToNameMap = map;
  enabled = true;
}

async function init() {
  if (!config.EMPLOYEE_EXCEL_PATH) {
    enabled = false;
    return;
  }
  try {
    await loadFromFile();
    // Watch file for changes to reload automatically
    const resolved = path.isAbsolute(config.EMPLOYEE_EXCEL_PATH) ? config.EMPLOYEE_EXCEL_PATH : path.resolve(process.cwd(), config.EMPLOYEE_EXCEL_PATH);
    if (!watcher) {
      watcher = fs.watch(resolved, () => {
        try {
          // Debounce rapid events by reloading after short timeout
          setTimeout(async () => {
            try {
              await loadFromFile();
              console.log("[ExcelService] Reloaded employees from Excel file");
            } catch (error) {
              console.error("[ExcelService] Reload error:", error && error.message ? error.message : error);
            }
          }, 300);
        } catch (error) {
          console.error("[ExcelService] File watch handler error:", error);
        }
      });
    }
  } catch (err) {
    // If file missing or unreadable, keep enabled true but throw to caller so they can decide how to handle
    throw err;
  }
}

function isEnabled() {
  return enabled;
}

function employeeExists(employeeId) {
  if (!enabled) {
    return false;
  }
  // reload if file changed
  const filePath = config.EMPLOYEE_EXCEL_PATH;
  if (!filePath) throw Object.assign(new Error("Employee Excel file not configured"), { code: "EMPLOYEE_EXCEL_MISSING" });
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw Object.assign(new Error("Employee Excel file not found"), { code: "EMPLOYEE_EXCEL_MISSING", path: resolved });
  }
  try {
    const stat = fs.statSync(resolved);
    if (fileMtime !== stat.mtimeMs) {
      // Reload
      loadFromFile();
    }
  } catch (e) {
    console.error("[ExcelService] Error checking file mtime:", e && e.message ? e.message : e);
  }

  const id = normalizeId(employeeId);
  if (!id) return false;
  return employeeSet.has(id);
}

function getEmployeeName(employeeId) {
  return idToNameMap.get(normalizeId(employeeId)) || null;
}

module.exports = {
  init,
  isEnabled,
  employeeExists,
  getEmployeeName
};
