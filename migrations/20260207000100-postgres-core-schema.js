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
  return !!(table && Object.prototype.hasOwnProperty.call(table, columnName));
}

async function safeAddColumn(queryInterface, tableName, columnName, definition) {
  if (!(await columnExists(queryInterface, tableName, columnName))) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function safeAddIndex(queryInterface, tableName, fields, options = {}) {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (error) {
    if (!String(error.message || "").toLowerCase().includes("already exists")) {
      throw error;
    }
  }
}

async function safeConvertColumnToJsonb(queryInterface, tableName, columnName) {
  if (!(await columnExists(queryInterface, tableName, columnName))) {
    return;
  }

  const table = await queryInterface.describeTable(tableName).catch(() => null);
  const column = table ? table[columnName] : null;
  const columnType = String((column && column.type) || "").toLowerCase();

  if (columnType.includes("jsonb")) {
    return;
  }

  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION __hr_try_parse_jsonb(input_text text)
    RETURNS jsonb
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      RETURN input_text::jsonb;
    EXCEPTION
      WHEN others THEN
        RETURN NULL;
    END;
    $func$;
  `);

  await queryInterface.sequelize.query(`
    ALTER TABLE "${tableName}"
    ALTER COLUMN "${columnName}" TYPE JSONB
    USING (
      CASE
        WHEN "${columnName}" IS NULL THEN NULL
        ELSE COALESCE(
          __hr_try_parse_jsonb("${columnName}"::text),
          jsonb_build_object('value', "${columnName}"::text)
        )
      END
    );
  `);

  await queryInterface.sequelize.query("DROP FUNCTION IF EXISTS __hr_try_parse_jsonb(text);");
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "users"))) {
      await queryInterface.createTable("users", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        employee_id: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        email: {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true
        },
        role: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "employee"
        },
        password: {
          type: Sequelize.STRING,
          allowNull: false
        },
        must_change_password: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        password_changed_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        token_version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        failed_login_attempts: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        locked_until: {
          type: Sequelize.DATE,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM("active", "inactive", "locked"),
          allowNull: false,
          defaultValue: "active"
        },
        last_login_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    } else {
      await safeAddColumn(queryInterface, "users", "must_change_password", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      await safeAddColumn(queryInterface, "users", "password_changed_at", {
        type: Sequelize.DATE,
        allowNull: true
      });
      await safeAddColumn(queryInterface, "users", "token_version", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
      await safeAddColumn(queryInterface, "users", "failed_login_attempts", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
      await safeAddColumn(queryInterface, "users", "locked_until", {
        type: Sequelize.DATE,
        allowNull: true
      });
      await safeAddColumn(queryInterface, "users", "status", {
        type: Sequelize.ENUM("active", "inactive", "locked"),
        allowNull: false,
        defaultValue: "active"
      });
      await safeAddColumn(queryInterface, "users", "last_login_at", {
        type: Sequelize.DATE,
        allowNull: true
      });
      await safeAddColumn(queryInterface, "users", "created_at", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      });
      await safeAddColumn(queryInterface, "users", "updated_at", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      });
    }

    await safeAddIndex(queryInterface, "users", ["employee_id"], {
      name: "users_employee_id_unique",
      unique: true
    });
    await safeAddIndex(queryInterface, "users", ["status"], {
      name: "users_status_idx"
    });
    await safeAddIndex(queryInterface, "users", ["locked_until"], {
      name: "users_locked_until_idx"
    });

    if (!(await tableExists(queryInterface, "attendances"))) {
      await queryInterface.createTable("attendances", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        employee_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        check_in_time: {
          type: Sequelize.TIME,
          allowNull: true
        },
        check_out_time: {
          type: Sequelize.TIME,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM("present", "absent", "late", "half_day"),
          allowNull: false,
          defaultValue: "present"
        },
        hours_worked: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0
        },
        location: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        device_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    }

    await safeAddIndex(queryInterface, "attendances", ["employee_id", "date"], {
      name: "attendances_employee_date_idx"
    });
    await safeAddIndex(queryInterface, "attendances", ["date", "status"], {
      name: "attendances_date_status_idx"
    });

    if (!(await tableExists(queryInterface, "leave_requests"))) {
      await queryInterface.createTable("leave_requests", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        employee_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        employee_name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        leave_type: {
          type: Sequelize.ENUM("annual", "sick", "personal", "maternity", "paternity", "other"),
          allowNull: false,
          defaultValue: "annual"
        },
        start_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        end_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM("pending", "approved", "rejected"),
          allowNull: false,
          defaultValue: "pending"
        },
        approved_by: {
          type: Sequelize.STRING,
          allowNull: true
        },
        approved_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        rejection_reason: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        attachments: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    }

    await safeAddIndex(queryInterface, "leave_requests", ["employee_id", "created_at"], {
      name: "leave_requests_employee_created_idx"
    });
    await safeAddIndex(queryInterface, "leave_requests", ["status", "created_at"], {
      name: "leave_requests_status_created_idx"
    });
    await safeAddIndex(queryInterface, "leave_requests", ["employee_id", "start_date", "end_date"], {
      name: "leave_requests_employee_date_range_idx"
    });

    if (!(await tableExists(queryInterface, "leave_balances"))) {
      await queryInterface.createTable("leave_balances", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        employee_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        year: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        annual_leave: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        sick_leave: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        personal_leave: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        maternity_leave: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        paternity_leave: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        other_leave: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        total_days: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        used_days: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        remaining_days: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    }

    await safeAddIndex(queryInterface, "leave_balances", ["employee_id", "year"], {
      name: "leave_balances_employee_year_unique",
      unique: true
    });

    if (!(await tableExists(queryInterface, "announcements"))) {
      await queryInterface.createTable("announcements", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false
        },
        content: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        author: {
          type: Sequelize.STRING,
          allowNull: false
        },
        priority: {
          type: Sequelize.ENUM("low", "normal", "high", "urgent"),
          allowNull: false,
          defaultValue: "normal"
        },
        target_audience: {
          type: Sequelize.ENUM("all", "employees", "hr", "managers"),
          allowNull: false,
          defaultValue: "all"
        },
        start_date: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        end_date: {
          type: Sequelize.DATE,
          allowNull: true
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        attachments: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    }

    await safeAddIndex(queryInterface, "announcements", ["is_active", "start_date"], {
      name: "announcements_active_start_idx"
    });
    await safeAddIndex(queryInterface, "announcements", ["target_audience", "is_active", "start_date"], {
      name: "announcements_target_active_start_idx"
    });

    if (!(await tableExists(queryInterface, "audit_logs"))) {
      await queryInterface.createTable("audit_logs", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        actor_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        actor_employee_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        target_employee_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        action: {
          type: Sequelize.STRING,
          allowNull: false
        },
        details: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    } else {
      await queryInterface.changeColumn("audit_logs", "actor_id", {
        type: Sequelize.STRING,
        allowNull: true
      });

      await safeConvertColumnToJsonb(queryInterface, "audit_logs", "details");
      await queryInterface.changeColumn("audit_logs", "details", {
        type: Sequelize.JSONB,
        allowNull: true
      });

      await safeAddColumn(queryInterface, "audit_logs", "created_at", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      });
    }

    await safeAddIndex(queryInterface, "audit_logs", ["actor_id", "created_at"], {
      name: "audit_logs_actor_created_idx"
    });
    await safeAddIndex(queryInterface, "audit_logs", ["action", "created_at"], {
      name: "audit_logs_action_created_idx"
    });

    if (!(await tableExists(queryInterface, "import_jobs"))) {
      await queryInterface.createTable("import_jobs", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        finished_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_by: {
          type: Sequelize.STRING,
          allowNull: true
        },
        result: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        error: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        summary: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    } else {
      if ((await columnExists(queryInterface, "import_jobs", "ended_at")) && !(await columnExists(queryInterface, "import_jobs", "finished_at"))) {
        await queryInterface.renameColumn("import_jobs", "ended_at", "finished_at");
      }

      await safeAddColumn(queryInterface, "import_jobs", "finished_at", {
        type: Sequelize.DATE,
        allowNull: true
      });
      await safeAddColumn(queryInterface, "import_jobs", "result", {
        type: Sequelize.JSONB,
        allowNull: true
      });
      await safeAddColumn(queryInterface, "import_jobs", "error", {
        type: Sequelize.TEXT,
        allowNull: true
      });
      await safeAddColumn(queryInterface, "import_jobs", "updated_at", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      });

      await safeConvertColumnToJsonb(queryInterface, "import_jobs", "summary");
      await queryInterface.changeColumn("import_jobs", "summary", {
        type: Sequelize.JSONB,
        allowNull: true
      });

      await safeConvertColumnToJsonb(queryInterface, "import_jobs", "result");
      await queryInterface.changeColumn("import_jobs", "result", {
        type: Sequelize.JSONB,
        allowNull: true
      });

      await queryInterface.changeColumn("import_jobs", "created_by", {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    await safeAddIndex(queryInterface, "import_jobs", ["status", "started_at"], {
      name: "import_jobs_status_started_idx"
    });

    if (!(await tableExists(queryInterface, "blacklisted_tokens"))) {
      await queryInterface.createTable("blacklisted_tokens", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        token_hash: {
          type: Sequelize.STRING(64),
          allowNull: false,
          unique: true
        },
        token_type: {
          type: Sequelize.ENUM("access", "refresh"),
          allowNull: false,
          defaultValue: "access"
        },
        user_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        reason: {
          type: Sequelize.STRING,
          allowNull: true
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    }

    await safeAddIndex(queryInterface, "blacklisted_tokens", ["user_id"], {
      name: "blacklisted_tokens_user_id_idx"
    });
    await safeAddIndex(queryInterface, "blacklisted_tokens", ["expires_at"], {
      name: "blacklisted_tokens_expires_at_idx"
    });

    if (!(await tableExists(queryInterface, "login_attempts"))) {
      await queryInterface.createTable("login_attempts", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: false
        },
        employee_id: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        success: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        failure_reason: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    }

    await safeAddIndex(queryInterface, "login_attempts", ["ip_address", "created_at"], {
      name: "login_attempts_ip_created_idx"
    });
    await safeAddIndex(queryInterface, "login_attempts", ["employee_id", "created_at"], {
      name: "login_attempts_employee_created_idx"
    });

    if (!(await tableExists(queryInterface, "refresh_tokens"))) {
      await queryInterface.createTable("refresh_tokens", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        token: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        token_hash: {
          type: Sequelize.STRING(64),
          allowNull: false,
          unique: true
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        is_valid: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        revoked_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        revoked_by: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        revoked_reason: {
          type: Sequelize.STRING,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
      });
    }

    await safeAddIndex(queryInterface, "refresh_tokens", ["user_id"], {
      name: "refresh_tokens_user_id_idx"
    });
    await safeAddIndex(queryInterface, "refresh_tokens", ["expires_at"], {
      name: "refresh_tokens_expires_at_idx"
    });
    await safeAddIndex(queryInterface, "refresh_tokens", ["is_valid"], {
      name: "refresh_tokens_is_valid_idx"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("refresh_tokens");
    await queryInterface.dropTable("login_attempts");
    await queryInterface.dropTable("blacklisted_tokens");
    await queryInterface.dropTable("import_jobs");
    await queryInterface.dropTable("audit_logs");
    await queryInterface.dropTable("announcements");
    await queryInterface.dropTable("leave_balances");
    await queryInterface.dropTable("leave_requests");
    await queryInterface.dropTable("attendances");
    await queryInterface.dropTable("users");
  }
};
