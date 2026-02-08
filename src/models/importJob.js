const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("ImportJob", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    finishedAt: { type: DataTypes.DATE, allowNull: true },
    createdBy: { type: DataTypes.STRING, allowNull: true },
    result: { type: DataTypes.JSONB, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    summary: { type: DataTypes.JSONB, allowNull: true }
  }, {
    tableName: "import_jobs",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["status", "started_at"] },
      { fields: ["type", "status", "started_at"] }
    ]
  });
};
