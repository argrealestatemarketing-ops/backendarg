"use strict";

const bcrypt = require("bcryptjs");

const RAW_AC_USERS = `
1	Sara Ali Zaki
2	Mohamed Mamdouh Mousa
3	Maryam Sayed Ahmed
4	Amgad Mohamed Elhelaly
5	Omar Nasser
6	Jasy Medhat Ezzat
7	Fouad Gamal Abdelhamid
8	Helmy Mohamed Helmy
9	Toka Ashraf Kamal
10	Salma Mahmoud Abdelmonim
11	Sama Ahmed
12	Yasmen Ahmed Fekrey
13	Hager Abdullah Ibrahim
14	Ahmed Abdelhamed Aliem
15	Menna Mohamed Bayoumi
16	Hager Mohamed Abdelatif
17	Mohamed Nabil Hassan
18	Menna Ahmed Mohammed
19	Nadeen Samir Farouk
20	Dalia Mohamed Bakr
21	Amr Shehata Ibrahim
22	Lobna Hamed Ahmed
23	Yousef Mohamed Abdelhad
24	Asmaa Mohamed
25	Ahmed Ramadan Elsadany
26	Hanen Mohamed Ramadan
27	Gana Salem
28	Ahmed Abdelsadek
29	Basmala Abdelsabor
30	Empty
31	Habiba Ahmed Mohamed
32	Mohamed Jamiu Ebrahim
33	Ahmed Arafa Abdelrahman
34	Hussien Gamal Elfkhrany
35	Rahma Ali Mohamed
36	Habiba Samir Mohamed
37	Empty
38	Nourhan Ashraf Zien
39	Mohamed Galal Ahmed
40	Beshoy Monir Adly
41	Ahmed Mohamed Ali
42	Empty
43	Abdelwhab Nasr Eldin
44	Shehab Elsayed Amin
45	Nihal Tolba
46	Ahd Waleed
47	Hager Mohamed Ibrahim
48	Maida Samir Ali
49	Kareem Megahed Badry
50	Empty
51	Empty
52	Empty
53	Mariam Tarek
54	Hady Tamer Elsayed
55	Mahmoud Elsayed Mahmoud
56	Empty
57	Empty
58	Omar Ahmed Metwaly
59	Amr Fathy Mohamed
60	Ahmed Ashraf Abdelhamid
61	Mostafa Ahmed
1001	Ahmed Ramdan Essia
1002	Ismail Ismail Ismail
1003	Abdemonem Fouad
1004	Salah Eldin Khatab
1005	Ahmed Mohsen Elsayed
1006	Ahmed Salah Abdelrazik
1007	AbedElrahman Mahmoud
1008	Moawya Abdullah Mohamed
1009	Ahmed Abdullah Ali
1010	Yousif Essam Mohamed
1011	Mahmoud Hesham Mahmoud
1012	Mohamed Salah Mohamed
1013	Amira gamal Eldin
1014	Alaa Rabie Mohamed
1015	Azima Elsallam Mohamed
1016	Mariam Hamada Saad Eldi
1017	Rahma Marzok Hesham
1018	Mohmed Abdlrahman Mohmed
1019	Omnia Eltaher Mohamed
1020	Magda Mohamed Tantawy
1021	Mahmoud Ahmed Mohamed
1022	Anwar Reda Fathy
1023	Wedad Mohamed Ezzat
1024	Mohsen Mohamed Hazem
1025	Mohamed Ramzy Mansour
1026	Abdelrhman Mohamed Fara
1027	Mohamed Mahmoud Fawzy
1028	Mohmaed Talat Elsayed
1029	Sara Mohamed Abdelaziz
1030	Yasser Yehya Barbary
1031	Marwa Abdelrasol Selim
1032	Mohamed Ibrahim Shehata
1033	Fatma Abdullah Elsayed
1034	Sondos Nabil Ibrahim
1035	Ahnmed Abdelatif Ahmed
1036	Hoda Mahmoud Abdelhamid
1037	Farid Mohamed Yassin
1038	Zaid Mahmoud Ata
1039	Seif Elden Mohamed
1040	Rana Rashed Ismail
1041	Samia Abdelrahman Mohmed
1042	Nermeen Essam Abdemonem
1043	Shahd Hossam Ahmed
1044	Shourok Mohamed Rashad
1045	Osama Awad Mohamed
1046	Hoda Nasser Mohamed
1047	Monzer Mehrez Mokhtar
1048	Youssef Alaa Mohamed
1049	Mohamed Farouk Mahmoud
1050	Ahd Waleed Elsayed
1051	Abanob Melad Anwer
1052	Hossam Mahmoud Mohamed
1053	Hadeer Mohamed Abdelezz
1054	Mohamed Ayman Mohamed
1055	Omar Hussien Fouad
1056	Zeyad Mohamed Elbana
1057	Khloud Amr Mohamed
1058	Amany Mohsen Ibrahim
1059	Ibrahim Essam Hussien
1060	Laila Salah Ashour
1061	Ahmed Mohamed Hessin
1062	Amin Mohamed Amin
1063	Merna Ahmed Abdelfatah
1064	Sara Abdelgwad Khalil
1065	Youssef Mohamed Ahmed
1066	Ahmed Mohamed Ashour
1067	John Ashraf Agib
1068	Zenab Hassan sobhi
1069	Salah Tarek Sayed
1070	Basem Mostafa Hussien
1071	Mahmoud Soliman Soliman
1072	Alaa Ashour Mahmoud
1073	Mohaimen Mohamed Nagib
1074	Mohamed Matrawy Gaber
1075	Mennat Allah Sayed
1076	Eman Ayman Abdelazim
1077	Samir Mohamed Samir
1078	Gehad Sobhy Mohamed
1079	Nancy Salem Ahmed
1080	Ahmed Mohamed Elkhatib
1081	Weshah Moawya Mohamed
1082	Engy Ahmed Hussien
1083	Empty
1084	Tarek Adel Farouk
1085	Mariam Alaa Mohamed
1086	Empty
1087	Mennat Allah Alaa Ali
1088	Tasneem Ahmed Abdelaziz
1089	Shrouk Hossam Abdelmonem
1090	Mohamed Mousa Eid
1091	Shreef Talat Mohamed
1092	Nada Fayez Mohamed
1093	Abdelrahman Hesham Riyad
1094	Waad Mohamed Ghrib
1095	Emad Eldin Yasser Sayed
1096	Habiba Essam Hashem
1097	Abdelrahman Khaled Ali
1098	Mostafa Essam Mostafa
1099	Empty
1100	Lamlom Mohamed Lamlom
1101	Shimaa Hussien Ahmed
1102	Empty
1103	Empty
1104	Empty
1105	Empty
1106	Empty
1107	Empty
1108	Empty
1109	Hoda Ibrahim
1110	Esraa Ehab Hossam
1111	Empty
1112	Empty
1113	Empty
1114	Empty
1115	Empty
1116	Empty
1117	Empty
1118	Empty
1119	Empty
1120	Empty
1121	Nada Mohamed Bayoumi
1122	Empty
1123	Empty
1124	Empty
1125	Empty
1126	Raneem Osama Abdelaleem
1127	Rezk Mahmoud Rezk
1128	Mohamed Magdy Abdelmonem
1129	Nourhan Mohamed Morsy
1130	Empty
1131	Dina Gamal Salem
2000	Monzer Mehrez Mokhtar
2001	Shady  Mohamed Mohamed
2002	Ahmed Sami Maghawry
2003	Alaa Essam Abdullah
2004	Mostafa Mohamed Mahmoud
2005	Yousef Ashraf Fatooh
2006	Mostafa Essam Mostafa
2007	Eman Fathi Abdelaziz
2008	Reem Ehab
2009	Mohamed Osama Abdelmawla
2010	Fatma Gamal Abdo
2011	Aya Hamed
2012	Sohila Ahmed Wagdy
2013	Rahma Sameh
2014	Omar Saeed
2015	Ziad Mohamed Rashad
2016	Hassan Ahmed
2017	Rahma Saeed
2018	2018
`.trim();

