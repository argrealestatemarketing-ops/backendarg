const { BlacklistedToken } = require("../index");
const { createModelAdapter } = require("./_sequelizeAdapter");

module.exports = createModelAdapter(BlacklistedToken);
