const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/mongo/User");
const BlacklistedToken = require("../models/mongo/BlacklistedToken"); // Assuming this exists or will be created
const { auditLogger } = require("../utils/logger");

class AuthMiddleware {
  /**
   * تحقق من صحة Access Token
   */
  async verifyAccessToken(req, res, next) {
    const startTime = Date.now();
    
    try {
      // محاولة الحصول على الـ Token من مصادر مختلفة
      const token = this.extractToken(req);
      
      if (!token) {
        auditLogger.warn("Access attempt without token", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Access token required"
        });
      }

      // التحقق من كون الـ Token في القائمة السوداء
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        auditLogger.warn("Access attempt with blacklisted token", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Token has been revoked"
        });
      }

      // التحقق من صحة الـ Token
      const decoded = jwt.verify(token, config.JWT_SECRET, {
        algorithms: [config.JWT_ALGORITHM]
      });

      // التحقق من نوع الـ Token
      if (decoded.type !== "access") {
        auditLogger.warn("Access attempt with wrong token type", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          tokenType: decoded.type,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Invalid token type"
        });
      }

      // البحث عن المستخدم
      const user = await User.findById(decoded.id, {
        '_id': 1, 'employeeId': 1, 'name': 1, 'email': 1, 'role': 1,
        'mustChangePassword': 1, 'passwordChangedAt': 1, 'tokenVersion': 1,
        'status': 1, 'lockedUntil': 1
      });

      if (!user) {
        auditLogger.warn("Access attempt for non-existent user", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          decodedUserId: decoded.id,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "User not found"
        });
      }

      // التحقق من حالة الحساب
      if (user.status !== 'active') {
        auditLogger.warn("Access attempt for inactive account", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userId: user._id,
          employeeId: user.employeeId,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Account is inactive"
        });
      }

      // التحقق من قفل الحساب
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        auditLogger.warn("Access attempt for locked account", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userId: user._id,
          employeeId: user.employeeId,
          lockedUntil: user.lockedUntil,
          timestamp: new Date().toISOString()
        });
        
        return res.status(423).json({
          success: false,
          error: "Account is locked"
        });
      }

      // التحقق من إصدار الـ Token
      if (decoded.tokenVersion !== (user.tokenVersion || 0)) {
        auditLogger.warn("Access attempt with outdated token version", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userId: user.id,
          employeeId: user.employeeId,
          tokenVersion: decoded.tokenVersion,
          dbVersion: user.tokenVersion,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Token invalid (version mismatch)"
        });
      }

      // التحقق من تغيير كلمة المرور
      if (user.passwordChangedAt) {
        const tokenIatMs = decoded.iat * 1000;
        const pwdChangedMs = new Date(user.passwordChangedAt).getTime();
        
        if (tokenIatMs < pwdChangedMs) {
          auditLogger.warn("Access attempt with token issued before password change", {
            path: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userId: user.id,
            employeeId: user.employeeId,
            tokenIssuedAt: new Date(tokenIatMs),
            passwordChangedAt: user.passwordChangedAt,
            timestamp: new Date().toISOString()
          });
          
          return res.status(401).json({
            success: false,
            error: "Token invalid (password changed)"
          });
        }
      }

      // التحقق من ضرورة تغيير كلمة المرور
      if (user.mustChangePassword && !req.originalUrl.includes("/auth/change-password")) {
        return res.status(403).json({
          success: false,
          error: "Password change required",
          requiresPasswordChange: true
        });
      }

      // إضافة بيانات المستخدم إلى الـ Request
      req.user = {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        tokenVersion: user.tokenVersion || 0
      };

      req.token = token;
      req.tokenIssuedAt = new Date(decoded.iat * 1000);

      // تسجيل الوصول الناجح
      const responseTime = Date.now() - startTime;
      auditLogger.info("Access granted", {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: user.id,
        employeeId: user.employeeId,
        role: user.role,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      next();

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (error.name === "TokenExpiredError") {
        auditLogger.warn("Access attempt with expired token", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          error: error.message,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Token has expired",
          requiresRefresh: true
        });
      }

      if (error.name === "JsonWebTokenError") {
        auditLogger.warn("Access attempt with invalid token", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          error: error.message,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          success: false,
          error: "Invalid token"
        });
      }

      auditLogger.error("Authentication error", {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        error: error.message,
        stack: error.stack,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: "Authentication failed"
      });
    }
  }

  /**
   * استخراج الـ Token من الـ Request
   */
  extractToken(req) {
    // من الـ Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    // من الـ Cookie
    if (req.cookies && req.cookies.access_token) {
      return req.cookies.access_token;
    }

    // من Query Parameter (للتطوير فقط)
    if (req.query && req.query.token && config.NODE_ENV === "development") {
      return req.query.token;
    }

    return null;
  }

  /**
   * التحقق من كون الـ Token في القائمة السوداء
   */
  async isTokenBlacklisted(token) {
    try {
      // يمكن استخدام Redis أو قاعدة البيانات
      // مثال باستخدام جدول BlacklistedToken
      const blacklisted = await BlacklistedToken.findOne({
        tokenHash: this.hashToken(token)
      });
      
      return !!blacklisted;
    } catch (error) {
      console.error("Error checking token blacklist:", error);
      return false;
    }
  }

  /**
   * تشفير الـ Token للتخزين
   */
  hashToken(token) {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * التحقق من الصلاحيات
   */
  requireRole(allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required"
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        auditLogger.warn("Unauthorized role access attempt", {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userId: req.user.id,
          employeeId: req.user.employeeId,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          timestamp: new Date().toISOString()
        });
        
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions"
        });
      }

      next();
    };
  }

  /**
   * التحقق من صلاحية HR فقط
   */
  requireHR(req, res, next) {
    return this.requireRole(["hr", "admin"])(req, res, next);
  }

  /**
   * التحقق من صلاحية Admin فقط
   */
  requireAdmin(req, res, next) {
    return this.requireRole(["admin"])(req, res, next);
  }

  /**
   * التحقق من صلاحية Employee فقط
   */
  requireEmployee(req, res, next) {
    return this.requireRole(["employee", "hr", "admin"])(req, res, next);
  }
}

module.exports = new AuthMiddleware();