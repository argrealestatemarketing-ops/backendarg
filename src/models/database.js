// Mock database - Users
const users = [
  {
    id: 1,
    employeeId: "EMP001",
    name: "John Employee",
    email: "john@company.com",
    role: "employee",
    password: "$2a$10$rnvWkJ.a7Jf.4YE4zH7.DO0tVVGFq6KqjgVIlNJ8dWWV5vLEKHU/u", // password: 123456
    mustChangePassword: false
  },
  {
    id: 2,
    employeeId: "EMP002",
    name: "Jane Employee",
    email: "jane@company.com",
    role: "employee",
    password: "$2a$10$rnvWkJ.a7Jf.4YE4zH7.DO0tVVGFq6KqjgVIlNJ8dWWV5vLEKHU/u", // password: 123456
    mustChangePassword: false
  },
  {
    id: 3,
    employeeId: "HR001",
    name: "Alex HR",
    email: "alex@company.com",
    role: "hr",
    password: "$2a$10$rnvWkJ.a7Jf.4YE4zH7.DO0tVVGFq6KqjgVIlNJ8dWWV5vLEKHU/u", // password: 123456
    mustChangePassword: false
  }
];

// Mock database - Leave Requests
const leaveRequests = [
  {
    id: 1,
    employeeId: "EMP001",
    employeeName: "John Employee",
    fromDate: "2026-02-01",
    toDate: "2026-02-03",
    reason: "Personal leave",
    status: "pending",
    createdAt: new Date("2026-01-20")
  },
  {
    id: 2,
    employeeId: "EMP002",
    employeeName: "Jane Employee",
    fromDate: "2026-01-25",
    toDate: "2026-01-26",
    reason: "Sick leave",
    status: "approved",
    createdAt: new Date("2026-01-22")
  }
];

// Mock database - Announcements
const announcements = [
  {
    id: 1,
    title: "Company Holiday",
    message: "Jan 26 is a company holiday. Office will be closed.",
    createdBy: "HR001",
    createdAt: new Date("2026-01-20"),
    sentToAll: true
  }
];

// Mock database - Attendance
const attendance = [
  {
    id: 1,
    employeeId: "EMP001",
    date: "2026-01-24",
    checkInTime: "09:30:00",
    checkOutTime: "18:00:00",
    status: "present"
  },
  {
    id: 2,
    employeeId: "EMP001",
    date: "2026-01-23",
    checkInTime: "09:45:00",
    checkOutTime: "17:45:00",
    status: "present"
  },
  {
    id: 3,
    employeeId: "EMP002",
    date: "2026-01-24",
    checkInTime: null,
    checkOutTime: null,
    status: "absent"
  }
];

// Mock database - Leave Balances
const leaveBalances = [
  {
    employeeId: "EMP001",
    year: 2026,
    totalDays: 20,
    usedDays: 3,
    remainingDays: 17
  },
  {
    employeeId: "EMP002",
    year: 2026,
    totalDays: 20,
    usedDays: 2,
    remainingDays: 18
  }
];

module.exports = {
  users,
  leaveRequests,
  announcements,
  attendance,
  leaveBalances
};
