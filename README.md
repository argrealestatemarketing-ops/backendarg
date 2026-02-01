# HR & Attendance Management Backend

## Project Structure

```
backend/
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── attendanceController.js
│   │   ├── leaveController.js
│   │   └── announcementController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── leaveRoutes.js
│   │   └── announcementRoutes.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── roleMiddleware.js
│   ├── models/
│   │   └── database.js
│   └── config/
│       └── config.js
├── app.js
├── server.js
├── package.json
└── .env.example
```

## Installation

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create .env file from .env.example:
```bash
cp .env.example .env
```

4. Update .env with your configuration:
```
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secret_key_here
FIREBASE_API_KEY=your_firebase_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
# Set the fingerprint Access DB (read-only) path when using biometric integration
# Example: FINGERPRINT_DB_PATH=./fingerprint_db/zk_attendance.mdb
FINGERPRINT_DB_PATH=./fingerprint_db/zk_attendance.mdb

### Fingerprint (ZKTeco) Access DB integration
- Set `FINGERPRINT_DB_PATH` to the Access file location. The server will attempt to read it in READ-ONLY mode.
- The system does not modify the DB file; the service only performs SELECT queries.
- Queries are optimized and cached: the service discovers the likely user table/columns on first successful lookup and caches them for faster subsequent queries.
- A short timeout is enforced on fingerprint DB queries (2s per query, 2.5s overall for existence checks) to avoid blocking login requests. Slow queries will fail fast and return `503` with a clear message.
- If the DB file is missing or inaccessible the login flow will return a 503 (Fingerprint database unavailable).
- Ensure the Microsoft Access Database Engine (ACE/Jet) drivers are installed on the Windows host. If you see errors like "Provider cannot be found", install the matching bitness of the Access Database Engine (eg. "Microsoft Access Database Engine 2016 Redistributable" x64 for 64-bit Node). See https://learn.microsoft.com/office/troubleshoot/access/install-the-64-bit-access-database-engine for details.

### Fingerprint Import CLI & Dev API 🔧
- CLI: `node scripts/import_fingerprint.js [startDate] [endDate] [--dry-run]`
  - `startDate` / `endDate` optional (format `YYYY-MM-DD`). Defaults to last 30 days.
  - `--dry-run` will only simulate the import and return a summary without writing to the DB.
  - Example: `node scripts/import_fingerprint.js 2026-01-01 2026-01-31 --dry-run`
  - Shortcut npm script: `npm run import:fingerprint -- 2026-01-01 2026-01-31 --dry-run`
- Dev-only HTTP endpoint (only enabled when `NODE_ENV=development`):
  - `POST /api/debug/import/fingerprint`
  - Body: `{ "startDate": "2026-01-01", "endDate": "2026-01-31", "dryRun": true }`
  - Response: `{ success: true, summary: { ... } }` where `summary` contains counts (usersFound, usersCreated, attendanceRowsFound, attendanceCreated, etc.) and `errors`.

- Admin HTTP endpoint (protected, HR role required):
  - `POST /api/admin/import/fingerprint` (requires Bearer token of HR user)
  - Body: `{ "startDate":"YYYY-MM-DD", "endDate":"YYYY-MM-DD", "dryRun": true }`
  - Response: `{ success: true, summary: { ... }, jobId: <id> }
  - Each admin-triggered import is recorded in `import_jobs` with status and summary.

- File-based import (upload or CLI) — fallback when Access driver (ACE) is not available:
  - CLI: `node scripts/import_from_xlsx.js <file.xlsx|file.xls|file.csv> [--dry-run]`
  - Fingerprint to Mongo sync (safe insert only): `node scripts/sync_fingerprint_to_mongo.js [--dry-run] [--db-path <path>] [--password <default_password>]`
    - Example: `node scripts/sync_fingerprint_to_mongo.js --dry-run --db-path "C:\\Users\\n\\Desktop\\HR\\fingerprint_db\\fingerprint.mdb"`
    - Requires `FINGERPRINT_DB_PATH` env or `--db-path`. If Access OLEDB provider (ACE) is not installed on host, the script will fail with a clear message.  
    - The script inserts new users into MongoDB `users` collection and will not update existing users.

  - Admin upload endpoint: `POST /api/admin/import/upload` (multipart form, field name `file`). Body may include `dryRun=true`.
  - The file importer accepts sheets named `Users` and `Attendance`, or a unified sheet with columns like `Pin, Name, Date, Time`.

### Scheduled imports
- You can enable automatic daily imports using cron:
  - `IMPORT_SCHEDULE_ENABLED=true` (default if not set)
  - `IMPORT_SCHEDULE_CRON` to override cron schedule (default: `0 2 * * *` = daily at 02:00)
  - Import run records are stored in the `import_jobs` table for audit and debugging.

