"use strict";

const bcrypt = require("bcryptjs");

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const passwordHash = await bcrypt.hash("123456", 12);

    await queryInterface.bulkInsert("users", [
      {
        employee_id: "EMP001",
        name: "Employee One",
        email: "emp001@example.com",
        role: "employee",
        password: passwordHash,
        must_change_password: false,
        token_version: 0,
        failed_login_attempts: 0,
        status: "active",
        created_at: now,
        updated_at: now
      },
      {
        employee_id: "HR001",
        name: "HR One",
        email: "hr001@example.com",
        role: "hr",
        password: passwordHash,
        must_change_password: false,
        token_version: 0,
        failed_login_attempts: 0,
        status: "active",
        created_at: now,
        updated_at: now
      }
    ], {
      ignoreDuplicates: true
    });

    await queryInterface.bulkInsert("leave_balances", [
      {
        employee_id: "EMP001",
        year: currentYear,
        annual_leave: 20,
        sick_leave: 0,
        personal_leave: 0,
        maternity_leave: 0,
        paternity_leave: 0,
        other_leave: 0,
        total_days: 20,
        used_days: 0,
        remaining_days: 20,
        created_at: now,
        updated_at: now
      }
    ], {
      ignoreDuplicates: true
    });

    await queryInterface.bulkInsert("attendances", [
      {
        employee_id: "EMP001",
        date: todayUtc,
        check_in_time: "08:59:00",
        check_out_time: null,
        status: "present",
        hours_worked: 0,
        location: null,
        device_id: null,
        notes: "Seed attendance record",
        created_at: now,
        updated_at: now
      }
    ], {
      ignoreDuplicates: true
    });

    await queryInterface.bulkInsert("announcements", [
      {
        title: "Welcome",
        content: "Welcome to the HR Attendance system.",
        author: "HR001",
        priority: "normal",
        target_audience: "all",
        start_date: now,
        end_date: null,
        is_active: true,
        attachments: null,
        created_at: now,
        updated_at: now
      }
    ], {
      ignoreDuplicates: true
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("announcements", { title: "Welcome", author: "HR001" });
    await queryInterface.bulkDelete("attendances", { employee_id: "EMP001" });
    await queryInterface.bulkDelete("leave_balances", { employee_id: "EMP001" });
    await queryInterface.bulkDelete("users", { employee_id: "EMP001" });
    await queryInterface.bulkDelete("users", { employee_id: "HR001" });
  }
};
