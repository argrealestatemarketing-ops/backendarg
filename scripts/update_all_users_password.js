const User = require('../src/models/mongo/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

async function updateAllUsersPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_attendance');
    console.log('Connected to MongoDB');

    // Define the common password for all users
    const commonPassword = '123456';
    const hashedPassword = await bcrypt.hash(commonPassword, 12);

    // Update all users to have the common password
    const result = await User.updateMany(
      {}, // Match all users
      {
        $set: {
          password: hashedPassword,
          mustChangePassword: false, // So users don't have to change on first login
          status: 'active' // Ensure all users are active
        }
      }
    );

    console.log(`Successfully updated ${result.modifiedCount} users with common password '123456'`);
    
    // Verify a few specific users
    const emp001 = await User.findOne({ employeeId: 'EMP001' });
    const user1 = await User.findOne({ employeeId: '1' });
    const user2 = await User.findOne({ employeeId: '2' });
    
    console.log(`EMP001 found: ${!!emp001}, Name: ${emp001 ? emp001.name : 'N/A'}`);
    console.log(`User 1 found: ${!!user1}, Name: ${user1 ? user1.name : 'N/A'}`);
    console.log(`User 2 found: ${!!user2}, Name: ${user2 ? user2.name : 'N/A'}`);

    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error updating all users:', error);
  }
}

// Run the function
updateAllUsersPassword();