> Notes:
> - The import routine will attempt to map numeric pins (e.g., `123`) to `EMP`-prefixed `employeeId` (e.g., `EMP123`) when matching existing users.
> - The importer marks newly created users with `mustChangePassword: true` so that they are forced to change their password on first login.

### Change password (first login)
- POST `/api/auth/change-password` (requires an Authorization header with `Bearer <token>`)
- Payload: `{ "newPassword": "yourNewPass" }` (min 6 characters)
- Behavior: verifies JWT, updates password hash, sets `mustChangePassword=false`, and returns a refreshed token.
- Response: `{ "success": true, "token": "<new-token>" }` on success. If the token is refreshed, clients should replace the stored token.
- The mobile app will enforce a forced-change flow when `mustChangePassword` is true in the login response or stored user data.

Note: If you are running with a persistent SQL database (MySQL/Postgres), add a migration to create the `must_change_password` boolean column on the `users` table (default: false) to persist this flag for existing users.

Migration helper script:
- A helper script `backend/scripts/migrate_add_password_fields.js` is included to add missing columns (`must_change_password`, `password_changed_at`, `token_version`, `failed_login_attempts`, `locked_until`) and to create an `audit_logs` table when using the SQLite fallback. Run it with:

```
node backend/scripts/migrate_add_password_fields.js
```

For production databases (MySQL/Postgres) you should implement proper SQL migrations (eg. using Sequelize CLI or your migration tooling) using the following changes:
- Add columns: `must_change_password BOOLEAN DEFAULT FALSE`, `password_changed_at DATETIME NULL`, `token_version INT DEFAULT 0`, `failed_login_attempts INT DEFAULT 0`, `locked_until DATETIME NULL`
- Create `audit_logs` table for security/audit tracing.

### Employee Excel file (optional)
- Set `EMPLOYEE_EXCEL_PATH` to the path of an Excel file (e.g., `.xls` or `.xlsx`) whose first sheet contains a list of valid employees. The first row is expected to be headers - the service will attempt to detect an Employee ID column (headers like `employeeId`, `employee id`, `badge`, `id`, etc.).
- When configured, the Excel file is treated as the primary source of truth for allowing login. If a matching employee is found in the Excel file but not present in the app database, the server will auto-create a local user with default password `123456` and role `employee`. The response will include `mustChangePassword: true` so the client can force a password change on first login.
- The service watches the file and reloads automatically on changes. If the file is missing or unreadable, the server will return `503` errors for related checks.
```

## Running the Server

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

Server runs on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with employee ID and password
- `GET /api/auth/verify` - Verify JWT token

### Attendance
- `GET /api/attendance/today/:employeeId` - Get today's check-in status
- `GET /api/attendance/monthly/:employeeId?year=2026&month=1` - Get monthly attendance
- `GET /api/attendance/detail/:employeeId/:date` - Get attendance details for a specific date
- `GET /api/attendance/not-checked-in` - Get employees not checked in today (HR only)

### Leave Management
- `GET /api/leave/balance/:employeeId` - Get leave balance
- `GET /api/leave/requests/:employeeId` - Get employee's leave requests
- `POST /api/leave/request/:employeeId` - Request new leave
- `GET /api/leave/all` - Get all leave requests (HR only)
- `POST /api/leave/approve/:requestId` - Approve leave request (HR only)
- `POST /api/leave/reject/:requestId` - Reject leave request (HR only)
- `GET /api/leave/pending/count` - Get pending leave requests count (HR only)

### Announcements
- `POST /api/announcements` - Create announcement (HR only)
- `GET /api/announcements` - Get all announcements
- `GET /api/announcements/:announcementId` - Get announcement by ID

## Test Credentials

Employee:
- Employee ID: EMP001
- Password: 123456

HR:
- Employee ID: HR001
- Password: 123456

## Authentication

All endpoints (except login) require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Response Format

Success Response:
```json
{
  "success": true,
  "data": { ... }
}
```

Error Response:
```json
{
  "error": "Error message"
}
```

## Features Implemented

✅ JWT Authentication
✅ Role-based Access Control (Employee/HR)
✅ Attendance Management (Read-only from mock database)
✅ Leave Request Management
✅ Leave Approval/Rejection
✅ Announcements
✅ Error Handling
✅ Request Validation

## Next Steps

1. Replace mock database with real database (MySQL/PostgreSQL)
2. Integrate with ZK attendance system
3. Implement Firebase Cloud Messaging for notifications
4. Add push notification endpoints
5. Add cron jobs for automated late reminders
6. Deploy to production server
# backendarg
