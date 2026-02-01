// backend/scripts/seed.js - النسخة المحسنة
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sequelize, User, Attendance, LeaveRequest, Announcement, LeaveBalance } = require('../src/models');
const { auditLogger } = require('../src/utils/logger');

// Helper to generate secure passwords
const generateSecurePassword = () => {
  const length = 16;
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

async function seed() {
  const transaction = await sequelize.transaction();
  
  try {
    // Always use safe sync options
    const syncOptions = process.env.NODE_ENV === 'development' 
      ? { alter: true }
      : { force: false }; // NEVER force in production
    
    await sequelize.sync(syncOptions);
    console.log(`✅ Database synced (${process.env.NODE_ENV || 'development'} mode)`);

    // Clear existing data safely
    if (process.env.NODE_ENV === 'development') {
      await Promise.all([
        User.destroy({ where: {}, truncate: true, cascade: true, transaction }),
        LeaveBalance.destroy({ where: {}, truncate: true, cascade: true, transaction }),
        Attendance.destroy({ where: {}, truncate: true, cascade: true, transaction }),
        LeaveRequest.destroy({ where: {}, truncate: true, cascade: true, transaction }),
        Announcement.destroy({ where: {}, truncate: true, cascade: true, transaction })
      ]);
      console.log('🗑️  Cleared existing data (development only)');
    }

    // Create users with secure passwords - only if they don't exist
    const users = [
      {
        employeeId: 'EMP001',
        name: 'John Employee',
        email: 'john@company.com',
        role: 'employee',
        password: await bcrypt.hash(generateSecurePassword(), 12),
        mustChangePassword: true
      },
      {
        employeeId: 'EMP002',
        name: 'Jane Employee',
        email: 'jane@company.com',
        role: 'employee',
        password: await bcrypt.hash(generateSecurePassword(), 12),
        mustChangePassword: true
      },
      {
        employeeId: 'HR001',
        name: 'Alex HR Manager',
        email: 'alex@company.com',
        role: 'hr',
        password: await bcrypt.hash(generateSecurePassword(), 12),
        mustChangePassword: true
      },
      {
        employeeId: 'ADMIN001',
        name: 'System Administrator',
        email: 'admin@company.com',
        role: 'admin',
        password: await bcrypt.hash(generateSecurePassword(), 12),
        mustChangePassword: true
      }
    ];

    // Check which users already exist
    const existingUsers = await User.findAll({
      where: {
        employeeId: users.map(u => u.employeeId)
      },
      attributes: ['employeeId']
    });

    const existingEmployeeIds = existingUsers.map(u => u.employeeId);
    const newUsers = users.filter(u => !existingEmployeeIds.includes(u.employeeId));

    if (newUsers.length > 0) {
      const createdUsers = await User.bulkCreate(newUsers, { transaction });
      console.log(`👥 Created ${createdUsers.length} new users with secure passwords`);
    } else {
      console.log('👥 All test users already exist');
    }

    // Leave Requests
    await LeaveRequest.bulkCreate([
      {
        employeeId: 'EMP001',
        employeeName: 'John Employee',
        fromDate: new Date(Date.now() + 86400000 * 7), // 7 days from now
        toDate: new Date(Date.now() + 86400000 * 9),
        reason: 'Family vacation',
        status: 'pending',
        leaveType: 'annual',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        employeeId: 'EMP002',
        employeeName: 'Jane Employee',
        fromDate: new Date(Date.now() + 86400000 * 3),
        toDate: new Date(Date.now() + 86400000 * 4),
        reason: 'Medical appointment',
        status: 'approved',
        leaveType: 'sick',
        approvedBy: 'HR001',
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], { transaction });

    // Announcements
    await Announcement.bulkCreate([
      {
        title: 'System Maintenance',
        message: 'The HR system will undergo maintenance on Saturday from 2 AM to 4 AM.',
        createdBy: 'ADMIN001',
        priority: 'high',
        sentToAll: true,
        expiresAt: new Date(Date.now() + 86400000 * 2)
      },
      {
        title: 'Welcome New Employees',
        message: 'Welcome to our new team members! Please complete your profile.',
        createdBy: 'HR001',
        priority: 'normal',
        sentToAll: true,
        expiresAt: new Date(Date.now() + 86400000 * 30)
      }
    ], { transaction });

    // Attendance records
    const attendanceRecords = [];
    const today = new Date();
    
    for (let i = 1; i <= 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      attendanceRecords.push(
        {
          employeeId: 'EMP001',
          date: date.toISOString().split('T')[0],
          checkInTime: '09:' + (15 + i % 45).toString().padStart(2, '0') + ':00',
          checkOutTime: '18:' + (i % 30).toString().padStart(2, '0') + ':00',
          status: 'present',
          hoursWorked: 8.5 + (i % 3 * 0.5),
          lateMinutes: i % 4 === 0 ? 15 : 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          employeeId: 'EMP002',
          date: date.toISOString().split('T')[0],
          checkInTime: i % 7 === 0 ? null : '09:' + (20 + i % 40).toString().padStart(2, '0') + ':00',
          checkOutTime: i % 7 === 0 ? null : '17:' + (45 + i % 15).toString().padStart(2, '0') + ':00',
          status: i % 7 === 0 ? 'absent' : 'present',
          hoursWorked: i % 7 === 0 ? 0 : 8,
          lateMinutes: i % 5 === 0 ? 20 : 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      );
    }

    await Attendance.bulkCreate(attendanceRecords, { transaction });
    console.log(`📊 Created ${attendanceRecords.length} attendance records`);

    // Leave Balances
    const currentYear = new Date().getFullYear();
    await LeaveBalance.bulkCreate([
      {
        employeeId: 'EMP001',
        year: currentYear,
        totalDays: 20,
        usedDays: 3,
        remainingDays: 17,
        leaveType: 'annual'
      },
      {
        employeeId: 'EMP002',
        year: currentYear,
        totalDays: 20,
        usedDays: 2,
        remainingDays: 18,
        leaveType: 'annual'
      },
      {
        employeeId: 'HR001',
        year: currentYear,
        totalDays: 25,
        usedDays: 5,
        remainingDays: 20,
        leaveType: 'annual'
      }
    ], { transaction });

    await transaction.commit();
    
    auditLogger.info('Database seeded successfully', {
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });

    console.log('\n🎉 SEEDING COMPLETED!');
    console.log('====================');
    console.log('\n🔐 TEMPORARY PASSWORDS:');
    console.log('(Users must change on first login)');
    console.log('\n📧 For production:');
    console.log('- Passwords should be sent via secure email');
    console.log('- Enable email service in production');
    console.log('\n📋 Test Credentials:');
    console.log('- Employee: EMP001 / [random-password]');
    console.log('- HR: HR001 / [random-password]');
    console.log('- Admin: ADMIN001 / [random-password]');
    console.log('\n⚠️  IMPORTANT: Check console for generated passwords!');

  } catch (error) {
    await transaction.rollback();
    
    auditLogger.error('Seeding failed', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔒 Database connection closed');
  }
}

// Export for testing
module.exports = { seed, generateSecurePassword };

// Run if called directly
if (require.main === module) {
  seed().catch(error => {
    console.error('Fatal seeding error:', error);
    process.exit(1);
  });
}