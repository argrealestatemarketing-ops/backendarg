const User = require('../src/models/mongo/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

async function updateDemoUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_attendance');
    console.log('Connected to MongoDB');

    // Update EMP001 user with demo credentials
    const emp001Password = '123456';
    const hashedPassword = await bcrypt.hash(emp001Password, 12);

    const updatedUser = await User.findOneAndUpdate(
      { employeeId: 'EMP001' },
      {
        $set: {
          password: hashedPassword,
          mustChangePassword: false, // So user doesn't have to change on first login
          name: 'John Employee',
          email: 'emp001@company.com',
          role: 'employee',
          status: 'active'
        }
      },
      { upsert: true, new: true } // Create if doesn't exist
    );

    console.log(`EMP001 user updated/created successfully!`);
    console.log(`Employee ID: ${updatedUser.employeeId}`);
    console.log(`Name: ${updatedUser.name}`);
    console.log(`Role: ${updatedUser.role}`);

    // Also update HR001 user
    const hr001Password = '123456';
    const hr001HashedPassword = await bcrypt.hash(hr001Password, 12);

    const updatedHRUser = await User.findOneAndUpdate(
      { employeeId: 'HR001' },
      {
        $set: {
          password: hr001HashedPassword,
          mustChangePassword: false,
          name: 'HR Manager',
          email: 'hr001@company.com',
          role: 'hr',
          status: 'active'
        }
      },
      { upsert: true, new: true }
    );

    console.log(`HR001 user updated/created successfully!`);
    console.log(`Employee ID: ${updatedHRUser.employeeId}`);
    console.log(`Name: ${updatedHRUser.name}`);
    console.log(`Role: ${updatedHRUser.role}`);

    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error updating demo users:', error);
  }
}

// Run the function
updateDemoUser();