function parseUsers(rawUsers) {
  return rawUsers
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [employeeIdRaw, ...nameParts] = line.split(/\t+/);
      const employeeId = (employeeIdRaw || "").trim();
      const name = nameParts.join(" ").trim().replace(/\s+/g, " ");

      if (!/^\d+$/.test(employeeId)) return null;
      if (!name || name.toLowerCase() === "empty") return null;

      return { employeeId, name };
    })
    .filter(Boolean);
}

const AC_USERS = parseUsers(RAW_AC_USERS);

module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash("123456", 12);
    const now = new Date();

    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const user of AC_USERS) {
        await queryInterface.sequelize.query(
          `
            INSERT INTO users (
              employee_id,
              name,
              email,
              role,
              password,
              must_change_password,
              token_version,
              failed_login_attempts,
              status,
              created_at,
              updated_at
            )
            VALUES (
              :employeeId,
              :name,
              NULL,
              'employee',
              :passwordHash,
              false,
              0,
              0,
              'active',
              :now,
              :now
            )
            ON CONFLICT (employee_id)
            DO UPDATE SET
              name = EXCLUDED.name,
              role = EXCLUDED.role,
              password = EXCLUDED.password,
              must_change_password = EXCLUDED.must_change_password,
              token_version = EXCLUDED.token_version,
              failed_login_attempts = EXCLUDED.failed_login_attempts,
              status = EXCLUDED.status,
              updated_at = EXCLUDED.updated_at;
          `,
          {
            transaction,
            replacements: {
              employeeId: user.employeeId,
              name: user.name,
              passwordHash,
              now
            }
          }
        );
      }
    });
  },

  async down() {
    return Promise.resolve();
  }
};

