const User = require('../src/models/mongo/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Clean list of users with only numeric IDs
const cleanUsers = [
  { id: 1, name: 'Sara Ali Zaki' },
  { id: 2, name: 'Mohamed Mamdouh Mousa' },
  { id: 3, name: 'Maryam Sayed Ahmed' },
  { id: 4, name: 'Amgad Mohamed Elhelaly' },
  { id: 5, name: 'Omar Nasser' },
  { id: 6, name: 'Jasy Medhat Ezzat' },
  { id: 7, name: 'Fouad Gamal Abdelhamid' },
  { id: 8, name: 'Helmy Mohamed Helmy' },
  { id: 9, name: 'Toka Ashraf Kamal' },
  { id: 10, name: 'Empty User' },
  { id: 11, name: 'Alaa Eldin Ahmed' },
  { id: 12, name: 'Yasmen Ahmed Fekrey' },
  { id: 13, name: 'Hager Abdullah Ibrahim' },
  { id: 14, name: 'Ahmed Abdelhamed Aliem' },
  { id: 15, name: 'Menna Mohamed Bayoumi' },
  { id: 16, name: 'Hager Mohamed Abdelatif' },
  { id: 17, name: 'Mohamed Nabil Hassan' },
  { id: 18, name: 'Menna Ahmed Mohammed' },
  { id: 19, name: 'Nadeen Samir Farouk' },
  { id: 20, name: 'Dalia Mohamed Bakr' },
  { id: 21, name: 'Amr Shehata Ibrahim' },
  { id: 22, name: 'Lobna Hamed Ahmed' },
  { id: 23, name: 'Yousef Mohamed Abdelhad' },
  { id: 24, name: 'Asmaa Mohamed' },
  { id: 25, name: 'Ahmed Ramadan Elsadany' },
  { id: 26, name: 'Hanen Mohamed Ramadan' },
  { id: 27, name: 'Gana Salem' },
  { id: 28, name: 'Ahmed Abdelsadek' },
  { id: 29, name: 'Basmala Abdelsabor' },
  { id: 30, name: 'Empty User' },
  { id: 31, name: 'Habiba Ahmed Mohamed' },
  { id: 32, name: 'Mohamed Jamiu Ebrahim' },
  { id: 33, name: 'Ahmed Arafa Abdelrahman' },
  { id: 34, name: 'Hussien Gamal Elfkhrany' },
  { id: 35, name: 'Rahma Ali Mohamed' },
  { id: 36, name: 'Habiba Samir Mohamed' },
  { id: 37, name: 'Empty User' },
  { id: 38, name: 'Nourhan Ashraf Zien' },
  { id: 39, name: 'Mohamed Galal Ahmed' },
  { id: 40, name: 'Beshoy Monir Adly' },
  { id: 41, name: 'Ahmed Mohamed Ali' },
  { id: 43, name: 'Abdelwhab Nasr Eldin' },
  { id: 44, name: 'Shehab Elsayed Amin' },
  { id: 45, name: 'Nihal Tolba' },
  { id: 46, name: 'Ahd Waleed' },
  { id: 47, name: 'Hager Mohamed Ibrahim' },
  { id: 48, name: 'Maida Samir Ali' },
  { id: 49, name: 'Kareem Megahed Badry' },
  { id: 50, name: 'Empty User' },
  { id: 51, name: 'Empty User' },
  { id: 52, name: 'Empty User' },
  { id: 53, name: 'Mariam Tarek' },
  { id: 54, name: 'Hady Tamer Elsayed' },
  { id: 55, name: 'Mahmoud Elsayed Mahmoud' },
  { id: 56, name: 'Empty User' },
  { id: 57, name: 'Empty User' },
  { id: 58, name: 'Omar Ahmed Metwaly' },
  { id: 59, name: 'Amr Fathy Mohamed' },
  { id: 60, name: 'Ahmed Ashraf Abdelhamid' },
  { id: 61, name: 'Mostafa Ahmed' }
];

async function resetUsersClean() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_attendance');
    console.log('Connected to MongoDB');

    // Clear all existing users
    await User.deleteMany({});
    console.log('Cleared all existing users');

    // Create clean users with numeric IDs only
    for (const userData of cleanUsers) {
      const employeeId = userData.id.toString();
      const email = `${employeeId}@company.com`;
      const defaultPassword = '123456';
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      const newUser = new User({
        employeeId: employeeId,
        name: userData.name,
        email: email,
        role: 'employee',
        password: hashedPassword,
        mustChangePassword: true, // Force password change on first login
        status: 'active'
      });

      await newUser.save();
      console.log(`Created user: ${employeeId} - ${userData.name}`);
    }

    console.log(`Successfully created ${cleanUsers.length} clean users with numeric IDs only!`);
    console.log('All users require password change on first login.');
    
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error resetting users:', error);
  }
}

// Run the function
resetUsersClean();