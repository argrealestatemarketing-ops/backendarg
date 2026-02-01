const { User } = require('../src/models/index.js');
const bcrypt = require('bcryptjs');

async function findEmp001Password() {
  try {
    // Connect to database
    await User.sequelize.sync();
    
    // Find the EMP001 user
    const user = await User.findOne({
      where: { employeeId: 'EMP001' }
    });
    
    if (!user) {
      console.log('User EMP001 not found');
      return;
    }
    
    console.log('User found:', {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive
    });
    
    // Since we don't know the actual password, let's create a test login function
    // that tries common default passwords
    const commonPasswords = [
      'password123',
      '123456',
      'admin123',
      'welcome123',
      'changeme'
    ];
    
    for (const pwd of commonPasswords) {
      const isValid = await bcrypt.compare(pwd, user.password);
      if (isValid) {
        console.log(`Found valid password: ${pwd}`);
        return;
      }
    }
    
    console.log('None of the common passwords matched. The password is randomly generated.');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await User.sequelize.close();
  }
}

findEmp001Password();