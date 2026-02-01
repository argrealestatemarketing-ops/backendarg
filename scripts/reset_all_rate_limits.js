const User = require('../src/models/mongo/User');
const mongoose = require('mongoose');

async function resetAllRateLimits() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_attendance');
    console.log('Connected to MongoDB');

    // Reset all rate limiting parameters for all users
    const result = await User.updateMany(
      {}, // Match all users
      {
        $set: {
          failedLoginAttempts: 0, // Reset failed attempts
          lockedUntil: null       // Unlock any locked accounts
        }
      }
    );

    console.log(`Successfully reset rate limits for ${result.modifiedCount} users`);
    
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error resetting rate limits:', error);
  }
}

// Run the function
resetAllRateLimits();