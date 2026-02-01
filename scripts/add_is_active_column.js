const { sequelize } = require('../src/models');

async function addIsActiveColumn() {
  try {
    console.log('Adding isActive column to users table...');
    
    // Add the isActive column manually
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN is_active BOOLEAN DEFAULT TRUE
    `);
    
    console.log('✅ isActive column added successfully!');
    
    // Close the connection
    await sequelize.close();
  } catch (error) {
    // If the column already exists, that's fine
    if (error.original && error.original.errno === 1) { // Column already exists
      console.log('ℹ️  isActive column already exists');
    } else {
      console.error('❌ Error adding isActive column:', error);
    }
    
    await sequelize.close();
  }
}

addIsActiveColumn();