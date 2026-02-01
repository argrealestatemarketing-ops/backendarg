const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Announcement", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    createdBy: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    sentToAll: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, {
    tableName: "announcements",
    timestamps: false,
    underscored: true,
  });
};