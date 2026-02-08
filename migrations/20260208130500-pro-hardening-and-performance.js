"use strict";

function normalizeTableName(table) {
  if (typeof table === "string") return table;
  if (table && typeof table === "object") {
    return table.tableName || table.name || table.toString();
  }
  return String(table);
}

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.map(normalizeTableName).includes(tableName);
}

async function constraintExists(queryInterface, tableName, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = con.connamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = :tableName
        AND con.conname = :constraintName
      LIMIT 1;
    `,
    {
      replacements: { tableName, constraintName }
    }
  );

  return rows.length > 0;
}

async function safeAddCheckConstraint(queryInterface, tableName, constraintName, definitionSql) {
  if (!(await tableExists(queryInterface, tableName))) return;
  if (await constraintExists(queryInterface, tableName, constraintName)) return;

  await queryInterface.sequelize.query(`
    ALTER TABLE "${tableName}"
    ADD CONSTRAINT "${constraintName}"
    CHECK (${definitionSql});
  `);
}

async function safeRemoveConstraint(queryInterface, tableName, constraintName) {
  if (!(await tableExists(queryInterface, tableName))) return;
  if (!(await constraintExists(queryInterface, tableName, constraintName))) return;
  await queryInterface.removeConstraint(tableName, constraintName);
}

async function safeCreateIndex(queryInterface, indexSql) {
  await queryInterface.sequelize.query(indexSql);
}

async function safeDropIndex(queryInterface, indexName) {
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${indexName}";`);
}

module.exports = {
  async up(queryInterface) {
    if (await tableExists(queryInterface, "users")) {
      await queryInterface.sequelize.query(`
        UPDATE users
        SET role = 'employee'
        WHERE role IS NULL
           OR role NOT IN ('employee', 'hr', 'admin', 'manager');
      `);
    }

    if (await tableExists(queryInterface, "leave_requests")) {
      await queryInterface.sequelize.query(`
        UPDATE leave_requests
        SET end_date = start_date
        WHERE end_date < start_date;
      `);
    }

    if (await tableExists(queryInterface, "leave_balances")) {
      await queryInterface.sequelize.query(`
        UPDATE leave_balances
        SET
          annual_leave = GREATEST(annual_leave, 0),
          sick_leave = GREATEST(sick_leave, 0),
          personal_leave = GREATEST(personal_leave, 0),
          maternity_leave = GREATEST(maternity_leave, 0),
          paternity_leave = GREATEST(paternity_leave, 0),
          other_leave = GREATEST(other_leave, 0),
          total_days = GREATEST(total_days, 0),
          used_days = GREATEST(used_days, 0),
          remaining_days = GREATEST(total_days, 0) - GREATEST(used_days, 0);
      `);
    }

    if (await tableExists(queryInterface, "attendances")) {
      await queryInterface.sequelize.query(`
        DELETE FROM attendances a
        USING (
          SELECT id
          FROM (
            SELECT
              id,
              ROW_NUMBER() OVER (
                PARTITION BY employee_id, date
                ORDER BY updated_at DESC NULLS LAST, id DESC
              ) AS row_num
            FROM attendances
          ) ranked
          WHERE ranked.row_num > 1
        ) duplicates
        WHERE a.id = duplicates.id;
      `);
    }

    await safeAddCheckConstraint(
      queryInterface,
      "users",
      "chk_users_role_allowed",
      `role IN ('employee', 'hr', 'admin', 'manager')`
    );

    await safeAddCheckConstraint(
      queryInterface,
      "attendances",
      "chk_attendances_hours_non_negative",
      "hours_worked >= 0"
    );

    await safeAddCheckConstraint(
      queryInterface,
      "attendances",
      "chk_attendances_time_order",
      "check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time"
    );

    await safeAddCheckConstraint(
      queryInterface,
      "leave_requests",
      "chk_leave_requests_date_order",
      "end_date >= start_date"
    );

    await safeAddCheckConstraint(
      queryInterface,
      "leave_balances",
      "chk_leave_balances_non_negative",
      `
        annual_leave >= 0
        AND sick_leave >= 0
        AND personal_leave >= 0
        AND maternity_leave >= 0
        AND paternity_leave >= 0
        AND other_leave >= 0
        AND total_days >= 0
        AND used_days >= 0
        AND remaining_days >= 0
      `
    );

    await safeAddCheckConstraint(
      queryInterface,
      "leave_balances",
      "chk_leave_balances_totals_consistent",
      "remaining_days = total_days - used_days"
    );

    await safeCreateIndex(
      queryInterface,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS attendances_employee_date_unique_idx
        ON attendances (employee_id, date);
      `
    );

    await safeCreateIndex(
      queryInterface,
      `
        CREATE INDEX IF NOT EXISTS leave_requests_pending_created_idx
        ON leave_requests (created_at DESC)
        WHERE status = 'pending';
      `
    );

    await safeCreateIndex(
      queryInterface,
      `
        CREATE INDEX IF NOT EXISTS import_jobs_type_status_started_idx
        ON import_jobs (type, status, started_at);
      `
    );

    await safeCreateIndex(
      queryInterface,
      `
        CREATE INDEX IF NOT EXISTS audit_logs_target_created_idx
        ON audit_logs (target_employee_id, created_at);
      `
    );

    await safeCreateIndex(
      queryInterface,
      `
        CREATE INDEX IF NOT EXISTS users_role_status_idx
        ON users (role, status);
      `
    );
  },

  async down(queryInterface) {
    await safeDropIndex(queryInterface, "users_role_status_idx");
    await safeDropIndex(queryInterface, "audit_logs_target_created_idx");
    await safeDropIndex(queryInterface, "import_jobs_type_status_started_idx");
    await safeDropIndex(queryInterface, "leave_requests_pending_created_idx");
    await safeDropIndex(queryInterface, "attendances_employee_date_unique_idx");

    await safeRemoveConstraint(queryInterface, "leave_balances", "chk_leave_balances_totals_consistent");
    await safeRemoveConstraint(queryInterface, "leave_balances", "chk_leave_balances_non_negative");
    await safeRemoveConstraint(queryInterface, "leave_requests", "chk_leave_requests_date_order");
    await safeRemoveConstraint(queryInterface, "attendances", "chk_attendances_time_order");
    await safeRemoveConstraint(queryInterface, "attendances", "chk_attendances_hours_non_negative");
    await safeRemoveConstraint(queryInterface, "users", "chk_users_role_allowed");
  }
};
