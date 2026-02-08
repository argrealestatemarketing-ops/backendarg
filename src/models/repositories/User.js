const { User } = require("../index");
const { createModelAdapter } = require("./_sequelizeAdapter");

module.exports = createModelAdapter(User);
