const bcrypt = require('bcryptjs');
const { sequelize, User, LeaveBalance } = require('../src/models');
const { auditLogger } = require('../src/utils/logger');
const crypto = require('crypto');

const generateSecurePassword = () => {
  return crypto.randomBytes(12).toString('hex');
};

const employees = [
  { employeeId: 'EMP001', name: 'Sara Ali Zaki', role: 'employee' },
  { employeeId: 'EMP002', name: 'Mohamed Mamdouh Mousa', role: 'employee' },
  { employeeId: 'EMP003', name: 'Maryam Sayed Ahmed', role: 'employee' },
  { employeeId: 'EMP004', name: 'Amgad Mohamed Elhelaly', role: 'employee' },
  { employeeId: 'EMP005', name: 'Omar Nasser', role: 'employee' },
  { employeeId: 'HR001', name: 'HR Manager', role: 'hr' },
  { employeeId: 'HR002', name: 'HR Assistant', role: 'hr' },
  { employeeId: 'ADMIN001', name: 'System Admin', role: 'admin' }
];

async function upsertEmployees() {
  const transaction = await sequelize.transaction();
  
  try {
    await sequelize.authenticate();
    auditLogger.info('Starting employee seed process', { 
      timestamp: new Date().toISOString(),
      employeeCount: employees.length 
    });

    for (const e of employees) {
      const tempPassword = generateSecurePassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      
      const [user, created] = await User.findOrCreate({
        where: { employeeId: e.employeeId },
        defaults: {
          name: e.name,
          email: `${e.employeeId.toLowerCase()}@company.com`,
          role: e.role,
          password: passwordHash,
          mustChangePassword: true,
          tokenVersion: 0,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: null,
          isActive: true
        },
        transaction
      });

      if (created) {
        auditLogger.info('Created new user', {
          employeeId: e.employeeId,
          role: e.role,
          hasTempPassword: true
        });
        
        console.log(`🔐 User ${e.employeeId} created with temporary password: ${tempPassword}`);
        console.log(`⚠️  IMPORTANT: User must change password on first login!`);
      } else {
        await user.update({
          role: e.role,
          isActive: true,
          ...(user.password ? {} : { password: passwordHash, mustChangePassword: true })
        }, { transaction });
        
        console.log(`📝 Updated user ${e.employeeId}`);
      }

      const year = new Date().getFullYear();
      const [lb, lbCreated] = await LeaveBalance.findOrCreate({
        where: { employeeId: e.employeeId, year },
        defaults: { 
          totalDays: e.role === 'hr' ? 25 : 20,
          usedDays: 0, 
          remainingDays: e.role === 'hr' ? 25 : 20,
          year
        },
        transaction
      });
      
      if (lbCreated) {
        console.log(`✅ Created leave balance for ${e.employeeId} (${year})`);
      }
    }

    await transaction.commit();
    
    auditLogger.info('Employee seed completed successfully', {
      timestamp: new Date().toISOString(),
      totalProcessed: employees.length
    });
    
    console.log('\n========================================');
    console.log('✅ SEEDING COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log('\n🔐 SECURITY NOTES:');
    console.log('- Each user has a unique random password');
    console.log('- Users must change password on first login');
    console.log('- Passwords are hashed with bcrypt (12 rounds)');
    console.log('- HR users get 25 leave days (employees get 20)');
    console.log('========================================\n');
    
  } catch (error) {
    await transaction.rollback();
    
    auditLogger.error('Employee seed failed', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    console.error('❌ SEEDING FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

module.exports = { upsertEmployees, generateSecurePassword };

if (require.main === module) {
  upsertEmployees();
}