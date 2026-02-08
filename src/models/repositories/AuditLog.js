const { AuditLog } = require("../index");
const { createModelAdapter } = require("./_sequelizeAdapter");

module.exports = createModelAdapter(AuditLog);
