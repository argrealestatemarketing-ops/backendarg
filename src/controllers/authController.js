const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const config = require("../config/config");
const User = require("../models/mongo/User");
const LoginAttempt = require("../models/mongo/LoginAttempt");
const AuditLog = require("../models/mongo/AuditLog");
// Sequelize operators not needed for MongoDB - removing this line
const { auditLogger } = require("../utils/logger");
const PasswordUtils = require("../utils/passwordUtils");

class AuthController {
  constructor() {
    this.maxLoginAttempts = config.PASSWORD_MAX_ATTEMPTS || 5;
    this.lockoutMinutes = config.ACCOUNT_LOCKOUT_MINUTES || 15;
    this.loginRateLimitWindow = 15 * 60 * 1000; // 15 minutes
    this.loginRateLimitMax = 5; // Max 5 attempts per window
  }

  /**
   * التحقق من محاولات تسجيل الدخول المفرطة
   */
  async checkRateLimit(ipAddress, employeeId) {
    const windowStart = new Date(Date.now() - this.loginRateLimitWindow);
    
    const attempts = await LoginAttempt.countDocuments({
      ipAddress,
      createdAt: { $gte: windowStart }
    });

    return attempts >= this.loginRateLimitMax;
  }

  /**
   * تسجيل محاولة تسجيل دخول
   */
  async recordLoginAttempt(ipAddress, employeeId, success) {
    await LoginAttempt.create({
      ipAddress,
      employeeId,
      success,
      userAgent: "unknown", // يمكن إضافة من الـ request
      createdAt: new Date()
    });

    // تنظيف السجلات القديمة
    const cleanupDate = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 ساعة
    await LoginAttempt.deleteMany({
      createdAt: { $lt: cleanupDate }
    });
  }

