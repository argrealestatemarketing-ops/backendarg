const { User } = require('../src/models/index.js');
const bcrypt = require('bcryptjs');

async function resetEmp001Password() {
  try {
    // Connect to database
    await User.sequelize.authenticate();
    
    // Find the EMP001 user
    const user = await User.findOne({
      where: { employeeId: 'EMP001' }
    });
    
    if (!user) {
      console.log('User EMP001 not found');
      return;
    }
    
    // Set a known password for testing
    const testPassword = 'password123';
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    
    await user.update({
      password: hashedPassword,
      mustChangePassword: false // So we don't get redirected to change password
    });
    
    console.log('EMP001 password reset successfully!');
    console.log('New test credentials:');
    console.log('- Employee ID: EMP001');
    console.log('- Password:', testPassword);
    console.log('- Role: employee');
    
    await User.sequelize.close();
  } catch (error) {
    console.error('Error resetting password:', error.message);
  }
}

resetEmp001Password();