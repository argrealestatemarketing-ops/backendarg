const { sequelize } = require('../src/models');

async function checkUser() {
  try {
    console.log('Checking users in database...');
    
    // Direct query to see all users
    const [results] = await sequelize.query('SELECT employee_id, name, email FROM users');
    
    console.log('Users in database:');
    results.forEach(user => {
      console.log(`- ${user.employee_id} | ${user.name} | ${user.email}`);
    });
    
    // Check specific user
    const [empResults] = await sequelize.query(
      'SELECT employee_id, name, must_change_password FROM users WHERE employee_id = ?', 
      { replacements: ['EMP001'] }
    );
    
    console.log('\nEMP001 details:', empResults);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error checking users:', error);
    process.exit(1);
  }
}

checkUser();