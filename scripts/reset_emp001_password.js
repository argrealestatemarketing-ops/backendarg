const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/models');

async function resetEmp001Password() {
  try {
    console.log('Resetting password for EMP001...');
    
    // Hash the new password
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update the user's password directly
    await sequelize.query(
      'UPDATE users SET password = ?, must_change_password = 0 WHERE employee_id = ?',
      {
        replacements: [hashedPassword, 'EMP001']
      }
    );
    
    console.log('✅ EMP001 password updated successfully!');
    console.log('📋 Updated Credentials:');
    console.log('- Employee ID: EMP001');
    console.log('- New Password: password123');
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error updating EMP001 password:', error);
    process.exit(1);
  }
}

resetEmp001Password();