  /**
   * تسجيل دخول المستخدم
   */
  async login(req, res) {
    const { employeeId, password } = req.body;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const startTime = Date.now();

    try {
      // 🔒 التحقق من صحة المدخلات
      if (!employeeId || !password) {
        auditLogger.warn("Login attempt with missing credentials", {
          ipAddress,
          employeeId: employeeId || "missing",
          timestamp: new Date().toISOString()
        });
        
        return res.status(400).json({
          success: false,
          error: "Employee ID and password are required"
        });
      }

      // 🔒 التحقق من التنسيق
      const cleanEmployeeId = employeeId.toString().trim();
      // Allow plain integers (1, 2, 3, ...) or alphanumeric IDs
      if (!/^[A-Za-z0-9]{1,20}$/.test(cleanEmployeeId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid employee ID format"
        });
      }

      // 🔒 التحقق من Rate Limiting
      const isRateLimited = await this.checkRateLimit(ipAddress, cleanEmployeeId);
      if (isRateLimited) {
        auditLogger.warn("Rate limited login attempt", {
          ipAddress,
          employeeId: cleanEmployeeId,
          timestamp: new Date().toISOString()
        });
        
        return res.status(429).json({
          success: false,
          error: "Too many login attempts. Please try again later."
        });
      }

      // 🔍 البحث عن المستخدم
      const user = await User.findOne({
        employeeId: cleanEmployeeId
      });

      console.log('[LOGIN_DEBUG] User lookup result:', {
        employeeId: cleanEmployeeId,
        userFound: !!user,
        userId: user?.id,
        storedTokenVersion: user?.tokenVersion,
        storedStatus: user?.status,
        lockedUntil: user?.lockedUntil,
        failedAttempts: user?.failedLoginAttempts
      });

      // 🔒 منع تعداد المستخدمين - استخدام نفس الرسالة للخطأ
      if (!user) {
        await this.recordLoginAttempt(ipAddress, cleanEmployeeId, false);
        
        // تأخير وهمي لمنع التوقيت timing attacks
        await bcrypt.compare(password, "$2a$12$dummyHashForTimingAttackPrevention");
        
        auditLogger.warn("Login attempt for non-existent user", {
          ipAddress,
          employeeId: cleanEmployeeId,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Password incorrect",
          code: 'USER_NOT_FOUND'
        });
      }

      // 🔒 التحقق من حالة الحساب
      const status = user.status || 'active'; // Default to active if field doesn't exist
      if (status !== 'active') {
        auditLogger.warn("Login attempt for inactive account", {
          ipAddress,
          employeeId: cleanEmployeeId,
          userId: user.id,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Account is inactive",
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // 🔒 التحقق من قفل الحساب
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingMinutes = Math.ceil((user.lockedUntil - new Date()) / (60 * 1000));
        
        auditLogger.warn("Login attempt for locked account", {
          ipAddress,
          employeeId: cleanEmployeeId,
          userId: user.id,
          lockedUntil: user.lockedUntil,
          remainingMinutes,
          timestamp: new Date().toISOString()
        });
        
        return res.status(423).json({
          success: false,
          error: `Account is locked. Try again in ${remainingMinutes} minutes.`,
          code: 'ACCOUNT_LOCKED',
          lockedUntil: user.lockedUntil
        });
      }

      // 🔐 التحقق من كلمة المرور
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      console.log('[LOGIN_DEBUG] Password validation result:', {
        passwordValid: isPasswordValid,
        employeeId: cleanEmployeeId
      });
      
      if (!isPasswordValid) {
        // زيادة عدد المحاولات الفاشلة
        const newAttempts = (user.failedLoginAttempts || 0) + 1;
        const updates = { failedLoginAttempts: newAttempts };
        
        if (newAttempts >= this.maxLoginAttempts) {
          updates.lockedUntil = new Date(Date.now() + (this.lockoutMinutes * 60 * 1000));
          
          auditLogger.warn("Account locked due to failed attempts", {
            ipAddress,
            employeeId: cleanEmployeeId,
            userId: user._id,
            failedAttempts: newAttempts,
            lockedUntil: updates.lockedUntil,
            timestamp: new Date().toISOString()
          });
        }
        
        await User.findByIdAndUpdate(user._id, updates);
        await this.recordLoginAttempt(ipAddress, cleanEmployeeId, false);
        
        auditLogger.warn("Failed login attempt", {
          ipAddress,
          employeeId: cleanEmployeeId,
          userId: user.id,
          failedAttempts: newAttempts,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Password incorrect",
          remainingAttempts: this.maxLoginAttempts - newAttempts
        });
      }

      // ✅ تسجيل الدخول الناجح
      // إعادة تعيين محاولات الدخول الفاشلة
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        await User.findByIdAndUpdate(user._id, {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date()
        });
      } else {
        await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
      }

      await this.recordLoginAttempt(ipAddress, cleanEmployeeId, true);

      // 🔐 إنشاء Tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // 💾 حفظ Refresh Token (في قاعدة البيانات أو Redis)
      await this.storeRefreshToken(user.id, refreshToken);

      // 📝 تسجيل الحدث
      const responseTime = Date.now() - startTime;
      
      auditLogger.info("Successful login", {
        ipAddress,
        employeeId: cleanEmployeeId,
        userId: user.id,
        role: user.role,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      // 📦 إعداد بيانات الاستجابة
      const userData = {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        status: user.status || 'active',
        tokenVersion: user.tokenVersion || 0,
        lastLoginAt: user.lastLoginAt
      };
      
      console.log('[LOGIN_DEBUG] Successful login for user:', {
        employeeId: user.employeeId,
        userId: user.id,
        tokenVersion: user.tokenVersion,
        mustChangePassword: user.mustChangePassword
      });

      // If user must change password, return special response
      if (user.mustChangePassword) {
        return res.status(200).json({
          success: true,
          message: "Password change required",
          user: userData,
          accessToken,
          refreshToken,
          mustChangePassword: true,
          session: {
            expiresIn: config.JWT_ACCESS_EXPIRE,
            refreshExpiresIn: config.JWT_REFRESH_EXPIRE
          },
          debug: {
            timestamp: new Date().toISOString(),
            tokenVersion: user.tokenVersion
          }
        });
      }

      res.status(200).json({
        success: true,
        message: "Login successful",
        user: userData,
        accessToken,
        refreshToken,
        session: {
          expiresIn: config.JWT_ACCESS_EXPIRE,
          refreshExpiresIn: config.JWT_REFRESH_EXPIRE
        },
        debug: {
          timestamp: new Date().toISOString(),
          tokenVersion: user.tokenVersion
        }
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      auditLogger.error("Login process error", {
        ipAddress,
        employeeId: employeeId || "unknown",
        error: error.message,
        stack: error.stack,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: "Login failed. Please try again."
      });
    }
  }

  /**
   * إنشاء Access Token
   */
  generateAccessToken(user) {
    const payload = {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion || 0,
      type: "access"
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_ACCESS_EXPIRE,
      algorithm: config.JWT_ALGORITHM
    });
  }

  /**
   * إنشاء Refresh Token
   */
  generateRefreshToken(user) {
    const payload = {
      id: user.id,
      employeeId: user.employeeId,
      type: "refresh",
      tokenVersion: user.tokenVersion || 0
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRE,
      algorithm: config.JWT_ALGORITHM
    });
  }

  /**
   * حفظ Refresh Token
   */
  async storeRefreshToken(userId, refreshToken) {
    // هنا يمكن حفظ الـ token في قاعدة البيانات أو Redis
    // مع تاريخ انتهاء الصلاحية وإمكانية إبطاله
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 أيام
    
    // مثال لحفظ في جدول مخصص
    // await RefreshToken.create({
    //   userId,
    //   token: refreshToken,
    //   expiresAt,
    //   isValid: true
    // });
  }

  /**
   * تعيين الـ cookies
   */
  setAuthCookies(res, accessToken, refreshToken) {
    const isProduction = config.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      path: "/"
    };

    res.cookie("access_token", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 دقيقة
    });

    res.cookie("refresh_token", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 أيام
    });
  }

  /**
   * تغيير كلمة المرور
   */
  async changePassword(req, res) {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;
    const startTime = Date.now();

    // البحث عن المستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // إذا كان يجب تغيير كلمة المرور (أول دخول أو إعادة تعيين)، يكفي إرسال كلمة مرور جديدة فقط
    if (user.mustChangePassword) {
      if (!newPassword) {
        return res.status(400).json({
          success: false,
          error: "New password is required"
        });
      }
      // التحقق من قوة كلمة المرور الجديدة
      const passwordValidation = PasswordUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Weak password",
          details: passwordValidation.errors
        });
      }
      // تشفير كلمة المرور الجديدة
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await User.findByIdAndUpdate(user._id, {
        password: hashedPassword,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: (user.tokenVersion || 0) + 1,
        failedLoginAttempts: 0,
        lockedUntil: null
      });
      // تسجيل الحدث
      auditLogger.info("Password changed successfully (mustChangePassword)", {
        userId,
        employeeId: user.employeeId,
        changedBy: "self",
        timestamp: new Date().toISOString()
      });
      await AuditLog.create({
        actorId: userId,
        actorEmployeeId: user.employeeId,
        targetEmployeeId: user.employeeId,
        action: "password_change",
        details: { method: "self_service" },
        createdAt: new Date()
      });
      // تحديث المستخدم بعد التغيير
      const updatedUser = await User.findById(user._id);

      // إنشاء Access Token جديد بعد تغيير كلمة المرور
      const newAccessToken = this.generateAccessToken({
        id: updatedUser.id,
        employeeId: updatedUser.employeeId,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        mustChangePassword: false, // تم تغيير الحالة إلى false
        tokenVersion: (updatedUser.tokenVersion || 0) + 1
      });

      // إنشاء Refresh Token جديد
      const newRefreshToken = this.generateRefreshToken(updatedUser);

      // حفظ Refresh Token جديد
      await this.storeRefreshToken(updatedUser.id, newRefreshToken);

      await this.invalidateOldSessions(userId);
      
      // إعداد بيانات المستخدم كما في عملية تسجيل الدخول
      const userData = {
        id: updatedUser.id,
        employeeId: updatedUser.employeeId,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        mustChangePassword: false, // تم تغيير الحالة إلى false
        status: updatedUser.status || 'active',
        tokenVersion: (updatedUser.tokenVersion || 0) + 1,
        lastLoginAt: updatedUser.lastLoginAt
      };

      const responseTime = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        message: "Password changed successfully",
        user: userData,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        nextSteps: "Password changed successfully. You can continue using the app."
      });
    }

    try {
      // التحقق من صحة المدخلات
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "All password fields are required"
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "New passwords do not match"
        });
      }

      // التحقق من قوة كلمة المرور الجديدة
      const passwordValidation = PasswordUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Weak password",
          details: passwordValidation.errors
        });
      }

      // التحقق من كلمة المرور الحالية
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        auditLogger.warn("Failed password change - wrong current password", {
          userId,
          employeeId: user.employeeId,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Current password is incorrect"
        });
      }

      // منع إعادة استخدام كلمة المرور القديمة
      const isSameAsOld = await bcrypt.compare(newPassword, user.password);
      if (isSameAsOld) {
        return res.status(400).json({
          success: false,
          error: "New password must be different from current password"
        });
      }

      // تشفير كلمة المرور الجديدة
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      // تحديث بيانات المستخدم
      await User.findByIdAndUpdate(user._id, {
        password: hashedPassword,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: (user.tokenVersion || 0) + 1,
        failedLoginAttempts: 0,
        lockedUntil: null
      });

      // تحديث المستخدم بعد التغيير
      const updatedUser = await User.findById(user._id);

      // إنشاء Access Token جديد بعد تغيير كلمة المرور
      const newAccessToken = this.generateAccessToken({
        id: updatedUser.id,
        employeeId: updatedUser.employeeId,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        mustChangePassword: false, // تم تغييرها لـ false
        tokenVersion: (updatedUser.tokenVersion || 0) + 1
      });

      // إنشاء Refresh Token جديد
      const newRefreshToken = this.generateRefreshToken(updatedUser);

      // حفظ Refresh Token جديد
      await this.storeRefreshToken(updatedUser.id, newRefreshToken);

      // تسجيل الحدث
      auditLogger.info("Password changed successfully", {
        userId,
        employeeId: updatedUser.employeeId,
        changedBy: "self",
        timestamp: new Date().toISOString()
      });

      // إنشاء Audit Log
      await AuditLog.create({
        actorId: userId,
        actorEmployeeId: updatedUser.employeeId,
        targetEmployeeId: updatedUser.employeeId,
        action: "password_change",
        details: { method: "self_service" },
        createdAt: new Date()
      });

      // إبطال جميع الجلسات القديمة
      await this.invalidateOldSessions(userId);

      const responseTime = Date.now() - startTime;

      // إعداد بيانات المستخدم كما في عملية تسجيل الدخول
      const userData = {
        id: updatedUser.id,
        employeeId: updatedUser.employeeId,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        mustChangePassword: false, // تم تغيير الحالة إلى false
        status: updatedUser.status || 'active',
        tokenVersion: (updatedUser.tokenVersion || 0) + 1,
        lastLoginAt: updatedUser.lastLoginAt
      };
      
      res.status(200).json({
        success: true,
        message: "Password changed successfully",
        user: userData,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        nextSteps: "Password changed successfully. You can continue using the app."
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      auditLogger.error("Password change failed", {
        userId,
        error: error.message,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: "Failed to change password"
      });
    }
  }

  /**
   * إعادة تعيين كلمة المرور (للمديرين)
   */
  async resetPassword(req, res) {
    const { employeeId, newPassword, sendEmail } = req.body;
    const adminId = req.user.id;
    const startTime = Date.now();

    try {
      // التحقق من الصلاحيات
      if (!["hr", "admin"].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions"
        });
      }

      // التحقق من المدخلات
      if (!employeeId || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "Employee ID and new password are required"
        });
      }

      // البحث عن المستخدم المستهدف
      const targetUser = await User.findOne({
        employeeId: employeeId.toUpperCase()
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: "User not found"
        });
      }

      // التحقق من قوة كلمة المرور
      const passwordValidation = PasswordUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Weak password",
          details: passwordValidation.errors
        });
      }

      // إنشاء كلمة مرور مؤقتة آمنة
      const tempPassword = PasswordUtils.generateSecurePassword(12);
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      // تحديث بيانات المستخدم
      await User.findByIdAndUpdate(targetUser._id, {
        password: hashedPassword,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
        tokenVersion: (targetUser.tokenVersion || 0) + 1,
        failedLoginAttempts: 0,
        lockedUntil: null
      });

      // تسجيل الحدث
      auditLogger.info("Password reset by admin", {
        adminId,
        adminEmployeeId: req.user.employeeId,
        targetUserId: targetUser.id,
        targetEmployeeId: targetUser.employeeId,
        timestamp: new Date().toISOString()
      });

      // إنشاء Audit Log
      await AuditLog.create({
        actorId: adminId,
        actorEmployeeId: req.user.employeeId,
        targetEmployeeId: targetUser.employeeId,
        action: "password_reset",
        details: {
          resetBy: "admin",
          adminRole: req.user.role,
          sendEmail: !!sendEmail
        },
        createdAt: new Date()
      });

      // إرسال البريد الإلكتروني (إذا كان مفعلاً)
      if (sendEmail && targetUser.email) {
        await this.sendPasswordResetEmail(targetUser, tempPassword);
      }

      const responseTime = Date.now() - startTime;
      const responseData = {
        success: true,
        message: "Password reset successfully",
        employeeId: targetUser.employeeId,
        name: targetUser.name,
        mustChangePassword: true,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`
      };

      // إرجاع كلمة المرور المؤقتة فقط في وضع التطوير
      if (config.NODE_ENV === "development") {
        responseData.tempPassword = tempPassword;
        responseData.warning = "Temporary password shown for development only";
      }

      res.status(200).json(responseData);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      auditLogger.error("Password reset failed", {
        adminId,
        adminEmployeeId: req.user.employeeId,
        error: error.message,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: "Failed to reset password"
      });
    }
  }

  /**
   * تحديث Access Token باستخدام Refresh Token
   */
  async refreshToken(req, res) {
    const refreshToken = req.cookies.refresh_token || req.body.refreshToken;
    const startTime = Date.now();

    try {
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: "Refresh token required"
        });
      }

      // التحقق من صحة Refresh Token
      const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
      
      if (decoded.type !== "refresh") {
        return res.status(401).json({
          success: false,
          error: "Invalid token type"
        });
      }

      // البحث عن المستخدم
      const user = await User.findById(decoded.id);
      const status = user && user.status ? user.status : 'active'; // Default to active if field doesn't exist
      if (!user || status !== 'active') {
        return res.status(401).json({
          success: false,
          error: "User not found or inactive"
        });
      }

      // التحقق من إصدار الـ Token
      if (decoded.tokenVersion !== (user.tokenVersion || 0)) {
        return res.status(401).json({
          success: false,
          error: "Token invalid (version mismatch)"
        });
      }

      // إنشاء Access Token جديد
      const newAccessToken = this.generateAccessToken(user);
      
      // تحديث الـ Cookie
      this.setAuthCookies(res, newAccessToken, refreshToken);

      const responseTime = Date.now() - startTime;
      
      auditLogger.info("Token refreshed", {
        userId: user.id,
        employeeId: user.employeeId,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        message: "Token refreshed",
        accessToken: newAccessToken,
        expiresIn: config.JWT_ACCESS_EXPIRE
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (error.name === "TokenExpiredError") {
        auditLogger.warn("Refresh token expired", {
          error: error.message,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Refresh token expired"
        });
      }

      auditLogger.error("Token refresh failed", {
        error: error.message,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      res.status(401).json({
        success: false,
        error: "Invalid refresh token"
      });
    }
  }

  /**
   * تسجيل الخروج
   */
  async logout(req, res) {
    try {
      const userId = req.user.id;
      
      // إزالة الـ Cookies
      res.clearCookie("access_token");
      res.clearCookie("refresh_token");

      // إبطال جميع الجلسات السابقة للمستخدم
      await this.invalidateOldSessions(userId);

      auditLogger.info("User logged out", {
        userId,
        employeeId: req.user.employeeId,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        message: "Logged out successfully"
      });

    } catch (error) {
      auditLogger.error("Logout failed", {
        userId: req.user?.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: "Logout failed"
      });
    }
  }

  /**
   * Reset rate limiting for a user (admin endpoint)
   */
  async resetRateLimit(req, res) {
    try {
      const { employeeId } = req.body;
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: "Employee ID is required"
        });
      }
      
      const success = await this.resetUserRateLimit(employeeId);
      
      if (success) {
        return res.status(200).json({
          success: true,
          message: `Rate limiting reset for user ${employeeId}`
        });
      } else {
        return res.status(500).json({
          success: false,
          error: "Failed to reset rate limiting"
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reset rate limiting for a specific user
   * This clears both database records and helps with middleware rate limits
   */
  async resetUserRateLimit(employeeId) {
    try {
      // Clear database login attempts
      await LoginAttempt.deleteMany({
        employeeId: employeeId
      });
      
      // Reset user's failed login attempts and lockout status
      await User.updateMany(
        { employeeId: employeeId },
        {
          $set: {
            failedLoginAttempts: 0,
            lockedUntil: null
          }
        }
      );
      
      auditLogger.info("Rate limiting reset for user", {
        employeeId,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (error) {
      auditLogger.error("Error resetting rate limit:", {
        employeeId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  /**
   * إبطال جميع جلسات المستخدم
   */
  async invalidateOldSessions(userId) {
    // Increment token version to invalidate all existing tokens
    const user = await User.findById(userId);
    if (user) {
      await User.findByIdAndUpdate(user._id, {
        tokenVersion: (user.tokenVersion || 0) + 1
      });
      
      // Clear login attempts from database for this user
      await LoginAttempt.deleteMany({
        employeeId: user.employeeId
      });
      
      // Reset rate limiting for this user
      await this.resetUserRateLimit(user.employeeId);
    }
    
    // Note: For express-rate-limit, we cannot easily clear specific IP-based limits
    // The middleware stores limits in memory by IP address
    // Users will need to wait for the rate limit window to expire (15 minutes)
    // or we could implement a custom store that allows selective clearing
  }

  /**
   * إرسال بريد إعادة تعيين كلمة المرور
   */
  async sendPasswordResetEmail(user, tempPassword) {
    // تنفيذ إرسال البريد الإلكتروني
    // يمكن استخدام Nodemailer أو خدمة بريد أخرى
    auditLogger.info("Password reset email would be sent", {
      targetEmail: user.email,
      targetEmployeeId: user.employeeId,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new AuthController();