const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Announcement", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    author: { type: DataTypes.STRING, allowNull: false },
    priority: {
      type: DataTypes.ENUM("low", "normal", "high", "urgent"),
      allowNull: false,
      defaultValue: "normal"
    },
    targetAudience: {
      type: DataTypes.ENUM("all", "employees", "hr", "managers"),
      allowNull: false,
      defaultValue: "all"
    },
    startDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    endDate: { type: DataTypes.DATE, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    attachments: { type: DataTypes.JSONB, allowNull: true }
  }, {
    tableName: "announcements",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["is_active", "start_date"] },
      { fields: ["created_at"] },
      { fields: ["target_audience", "is_active", "start_date"] }
    ]
  });
};
