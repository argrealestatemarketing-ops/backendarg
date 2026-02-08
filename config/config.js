require("dotenv").config();

const useSsl = process.env.PGSSLMODE === "require" || process.env.NODE_ENV === "production";

function buildDatabaseConfig(databaseUrlEnv, fallbackDatabaseName) {
  const config = {
    dialect: "postgres",
    logging: false,
    dialectOptions: useSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      : {}
  };

  if (process.env[databaseUrlEnv]) {
    return {
      use_env_variable: databaseUrlEnv,
      ...config
    };
  }

  return {
    username: process.env.PGUSER || process.env.DB_USER || "postgres",
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || "postgres",
    database: process.env.PGDATABASE || process.env.DB_NAME || fallbackDatabaseName,
    host: process.env.PGHOST || process.env.DB_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.PGPORT || process.env.DB_PORT || "5432", 10),
    ...config
  };
}

module.exports = {
  development: buildDatabaseConfig("DATABASE_URL", "hr_attendance"),
  test: buildDatabaseConfig("DATABASE_URL_TEST", "hr_attendance_test"),
  production: buildDatabaseConfig("DATABASE_URL", "hr_attendance")
};
