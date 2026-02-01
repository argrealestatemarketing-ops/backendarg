const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../src/models');

async function resetPassword() {
  try {
    // Sync the database
    await sequelize.sync();
    
    // Find the test user
    const user = await User.findOne({ where: { employeeId: 'TEST001' } });
    
    if (!user) {
      console.log('❌ User TEST001 not found');
      return;
    }
    
    // Hash the new password
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update the user's password
    await user.update({ password: hashedPassword });
    
    console.log('✅ Password updated successfully!');
    console.log('📋 Updated Credentials:');
    console.log('- Employee ID: TEST001');
    console.log('- New Password: password123');
    console.log('- Name:', user.name);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  }
}

resetPassword();