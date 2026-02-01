const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Simple login rate limiter to mitigate brute force
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true });

// Wrapper functions to properly bind the controller methods
const verifyAuth = (req, res, next) => {
  return authMiddleware.verifyAccessToken(req, res, next);
};

const login = (req, res, next) => {
  return authController.login(req, res, next);
};

const changePassword = (req, res, next) => {
  return authController.changePassword(req, res, next);
};

const resetPassword = (req, res, next) => {
  return authController.resetPassword(req, res, next);
};

const resetRateLimit = (req, res, next) => {
  return authController.resetRateLimit(req, res, next);
};

const refreshToken = (req, res, next) => {
  return authController.refreshToken(req, res, next);
};

const logout = (req, res, next) => {
  return authController.logout(req, res, next);
};

router.post("/login", loginLimiter, login);
router.get("/verify", verifyAuth, (req, res) => {
	res.status(200).json({ success: true, user: req.user });
});
// Change password endpoint - requires auth
router.post("/change-password", verifyAuth, changePassword);

// Admin password reset (HR only)
router.post("/admin/reset-password", verifyAuth, roleMiddleware(["hr"]), resetPassword);

// Token refresh endpoint
router.post("/refresh-token", refreshToken);

// Logout endpoint
router.post("/logout", verifyAuth, logout);

router.post("/reset-rate-limit", resetRateLimit);

module.exports = router;
