'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add auth/security related columns to users if they don't exist
    const tableInfo = await queryInterface.describeTable('users').catch(() => null);
    if (tableInfo) {
      if (!tableInfo['must_change_password']) {
        await queryInterface.addColumn('users', 'must_change_password', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        });
      }

      if (!tableInfo['password_changed_at']) {
        await queryInterface.addColumn('users', 'password_changed_at', {
          type: Sequelize.DATE,
          allowNull: true
        });
      }

      if (!tableInfo['token_version']) {
        await queryInterface.addColumn('users', 'token_version', {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        });
      }

      if (!tableInfo['failed_login_attempts']) {
        await queryInterface.addColumn('users', 'failed_login_attempts', {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        });
      }

      if (!tableInfo['locked_until']) {
        await queryInterface.addColumn('users', 'locked_until', {
          type: Sequelize.DATE,
          allowNull: true
        });
      }
    }

    // Create audit_logs table if not exists
    const auditTable = await queryInterface.describeTable('audit_logs').catch(() => null);
    if (!auditTable) {
      await queryInterface.createTable('audit_logs', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        actor_id: { type: Sequelize.INTEGER, allowNull: true },
        actor_employee_id: { type: Sequelize.STRING, allowNull: true },
        target_employee_id: { type: Sequelize.STRING, allowNull: true },
        action: { type: Sequelize.STRING, allowNull: false },
        details: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      });
    }
  },

  async down(queryInterface) {
    // Reverse: drop audit_logs and remove columns if they exist
    const auditTable = await queryInterface.describeTable('audit_logs').catch(() => null);
    if (auditTable) await queryInterface.dropTable('audit_logs');

    const tableInfo = await queryInterface.describeTable('users').catch(() => null);
    if (tableInfo) {
      if (tableInfo['locked_until']) await queryInterface.removeColumn('users', 'locked_until');
      if (tableInfo['failed_login_attempts']) await queryInterface.removeColumn('users', 'failed_login_attempts');
      if (tableInfo['token_version']) await queryInterface.removeColumn('users', 'token_version');
      if (tableInfo['password_changed_at']) await queryInterface.removeColumn('users', 'password_changed_at');
      if (tableInfo['must_change_password']) await queryInterface.removeColumn('users', 'must_change_password');
    }
  }
};