const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("ImportJob", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false }, // running, success, failed
    startedAt: { type: DataTypes.DATE, allowNull: false },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    summary: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    tableName: "import_jobs",
    timestamps: true,
    underscored: true
  });
};