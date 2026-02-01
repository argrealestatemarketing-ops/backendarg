const { MongoClient } = require('mongodb');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// Explicitly connect to SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'backend_dev.sqlite',
  logging: console.log // Enable logging to see what's happening
});

// Define the User model to match the actual database structure
const User = sequelize.define('User', {
  employee_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'employee'
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  must_change_password: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  password_changed_at: {
    type: DataTypes.DATE
  },
  token_version: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  failed_login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  locked_until: {
    type: DataTypes.DATE
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users', // Note: lowercase table name
  timestamps: true
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hr_attendance';

async function exportUsers() {
  let client;
  try {
    console.log('[SYNC] Connecting to SQLite database...');
    await sequelize.authenticate();
    console.log('[SYNC] SQLite connection established');
    
    // Test the connection by counting users
    const userCount = await User.count();
    console.log('[SYNC] Total users in SQLite:', userCount);
    
    if (userCount === 0) {
      console.log('[SYNC] No users found in SQLite database');
      return;
    }
    
    // Get all users with correct column names
    const users = await User.findAll({
      attributes: [
        'employee_id', 
        'name', 
        'email', 
        'role', 
        'password', 
        'must_change_password', 
        'is_active', 
        'created_at', 
        'updated_at'
      ]
    });
    
    console.log('[SYNC] Found', users.length, 'users to export');
    
    // Connect to MongoDB
    console.log('[SYNC] Connecting to MongoDB...');
    client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db();
    const col = db.collection('users');
    console.log('[SYNC] MongoDB connection established');
    
    // Export users - convert snake_case to camelCase for consistency
    let exportedCount = 0;
    for (const user of users) {
      const userData = user.toJSON();
      // Convert field names to camelCase for MongoDB
      const mongoUser = {
        employeeId: userData.employee_id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        password: userData.password,
        mustChangePassword: userData.must_change_password,
        isActive: userData.is_active,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      };
      
      await col.updateOne(
        { employeeId: mongoUser.employeeId }, 
        { $set: mongoUser }, 
        { upsert: true }
      );
      console.log('[MONGO] Upserted', mongoUser.employeeId, '-', mongoUser.name);
      exportedCount++;
    }
    
    console.log('[MONGO] Export complete. Total users exported:', exportedCount);
    console.log('[MONGO] You can now open the database at:', MONGO_URI);
    
  } catch (err) {
    console.error('[SYNC] Error:', err.message || err);
    console.error('[SYNC] Full error:', err);
    process.exit(1);
  } finally {
    if (client) await client.close();
    await sequelize.close();
    process.exit(0);
  }
}

exportUsers();