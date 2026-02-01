const { User } = require('../src/models/index.js');
const bcrypt = require('bcryptjs');

// Array of users to add - using numeric format with padding
const usersToAdd = [
  { employeeId: '0001', name: 'Sara Ali Zaki' },
  { employeeId: '0002', name: 'Mohamed Mamdouh Mousa' },
  { employeeId: '0003', name: 'Maryam Sayed Ahmed' },
  { employeeId: '0004', name: 'Amgad Mohamed Elhelaly' },
  { employeeId: '1018', name: 'Mohmed Abdlrahman Mohmed' },
  { employeeId: '1021', name: 'Mahmoud Ahmed Mohamed' },
  { employeeId: '0009', name: 'Toka Ashraf Kamal' },
  { employeeId: '0012', name: 'Yasmen Ahmed Fekrey' },
  { employeeId: '0013', name: 'Hager Abdullah Ibrahim' },
  { employeeId: '0014', name: 'Ahmed Abdelhamed Aliem' },
  { employeeId: '0015', name: 'Menna Mohamed Bayoumi' },
  { employeeId: '0016', name: 'Hager Mohamed Abdelatif' },
  { employeeId: '0017', name: 'Mohamed Nabil Hassan' },
  { employeeId: '0019', name: 'Nadeen Samir Farouk' },
  { employeeId: '0020', name: 'Dalia Mohamed Bakr' },
  { employeeId: '0021', name: 'Amr Shehata Ibrahim' },
  { employeeId: '0022', name: 'Lobna Hamed Ahmed' },
  { employeeId: '0023', name: 'Yousef Mohamed Abdelhad' },
  { employeeId: '0024', name: 'Asmaa Mohamed' },
  { employeeId: '0027', name: 'Gana Salem' },
  { employeeId: '0028', name: 'Ahmed Abdelsadek' },
  { employeeId: '0029', name: 'Basmala Abdelsabor' },
  { employeeId: '0031', name: 'Habiba Ahmed Mohamed' },
  { employeeId: '0032', name: 'Mohamed Jamiu Ebrahim' },
  { employeeId: '0035', name: 'Rahma Ali Mohamed' },
  { employeeId: '0038', name: 'Nourhan Ashraf Zien' },
  { employeeId: '0039', name: 'Mohamed Galal Ahmed' },
  { employeeId: '0040', name: 'Beshoy Monir Adly' },
  { employeeId: '0041', name: 'Ahmed Mohamed Ali' },
  { employeeId: '0043', name: 'Abdelwhab Nasr Eldin' },
  { employeeId: '0047', name: 'Hager Mohamed Ibrahim' },
  { employeeId: '0048', name: 'Maida Samir Ali' },
  { employeeId: '0049', name: 'Kareem Megahed Badry' },
  { employeeId: '0053', name: 'Mariam Tarek' },
  { employeeId: '0055', name: 'Mahmoud Elsayed Mahmoud' },
  { employeeId: '0058', name: 'Omar Ahmed Metwaly' },
  { employeeId: '0059', name: 'Amr Fathy Mohamed' },
  { employeeId: '1001', name: 'Ahmed Ramdan Essia' },
  { employeeId: '1002', name: 'Ismail Ismail Ismail' },
  { employeeId: '1003', name: 'Abdemonem Fouad' },
  { employeeId: '1005', name: 'Ahmed Mohsen Elsayed' },
  { employeeId: '1006', name: 'Ahmed Salah Abdelrazik' },
  { employeeId: '1007', name: 'AbedElrahman Mahmoud' },
  { employeeId: '1009', name: 'Ahmed Abdullah Ali' },
  { employeeId: '1010', name: 'Yousif Essam Mohamed' },
  { employeeId: '1012', name: 'Mohamed Salah Mohamed' },
  { employeeId: '1013', name: 'Amira gamal Eldin' },
  { employeeId: '1014', name: 'Alaa Rabie Mohamed' },
  { employeeId: '1015', name: 'Azima Elsallam Mohamed' },
  { employeeId: '1016', name: 'Mariam Hamada Saad Eldi' },
  { employeeId: '1017', name: 'Rahma Marzok Hesham' },
  { employeeId: '1019', name: 'Omnia Eltaher Mohamed' },
  { employeeId: '1020', name: 'Magda Mohamed Tantawy' },
  { employeeId: '1022', name: 'Anwar Reda Fathy' },
  { employeeId: '1023', name: 'Wedad Mohamed Ezzat' },
  { employeeId: '1024', name: 'Mohsen Mohamed Hazem' },
  { employeeId: '1026', name: 'Abdelrhman Mohamed Fara' },
  { employeeId: '1029', name: 'Sara Mohamed Abdelaziz' },
  { employeeId: '0007', name: 'Fouad Gamal Abdelhamid' },
  { employeeId: '0008', name: 'Helmy Mohamed Helmy' },
  { employeeId: '0010', name: 'Empty' },
  { employeeId: '0030', name: 'Empty' },
  { employeeId: '0033', name: 'Ahmed Arafa Abdelrahman' },
  { employeeId: '1036', name: 'Hoda Mahmoud Abdelhamid' },
  { employeeId: '1037', name: 'Farid Mohamed Yassin' },
  { employeeId: '1038', name: 'Zaid Mahmoud Ata' },
  { employeeId: '1039', name: 'Seif Elden Mohamed' },
  { employeeId: '1040', name: 'Rana Rashed Ismail' },
  { employeeId: '1042', name: 'Nermeen Essam Abdemonem' },
  { employeeId: '1044', name: 'Shourok Mohamed Rashad' },
  { employeeId: '0037', name: 'Empty' },
  { employeeId: '0042', name: 'Empty' },
  { employeeId: '1053', name: 'Hadeer Mohamed Abdelezz' },
  { employeeId: '1055', name: 'Omar Hussien Fouad' },
  { employeeId: '1056', name: 'Zeyad Mohamed Elbana' },
  { employeeId: '0045', name: 'Nihal Tolba' },
  { employeeId: '1060', name: 'Laila Salah Ashour' },
  { employeeId: '0046', name: 'Ahd Waleed' },
  { employeeId: '1063', name: 'Merna Ahmed Abdelfatah' },
  { employeeId: '1065', name: 'Youssef Mohamed Ahmed' },
  { employeeId: '1069', name: 'Salah Tarek Sayed' },
  { employeeId: '1070', name: 'Basem Mostafa Hussien' },
  { employeeId: '1072', name: 'Alaa Ashour Mahmoud' },
  { employeeId: '1073', name: 'Mohaimen Mohamed Nagib' },
  { employeeId: '0050', name: 'Empty' },
  { employeeId: '1076', name: 'Eman Ayman Abdelazim' },
  { employeeId: '0051', name: 'Empty' },
  { employeeId: '0052', name: 'Empty' },
  { employeeId: '0056', name: 'Empty' },
  { employeeId: '1121', name: 'Nada Mohamed Bayoumi' },
  { employeeId: '1126', name: 'Raneem Osama Abdelaleem' },
  { employeeId: '0057', name: 'Empty' },
  { employeeId: '1131', name: 'Dina Gamal Salem' },
  { employeeId: '1057', name: 'Khloud Amr Mohamed' },
  { employeeId: '0044', name: 'Shehab Elsayed Amin' },
  { employeeId: '1062', name: 'Amin Mohamed Amin' },
  { employeeId: '1074', name: 'Mohamed Matrawy Gaber' },
  { employeeId: '1080', name: 'Ahmed Mohamed Elkhatib' },
  { employeeId: '1077', name: 'Samir Mohamed Samir' },
  { employeeId: '1041', name: 'Samia Abdelrahman Mohmed' },
  { employeeId: '1064', name: 'Sara Abdelgwad Khalil' },
  { employeeId: '1067', name: 'John Ashraf Agib' },
  { employeeId: '1078', name: 'Gehad Sobhy Mohamed' },
  { employeeId: '1079', name: 'Nancy Salem Ahmed' },
  { employeeId: '1081', name: 'Weshah Moawya Mohamed' },
  { employeeId: '1083', name: 'Empty' },
  { employeeId: '1085', name: 'Mariam Alaa Mohamed' },
  { employeeId: '1086', name: 'Empty' },
  { employeeId: '1087', name: 'Mennat Allah Alaa Ali' },
  { employeeId: '1088', name: 'Tasneem Ahmed Abdelaziz' },
  { employeeId: '1089', name: 'Shrouk Hossam Abdelmonem' },
  { employeeId: '1093', name: 'Abdelrahman Hesham Riyad' },
  { employeeId: '1094', name: 'Waad Mohamed Ghrib' },
  { employeeId: '1095', name: 'Emad Eldin Yasser Sayed' },
  { employeeId: '1096', name: 'Habiba Essam Hashem' },
  { employeeId: '1098', name: 'Mostafa Essam Mostafa' },
  { employeeId: '1099', name: 'Empty' },
  { employeeId: '1102', name: 'Empty' },
  { employeeId: '1103', name: 'Empty' },
  { employeeId: '1104', name: 'Empty' },
  { employeeId: '1105', name: 'Empty' },
  { employeeId: '1106', name: 'Empty' },
  { employeeId: '1107', name: 'Empty' },
  { employeeId: '1108', name: 'Empty' },
  { employeeId: '1109', name: 'Empty' },
  { employeeId: '1112', name: 'Empty' },
  { employeeId: '1113', name: 'Empty' },
  { employeeId: '1114', name: 'Empty' },
  { employeeId: '1115', name: 'Empty' },
  { employeeId: '1116', name: 'Empty' },
  { employeeId: '1117', name: 'Empty' },
  { employeeId: '1118', name: 'Empty' },
  { employeeId: '1119', name: 'Empty' },
  { employeeId: '1120', name: 'Empty' },
  { employeeId: '1122', name: 'Empty' },
  { employeeId: '1123', name: 'Empty' },
  { employeeId: '1124', name: 'Empty' },
  { employeeId: '1125', name: 'Empty' },
  { employeeId: '1127', name: 'Empty' },
  { employeeId: '1128', name: 'Empty' },
  { employeeId: '1130', name: 'Empty' },
  { employeeId: '0060', name: 'Ahmed Ashraf Abdelhamid' },
  { employeeId: '0005', name: 'Omar Nasser' },
  { employeeId: '2000', name: 'Monzer Mehrez Mokhtar' },
  { employeeId: '1050', name: 'Ahd Waleed Elsayed' },
  { employeeId: '1111', name: 'Empty' },
  { employeeId: '2001', name: 'Shady Mohamed Mohamed' },
  { employeeId: '2002', name: 'Ahmed Sami Maghawry' },
  { employeeId: '2004', name: 'Mostafa Mohamed Mahmoud' },
  { employeeId: '2005', name: 'Yousef Ashraf Fatooh' },
  { employeeId: '0061', name: 'Mostafa Ahmed' },
  { employeeId: '2006', name: 'Mostafa Essam Mostafa' },
  { employeeId: '2007', name: 'Eman Fathi Abdelaziz' },
  { employeeId: '2003', name: 'Alaa Essam Abdullah' },
  { employeeId: '2008', name: 'Reem Ehab' },
  { employeeId: '2009', name: 'Mohamed Osama Abdelmawla' },
  { employeeId: '1033', name: 'Fatma Abdullah Elsayed' },
  { employeeId: '1025', name: 'Mohamed Ramzy Mansour' },
  { employeeId: '1043', name: 'Shahd Hossam Ahmed' },
  { employeeId: '1090', name: 'Mohamed Mousa Eid' },
  { employeeId: '1084', name: 'Tarek Adel Farouk' },
  { employeeId: '1051', name: 'Abanob Melad Anwer' },
  { employeeId: '1061', name: 'Ahmed Mohamed Hessin' },
  { employeeId: '1068', name: 'Zenab Hassan sobhi' },
  { employeeId: '1097', name: 'Abdelrahman Khaled Ali' },
  { employeeId: '1101', name: 'Shimaa Hussien Ahmed' },
  { employeeId: '1052', name: 'Hossam Mahmoud Mohamed' },
  { employeeId: '1100', name: 'Lamlom Mohamed Lamlom' },
  { employeeId: '1008', name: 'Moawya Abdullah Mohamed' },
  { employeeId: '1048', name: 'Youssef Alaa Mohamed' },
  { employeeId: '1091', name: 'Shreef Talat Mohamed' },
  { employeeId: '1031', name: 'Marwa Abdelrasol Selim' },
  { employeeId: '1058', name: 'Amany Mohsen Ibrahim' },
  { employeeId: '1082', name: 'Engy Ahmed Hussien' },
  { employeeId: '1129', name: 'Nourhan Mohamed Morsy' },
  { employeeId: '1004', name: 'Salah Eldin Khatab' },
  { employeeId: '0034', name: 'Hussien Gamal Elfkhrany' },
  { employeeId: '1030', name: 'Yasser Yehya Barbary' },
  { employeeId: '1027', name: 'Mohamed Mahmoud Fawzy' },
  { employeeId: '0036', name: 'Habiba Samir Mohamed' },
  { employeeId: '1035', name: 'Ahnmed Abdelatif Ahmed' },
  { employeeId: '0006', name: 'Jasy Medhat Ezzat' },
  { employeeId: '1110', name: 'Esraa Ehab Hossam' },
  { employeeId: '1034', name: 'Sondos Nabil Ibrahim' },
  { employeeId: '1011', name: 'Mahmoud Hesham Mahmoud' },
  { employeeId: '1028', name: 'Mohmaed Talat Elsayed' },
  { employeeId: '1046', name: 'Hoda Nasser Mohamed' },
  { employeeId: '1054', name: 'Mohamed Ayman Mohamed' },
  { employeeId: '1059', name: 'Ibrahim Essam Hussien' },
  { employeeId: '1066', name: 'Ahmed Mohamed Ashour' },
  { employeeId: '1032', name: 'Mohamed Ibrahim Shehata' },
  { employeeId: '1075', name: 'Mennat Allah Sayed' },
  { employeeId: '1071', name: 'Mahmoud Soliman Soliman' },
  { employeeId: '1092', name: 'Nada Fayez Mohamed' },
  { employeeId: '0011', name: 'Alaa Eldin Ahmed' },
  { employeeId: '1045', name: 'Osama Awad Mohamed' },
  { employeeId: '1047', name: 'Monzer Mehrez Mokhtar' },
  { employeeId: '1049', name: 'Mohamed Farouk Mahmoud' },
  { employeeId: '2010', name: 'name' },
  { employeeId: '2011', name: 'name' },
  { employeeId: '2012', name: 'name' },
  { employeeId: '0018', name: 'Menna Ahmed Mohammed' },
  { employeeId: '0026', name: 'Hanen Mohamed Ramadan' },
  { employeeId: '0025', name: 'Ahmed Ramadan Elsadany' },
  { employeeId: '0054', name: 'Hady Tamer Elsayed' }
];

