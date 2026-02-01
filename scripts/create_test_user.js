const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../src/models');

async function createTestUser() {
  try {
    // Sync the database
    await sequelize.sync();
    
    // Create a test user with a known password
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const testUser = await User.create({
      employeeId: 'TEST001',
      name: 'Test User',
      email: 'test@company.com',
      role: 'employee',
      password: hashedPassword,
      mustChangePassword: false // Set to false so user doesn't have to change on first login
    });
    
    console.log('✅ Test user created successfully!');
    console.log('📋 Test Credentials:');
    console.log('- Employee ID: TEST001');
    console.log('- Password: password123');
    console.log('- Name: Test User');
    console.log('- Role: employee');
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();