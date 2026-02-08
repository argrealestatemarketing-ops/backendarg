const { DataTypes } = require("sequelize");

// BlacklistedToken model
const BlacklistedToken = (sequelize) => {
  return sequelize.define("BlacklistedToken", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    tokenType: {
      type: DataTypes.ENUM("access", "refresh"),
      allowNull: false,
      defaultValue: "access"
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "blacklisted_tokens",
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ["user_id"]
      },
      {
        fields: ["expires_at"]
      }
    ]
  });
};

// LoginAttempt model
const LoginAttempt = (sequelize) => {
  return sequelize.define("LoginAttempt", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ipAddress: {
      type: DataTypes.STRING(45), // Supports IPv6
      allowNull: false
    },
    employeeId: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    failureReason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "login_attempts",
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ["ip_address", "created_at"]
      },
      {
        fields: ["employee_id", "created_at"]
      },
      {
        fields: ["success"]
      }
    ]
  });
};

// RefreshToken model
const RefreshToken = (sequelize) => {
  return sequelize.define("RefreshToken", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    isValid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    revokedBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    revokedReason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "refresh_tokens",
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ["user_id"]
      },
      {
        fields: ["expires_at"]
      },
      {
        fields: ["is_valid"]
      }
    ]
  });
};

module.exports = {
  BlacklistedToken,
  LoginAttempt,
  RefreshToken
};
