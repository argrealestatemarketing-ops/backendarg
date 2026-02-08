const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const TEST_JWT_SECRET =
  "5f6bf4a5a9f27f36a8b7ca6f9ef87f1ab6784eea1f8fc1e15fd2cc138ab8af66475675c43a7141f9e6a3b61fa56cc8af";

let app;
let sequelize;
let User;
let Attendance;
let LeaveBalance;
let LeaveRequest;
let Announcement;
let LoginAttempt;
let BlacklistedToken;
let dbAvailable = true;

function ensureDbOrSkip() {
  return !dbAvailable;
}

let employeeUser;

function createAccessToken(user) {
  return jwt.sign(
    {
      id: String(user.id),
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      email: user.email,
      mustChangePassword: !!user.mustChangePassword,
      tokenVersion: user.tokenVersion || 0,
      type: "access"
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
      algorithm: "HS256"
    }
  );
}

async function seedData() {
  const passwordHash = await bcrypt.hash("Passw0rd!", 10);

  employeeUser = await User.create({
    employeeId: "EMP001",
    name: "Employee One",
    email: "emp001@example.test",
    role: "employee",
    password: passwordHash,
    mustChangePassword: false,
    tokenVersion: 0,
    status: "active"
  });

  await User.create({
    employeeId: "HR001",
    name: "HR One",
    email: "hr001@example.test",
    role: "hr",
    password: passwordHash,
    mustChangePassword: false,
    tokenVersion: 0,
    status: "active"
  });

  await Attendance.bulkCreate([
    {
      employeeId: "EMP001",
      date: new Date(new Date().setUTCHours(0, 0, 0, 0)),
      checkInTime: "08:55:00",
      checkOutTime: null,
      status: "present"
    }
  ]);

  const currentYear = new Date().getUTCFullYear();
  await LeaveBalance.create({
    employeeId: "EMP001",
    year: currentYear,
    annualLeave: 15,
    sickLeave: 2,
    personalLeave: 1,
    maternityLeave: 0,
    paternityLeave: 0,
    otherLeave: 0,
    totalDays: 18,
    usedDays: 2,
    remainingDays: 16
  });

  await LeaveRequest.bulkCreate([
    {
      employeeId: "EMP001",
      employeeName: "Employee One",
      leaveType: "annual",
      startDate: new Date(Date.UTC(2026, 1, 20, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(2026, 1, 21, 0, 0, 0, 0)),
      reason: "Annual leave",
      status: "pending"
    }
  ]);

  await Announcement.create({
    title: "Policy Update",
    content: "Submit requests before 5 PM.",
    author: "HR001",
    priority: "normal",
    targetAudience: "all",
    startDate: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0)),
    isActive: true
  });
}

describe("API integration tests (PostgreSQL)", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.ALLOWED_ORIGINS = "http://localhost:3000";

    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL =
        process.env.DATABASE_URL_TEST ||
        "postgres://postgres:postgres@127.0.0.1:5432/hr_attendance_test";
    }

    const models = require("../../src/models");
    sequelize = models.sequelize;
    User = models.User;
    Attendance = models.Attendance;
    LeaveBalance = models.LeaveBalance;
    LeaveRequest = models.LeaveRequest;
    Announcement = models.Announcement;
    LoginAttempt = models.LoginAttempt;
    BlacklistedToken = models.BlacklistedToken;

    app = require("../../app");

    try {
      await sequelize.authenticate();
      await sequelize.sync({ force: true });
    } catch {
      dbAvailable = false;
      console.warn(
        "PostgreSQL test database is unavailable. Set DATABASE_URL_TEST to run full integration assertions.",
      );
    }
  });

  beforeEach(async () => {
    if (!dbAvailable) {
      return;
    }

    await Promise.all([
      LoginAttempt.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true }),
      BlacklistedToken.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true }),
      Attendance.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true }),
      LeaveBalance.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true }),
      LeaveRequest.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true }),
      Announcement.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true }),
      User.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true })
    ]);

    await seedData();
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  describe("Auth", () => {
    it("POST /api/auth/login returns expected success contract", async () => {
      if (ensureDbOrSkip()) return;

      const response = await request(app).post("/api/auth/login").send({
        employeeId: "EMP001",
        password: "Passw0rd!"
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.employeeId).toBe("EMP001");
      expect(typeof response.body.accessToken).toBe("string");
      expect(typeof response.body.refreshToken).toBe("string");
    });

    it("POST /api/auth/login rejects invalid password with stable shape", async () => {
      if (ensureDbOrSkip()) return;

      const response = await request(app).post("/api/auth/login").send({
        employeeId: "EMP001",
        password: "WrongPass1!"
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Password incorrect");
    });
  });

  describe("Attendance", () => {
    it("GET /api/attendance/today/:employeeId returns expected shape", async () => {
      if (ensureDbOrSkip()) return;

      const token = createAccessToken(employeeUser);

      const response = await request(app)
        .get("/api/attendance/today/EMP001")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.employeeId).toBe("EMP001");
    });
  });

  describe("Leave", () => {
    it("POST /api/leave/request creates leave request", async () => {
      if (ensureDbOrSkip()) return;

      const token = createAccessToken(employeeUser);

      const response = await request(app)
        .post("/api/leave/request")
        .set("Authorization", `Bearer ${token}`)
        .send({
          fromDate: "2030-01-10",
          toDate: "2030-01-11",
          reason: "Personal plan",
          leaveType: "annual"
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.employeeId).toBe("EMP001");
      expect(response.body.data.status).toBe("pending");
    });
  });
});
