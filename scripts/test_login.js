const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../src/config/config');
const { sequelize, User } = require('../src/models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected for login test');
    const user = await User.findOne({ where: { employeeId: 'EMP001' } });
    console.log('User fetch result:', !!user, user && { id: user.id, employeeId: user.employeeId, email: user.email });
    const isPasswordValid = await bcrypt.compare('123456', user.password);
    console.log('Password valid:', isPasswordValid);
    const token = jwt.sign({ id: user.id, employeeId: user.employeeId }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE });
    console.log('Generated token:', token);
    const decoded = jwt.decode(token);
    console.log('Decoded token:', decoded);
    process.exit(0);
  } catch (e) {
    console.error('Login test error:', e);
    process.exit(1);
  }
})();