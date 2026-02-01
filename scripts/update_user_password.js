const User = require('../src/models/mongo/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

async function updateUserPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_attendance');
    console.log('Connected to MongoDB');

    // Update user ID "1" with the specific password
    const newPassword = 'Ahmed010.com@';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const updatedUser = await User.findOneAndUpdate(
      { employeeId: '1' },
      {
        $set: {
          password: hashedPassword,
          mustChangePassword: false, // So user doesn't have to change on first login
          name: 'Sara Ali Zaki', // Confirming the name
          email: '1@company.com',
          role: 'employee',
          status: 'active'
        }
      },
      { upsert: true, new: true } // Create if doesn't exist
    );

    console.log(`User ID "1" updated/created successfully!`);
    console.log(`Employee ID: ${updatedUser.employeeId}`);
    console.log(`Name: ${updatedUser.name}`);
    console.log(`Role: ${updatedUser.role}`);
    console.log(`Password updated to: ${newPassword}`);

    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error updating user:', error);
  }
}

// Run the function
updateUserPassword();