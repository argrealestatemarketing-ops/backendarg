# HR Attendance Backend

Express API backend for attendance, leave, announcements, and auth.

## Runtime Stack
- Node.js + Express
- Sequelize ORM
- PostgreSQL (primary datastore)

## Key Commands
```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## Environment Variables
Required:
- `JWT_SECRET`
- PostgreSQL connection via either:
  - `DATABASE_URL`
  - or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

Optional:
- `DATABASE_URL_TEST` for integration tests
- `PGSSLMODE=require` for managed DB SSL

## Migrations and Seeds
```bash
npm run db:migrate
npm run db:seed
```

Reset local DB:
```bash
npm run db:reset
```

## Test Credentials (seed)
- Employee: `EMP001 / 123456`
- HR: `HR001 / 123456`

## Test & Lint
```bash
npm run lint
npm test -- --runInBand
```

Note: integration tests are PostgreSQL-backed. If test DB is unavailable, tests skip runtime assertions with a warning.
Set `DATABASE_URL_TEST` to run full DB assertions.

## API Routes
- `POST /api/auth/login`
- `GET /api/auth/verify`
- `POST /api/auth/change-password`
- `GET /api/attendance/today/:employeeId`
- `GET /api/attendance/monthly/:employeeId?year=YYYY&month=MM`
- `GET /api/attendance/detail/:employeeId/:date`
- `GET /api/attendance/not-checked-in` (HR/Admin)
- `GET /api/leave/balance`
- `GET /api/leave/requests?status=...`
- `POST /api/leave/request`
- `GET /api/leave/all?status=...` (HR/Admin)
- `POST /api/leave/approve/:requestId` (HR/Admin)
- `POST /api/leave/reject/:requestId` (HR/Admin)
- `GET /api/leave/pending/count` (HR/Admin)
- `POST /api/announcements` (HR/Admin)
- `GET /api/announcements`
- `GET /api/announcements/:announcementId`

## Fingerprint Integration
Fingerprint data integration is intentionally parked/disabled in runtime.
# arg-1
# backendarg
