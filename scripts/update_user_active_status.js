const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../src/models');

async function updateUserActiveStatus() {
  try {
    // Sync the database
    await sequelize.sync();
    
    // Find the test user
    const user = await User.findOne({ where: { employeeId: 'TEST001' } });
    
    if (!user) {
      console.log('❌ User TEST001 not found');
      return;
    }
    
    // Update the user to ensure isActive is set and password is correct
    await user.update({ 
      isActive: true,
      password: await bcrypt.hash('password123', 12) // Re-hash the password just in case
    });
    
    console.log('✅ User updated successfully!');
    console.log('📋 Updated Credentials:');
    console.log('- Employee ID: TEST001');
    console.log('- Password: password123');
    console.log('- isActive: true');
    console.log('- Name:', user.name);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error updating user:', error);
    process.exit(1);
  }
}

updateUserActiveStatus();