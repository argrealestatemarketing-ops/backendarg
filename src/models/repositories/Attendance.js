const { Attendance } = require("../index");
const { createModelAdapter } = require("./_sequelizeAdapter");

module.exports = createModelAdapter(Attendance);
