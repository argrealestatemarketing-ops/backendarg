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

async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName).catch(() => null);
  return Boolean(table && Object.prototype.hasOwnProperty.call(table, columnName));
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

async function safeAddForeignKey(
  queryInterface,
  {
    tableName,
    columnName,
    constraintName,
    referencesTable,
    referencesField,
    onUpdate = "CASCADE",
    onDelete = "RESTRICT"
  }
) {
  const parentTableExists = await tableExists(queryInterface, tableName);
  const childTableExists = await tableExists(queryInterface, referencesTable);
  if (!parentTableExists || !childTableExists) return;

  const hasColumn = await columnExists(queryInterface, tableName, columnName);
  const hasReferenceColumn = await columnExists(queryInterface, referencesTable, referencesField);
  if (!hasColumn || !hasReferenceColumn) return;

  if (await constraintExists(queryInterface, tableName, constraintName)) return;

  await queryInterface.addConstraint(tableName, {
    fields: [columnName],
    type: "foreign key",
    name: constraintName,
    references: {
      table: referencesTable,
      field: referencesField
    },
    onUpdate,
    onDelete
  });
}

async function safeRemoveConstraint(queryInterface, tableName, constraintName) {
  if (!(await tableExists(queryInterface, tableName))) return;
  if (!(await constraintExists(queryInterface, tableName, constraintName))) return;
  await queryInterface.removeConstraint(tableName, constraintName);
}

module.exports = {
  async up(queryInterface) {
    await safeAddForeignKey(queryInterface, {
      tableName: "attendances",
      columnName: "employee_id",
      constraintName: "fk_attendances_employee_id_users_employee_id",
      referencesTable: "users",
      referencesField: "employee_id",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });

    await safeAddForeignKey(queryInterface, {
      tableName: "leave_balances",
      columnName: "employee_id",
      constraintName: "fk_leave_balances_employee_id_users_employee_id",
      referencesTable: "users",
      referencesField: "employee_id",
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    await safeAddForeignKey(queryInterface, {
      tableName: "leave_requests",
      columnName: "employee_id",
      constraintName: "fk_leave_requests_employee_id_users_employee_id",
      referencesTable: "users",
      referencesField: "employee_id",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });

    await safeAddForeignKey(queryInterface, {
      tableName: "leave_requests",
      columnName: "approved_by",
      constraintName: "fk_leave_requests_approved_by_users_employee_id",
      referencesTable: "users",
      referencesField: "employee_id",
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await safeAddForeignKey(queryInterface, {
      tableName: "announcements",
      columnName: "author",
      constraintName: "fk_announcements_author_users_employee_id",
      referencesTable: "users",
      referencesField: "employee_id",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });
  },

  async down(queryInterface) {
    await safeRemoveConstraint(
      queryInterface,
      "announcements",
      "fk_announcements_author_users_employee_id"
    );
    await safeRemoveConstraint(
      queryInterface,
      "leave_requests",
      "fk_leave_requests_approved_by_users_employee_id"
    );
    await safeRemoveConstraint(
      queryInterface,
      "leave_requests",
      "fk_leave_requests_employee_id_users_employee_id"
    );
    await safeRemoveConstraint(
      queryInterface,
      "leave_balances",
      "fk_leave_balances_employee_id_users_employee_id"
    );
    await safeRemoveConstraint(
      queryInterface,
      "attendances",
      "fk_attendances_employee_id_users_employee_id"
    );
  }
};

