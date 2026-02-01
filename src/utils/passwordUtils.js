const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const validator = require("validator");

class PasswordUtils {
  // Generate secure random password
  static generateSecurePassword(length = 16) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const randomBytes = crypto.randomBytes(length);
    let password = "";
    
    for (let i = 0; i < length; i++) {
      password += chars[randomBytes[i] % chars.length];
    }
    
    return password;
  }

  // Hash password with configurable salt rounds
  static async hashPassword(password, saltRounds = 12) {
    if (!password || typeof password !== "string") {
      throw new Error("Password must be a non-empty string");
    }
    
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password against hash
  static async verifyPassword(password, hash) {
    if (!password || !hash) return false;
    return await bcrypt.compare(password, hash);
  }

  // Validate password strength
  static validatePasswordStrength(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }
    
    // Check for common passwords
    const commonPasswords = [
      "123456", "password", "12345678", "qwerty", "123456789",
      "12345", "1234", "111111", "1234567", "dragon",
      "123123", "admin", "welcome", "monkey", "password1"
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push("Password is too common. Choose a more unique password");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate password expiry date (e.g., 90 days from now)
  static generatePasswordExpiryDate(days = 90) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return expiryDate;
  }

  // Check if password is expired
  static isPasswordExpired(passwordChangedAt, maxAgeDays = 90) {
    if (!passwordChangedAt) return true;
    
    const expiryDate = new Date(passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + maxAgeDays);
    
    return new Date() > expiryDate;
  }
}

module.exports = PasswordUtils;