const { LeaveRequest } = require("../index");
const { createModelAdapter } = require("./_sequelizeAdapter");

module.exports = createModelAdapter(LeaveRequest);
