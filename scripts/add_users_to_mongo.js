const User = require('../src/models/mongo/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// List of users from your request
const users = [
  { id: 1, name: 'Sara Ali Zaki' },
  { id: 2, name: 'Mohamed Mamdouh Mousa' },
  { id: 3, name: 'Maryam Sayed Ahmed' },
  { id: 4, name: 'Amgad Mohamed Elhelaly' },
  { id: '1018', name: 'Mohmed Abdlrahman Mohmed' },
  { id: '1021', name: 'Mahmoud Ahmed Mohamed' },
  { id: 9, name: 'Toka Ashraf Kamal' },
  { id: 12, name: 'Yasmen Ahmed Fekrey' },
  { id: 13, name: 'Hager Abdullah Ibrahim' },
  { id: 14, name: 'Ahmed Abdelhamed Aliem' },
  { id: 15, name: 'Menna Mohamed Bayoumi' },
  { id: 16, name: 'Hager Mohamed Abdelatif' },
  { id: 17, name: 'Mohamed Nabil Hassan' },
  { id: 19, name: 'Nadeen Samir Farouk' },
  { id: 20, name: 'Dalia Mohamed Bakr' },
  { id: 21, name: 'Amr Shehata Ibrahim' },
  { id: 22, name: 'Lobna Hamed Ahmed' },
  { id: 23, name: 'Yousef Mohamed Abdelhad' },
  { id: 24, name: 'Asmaa Mohamed' },
  { id: 27, name: 'Gana Salem' },
  { id: 28, name: 'Ahmed Abdelsadek' },
  { id: 29, name: 'Basmala Abdelsabor' },
  { id: 31, name: 'Habiba Ahmed Mohamed' },
  { id: 32, name: 'Mohamed Jamiu Ebrahim' },
  { id: 35, name: 'Rahma Ali Mohamed' },
  { id: 38, name: 'Nourhan Ashraf Zien' },
  { id: 39, name: 'Mohamed Galal Ahmed' },
  { id: 40, name: 'Beshoy Monir Adly' },
  { id: 41, name: 'Ahmed Mohamed Ali' },
  { id: 43, name: 'Abdelwhab Nasr Eldin' },
  { id: 47, name: 'Hager Mohamed Ibrahim' },
  { id: 48, name: 'Maida Samir Ali' },
  { id: 49, name: 'Kareem Megahed Badry' },
  { id: 53, name: 'Mariam Tarek' },
  { id: 55, name: 'Mahmoud Elsayed Mahmoud' },
  { id: 58, name: 'Omar Ahmed Metwaly' },
  { id: 59, name: 'Amr Fathy Mohamed' },
  { id: '1001', name: 'Ahmed Ramdan Essia' },
  { id: '1002', name: 'Ismail Ismail Ismail' },
  { id: '1003', name: 'Abdemonem Fouad' },
  { id: '1005', name: 'Ahmed Mohsen Elsayed' },
  { id: '1006', name: 'Ahmed Salah Abdelrazik' },
  { id: '1007', name: 'AbedElrahman Mahmoud' },
  { id: '1009', name: 'Ahmed Abdullah Ali' },
  { id: '1010', name: 'Yousif Essam Mohamed' },
  { id: '1012', name: 'Mohamed Salah Mohamed' },
  { id: '1013', name: 'Amira gamal Eldin' },
  { id: '1014', name: 'Alaa Rabie Mohamed' },
  { id: '1015', name: 'Azima Elsallam Mohamed' },
  { id: '1016', name: 'Mariam Hamada Saad Eldi' },
  { id: '1017', name: 'Rahma Marzok Hesham' },
  { id: '1019', name: 'Omnia Eltaher Mohamed' },
  { id: '1020', name: 'Magda Mohamed Tantawy' },
  { id: '1022', name: 'Anwar Reda Fathy' },
  { id: '1023', name: 'Wedad Mohamed Ezzat' },
  { id: '1024', name: 'Mohsen Mohamed Hazem' },
  { id: '1026', name: 'Abdelrhman Mohamed Fara' },
  { id: '1029', name: 'Sara Mohamed Abdelaziz' },
  { id: 7, name: 'Fouad Gamal Abdelhamid' },
  { id: 8, name: 'Helmy Mohamed Helmy' },
  { id: 10, name: 'Empty' },
  { id: 30, name: 'Empty' },
  { id: 33, name: 'Ahmed Arafa Abdelrahman' },
  { id: '1036', name: 'Hoda Mahmoud Abdelhamid' },
  { id: '1037', name: 'Farid Mohamed Yassin' },
  { id: '1038', name: 'Zaid Mahmoud Ata' },
  { id: '1039', name: 'Seif Elden Mohamed' },
  { id: '1040', name: 'Rana Rashed Ismail' },
  { id: '1042', name: 'Nermeen Essam Abdemonem' },
  { id: '1044', name: 'Shourok Mohamed Rashad' },
  { id: 37, name: 'Empty' },
  { id: '1053', name: 'Hadeer Mohamed Abdelezz' },
  { id: '1055', name: 'Omar Hussien Fouad' },
  { id: '1056', name: 'Zeyad Mohamed Elbana' },
  { id: 45, name: 'Nihal Tolba' },
  { id: '1060', name: 'Laila Salah Ashour' },
  { id: 46, name: 'Ahd Waleed' },
  { id: '1063', name: 'Merna Ahmed Abdelfatah' },
  { id: '1065', name: 'Youssef Mohamed Ahmed' },
  { id: '1069', name: 'Salah Tarek Sayed' },
  { id: '1070', name: 'Basem Mostafa Hussien' },
  { id: '1072', name: 'Alaa Ashour Mahmoud' },
  { id: '1073', name: 'Mohaimen Mohamed Nagib' },
  { id: 50, name: 'Empty' },
  { id: '1076', name: 'Eman Ayman Abdelazim' },
  { id: 51, name: 'Empty' },
  { id: 52, name: 'Empty' },
  { id: 56, name: 'Empty' },
  { id: '1121', name: 'Nada Mohamed Bayoumi' },
  { id: '1126', name: 'Raneem Osama Abdelaleem' },
  { id: 57, name: 'Empty' },
  { id: '1131', name: 'Dina Gamal Salem' },
  { id: '1057', name: 'Khloud Amr Mohamed' },
  { id: 44, name: 'Shehab Elsayed Amin' },
  { id: '1062', name: 'Amin Mohamed Amin' },
  { id: '1074', name: 'Mohamed Matrawy Gaber' },
  { id: '1080', name: 'Ahmed Mohamed Elkhatib' },
  { id: '1077', name: 'Samir Mohamed Samir' },
  { id: '1041', name: 'Samia Abdelrahman Mohmed' },
  { id: '1064', name: 'Sara Abdelgwad Khalil' },
  { id: '1067', name: 'John Ashraf Agib' },
  { id: '1078', name: 'Gehad Sobhy Mohamed' },
  { id: '1079', name: 'Nancy Salem Ahmed' },
  { id: '1081', name: 'Weshah Moawya Mohamed' },
  { id: '1083', name: 'Empty' },
  { id: '1085', name: 'Mariam Alaa Mohamed' },
  { id: '1086', name: 'Empty' },
  { id: '1087', name: 'Mennat Allah Alaa Ali' },
  { id: '1088', name: 'Tasneem Ahmed Abdelaziz' },
  { id: '1089', name: 'Shrouk Hossam Abdelmonem' },
  { id: '1093', name: 'Abdelrahman Hesham Riyad' },
  { id: '1094', name: 'Waad Mohamed Ghrib' },
  { id: '1095', name: 'Emad Eldin Yasser Sayed' },
  { id: '1096', name: 'Habiba Essam Hashem' },
  { id: '1098', name: 'Mostafa Essam Mostafa' },
  { id: '1099', name: 'Empty' },
  { id: '1102', name: 'Empty' },
  { id: '1103', name: 'Empty' },
  { id: '1104', name: 'Empty' },
  { id: '1105', name: 'Empty' },
  { id: '1106', name: 'Empty' },
  { id: '1107', name: 'Empty' },
  { id: '1108', name: 'Empty' },
  { id: '1109', name: 'Empty' },
  { id: '1112', name: 'Empty' },
  { id: '1113', name: 'Empty' },
  { id: '1114', name: 'Empty' },
  { id: '1115', name: 'Empty' },
  { id: '1116', name: 'Empty' },
  { id: '1117', name: 'Empty' },
  { id: '1118', name: 'Empty' },
  { id: '1119', name: 'Empty' },
  { id: '1120', name: 'Empty' },
  { id: '1122', name: 'Empty' },
  { id: '1123', name: 'Empty' },
  { id: '1124', name: 'Empty' },
  { id: '1125', name: 'Empty' },
  { id: '1127', name: 'Empty' },
  { id: '1128', name: 'Empty' },
  { id: '1130', name: 'Empty' },
  { id: 60, name: 'Ahmed Ashraf Abdelhamid' },
  { id: 5, name: 'Omar Nasser' },
  { id: '2000', name: 'Monzer Mehrez Mokhtar' },
  { id: '1050', name: 'Ahd Waleed Elsayed' },
  { id: '1111', name: 'Empty' },
  { id: '2001', name: 'Shady  Mohamed Mohamed' },
  { id: '2002', name: 'Ahmed Sami Maghawry' },
  { id: '2004', name: 'Mostafa Mohamed Mahmoud' },
  { id: '2005', name: 'Yousef Ashraf Fatooh' },
  { id: 61, name: 'Mostafa Ahmed' },
  { id: '2006', name: 'Mostafa Essam Mostafa' },
  { id: '2007', name: 'Eman Fathi Abdelaziz' },
  { id: '2008', name: 'Reem Ehab' },
  { id: '2009', name: 'Mohamed Osama Abdelmawla' },
  { id: '1033', name: 'Fatma Abdullah Elsayed' },
  { id: '1025', name: 'Mohamed Ramzy Mansour' },
  { id: '1043', name: 'Shahd Hossam Ahmed' },
  { id: '1090', name: 'Mohamed Mousa Eid' },
  { id: '1084', name: 'Tarek Adel Farouk' },
  { id: '1051', name: 'Abanob Melad Anwer' },
  { id: '1061', name: 'Ahmed Mohamed Hessin' },
  { id: '1068', name: 'Zenab Hassan sobhi' },
  { id: '1097', name: 'Abdelrahman Khaled Ali' },
  { id: '1101', name: 'Shimaa Hussien Ahmed' },
  { id: '1052', name: 'Hossam Mahmoud Mohamed' },
  { id: '1100', name: 'Lamlom Mohamed Lamlom' },
  { id: '1008', name: 'Moawya Abdullah Mohamed' },
  { id: '1048', name: 'Youssef Alaa Mohamed' },
  { id: '1091', name: 'Shreef Talat Mohamed' },
  { id: '1031', name: 'Marwa Abdelrasol Selim' },
  { id: '1058', name: 'Amany Mohsen Ibrahim' },
  { id: '1082', name: 'Engy Ahmed Hussien' },
  { id: '1129', name: 'Nourhan Mohamed Morsy' },
  { id: '1004', name: 'Salah Eldin Khatab' },
  { id: 34, name: 'Hussien Gamal Elfkhrany' },
  { id: '1030', name: 'Yasser Yehya Barbary' },
  { id: '1027', name: 'Mohamed Mahmoud Fawzy' },
  { id: 36, name: 'Habiba Samir Mohamed' },
  { id: '1035', name: 'Ahnmed Abdelatif Ahmed' },
  { id: 6, name: 'Jasy Medhat Ezzat' },
  { id: '1110', name: 'Esraa Ehab Hossam' },
  { id: '1034', name: 'Sondos Nabil Ibrahim' },
  { id: '1011', name: 'Mahmoud Hesham Mahmoud' },
  { id: '1028', name: 'Mohmaed Talat Elsayed' },
  { id: '1046', name: 'Hoda Nasser Mohamed' },
  { id: '1054', name: 'Mohamed Ayman Mohamed' },
  { id: '1059', name: 'Ibrahim Essam Hussien' },
  { id: '1066', name: 'Ahmed Mohamed Ashour' },
  { id: '1032', name: 'Mohamed Ibrahim Shehata' },
  { id: '1075', name: 'Mennat Allah Sayed' },
  { id: '1071', name: 'Mahmoud Soliman Soliman' },
  { id: '1092', name: 'Nada Fayez Mohamed' },
  { id: 11, name: 'Alaa Eldin Ahmed' },
  { id: '1045', name: 'Osama Awad Mohamed' },
  { id: '1047', name: 'Monzer Mehrez Mokhtar' },
  { id: '1049', name: 'Mohamed Farouk Mahmoud' },
  { id: '2010', name: 'name' },
  { id: '2011', name: 'name' },
  { id: '2012', name: 'name' },
  { id: 18, name: 'Menna Ahmed Mohammed' },
  { id: 26, name: 'Hanen Mohamed Ramadan' },
  { id: 25, name: 'Ahmed Ramadan Elsadany' },
  { id: 54, name: 'Hady Tamer Elsayed' }
];

async function addUsersToMongo() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_attendance');
    console.log('Connected to MongoDB');

    // Process each user
    for (const user of users) {
      const employeeId = user.id.toString(); // Convert to string to handle numeric IDs
      const name = user.name;
      
      // Generate email from name (simple approach)
      const email = `${employeeId}@company.com`;
      
      // Create default password (you might want to customize this)
      const defaultPassword = '123456';
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      // Check if user already exists
      const existingUser = await User.findOne({ employeeId: employeeId });

      if (!existingUser) {
        // Create new user
        const newUser = new User({
          employeeId: employeeId,
          name: name,
          email: email,
          role: 'employee', // Default role
          password: hashedPassword,
          mustChangePassword: true, // Force password change on first login
          status: 'active'
        });

        await newUser.save();
        console.log(`Created user: ${employeeId} - ${name}`);
      } else {
        console.log(`User already exists: ${employeeId} - ${name}`);
      }
    }

    console.log('All users processed successfully!');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error processing users:', error);
  }
}

// Run the function
addUsersToMongo();