async function addUsers() {
  try {
    // Connect to database
    await User.sequelize.authenticate();
    console.log('Connected to database');
    
    // Hash the common password
    const commonPassword = '123456';
    const hashedPassword = await bcrypt.hash(commonPassword, 12);
    
    // Process users in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < usersToAdd.length; i += batchSize) {
      const batch = usersToAdd.slice(i, i + batchSize);
      
      // Prepare users data with common password and mustChangePassword = true
      const usersData = batch.map(user => ({
        employeeId: user.employeeId,
        name: user.name,
        email: `${user.employeeId.toLowerCase()}@company.com`, // Generate email based on employeeId
        role: 'employee', // Default role for all users
        password: hashedPassword,
        mustChangePassword: true, // Force password change on first login
        isActive: true
      }));
      
      // Insert batch of users
      await User.bulkCreate(usersData, {
        updateOnDuplicate: ['name', 'email', 'role', 'password', 'mustChangePassword', 'isActive'],
        validate: true
      });
      
      console.log(`Added batch ${Math.floor(i / batchSize) + 1}: ${batch.length} users`);
    }
    
    console.log(`Successfully added ${usersToAdd.length} users to the database.`);
    console.log(`All users have initial password '123456' and must change password on first login.`);
    
    // Verify the total count
    const totalCount = await User.count();
    console.log(`Total users in database: ${totalCount}`);
    
    await User.sequelize.close();
  } catch (error) {
    console.error('Error adding users:', error.message);
    await User.sequelize.close();
  }
}

addUsers();