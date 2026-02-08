const express = require("express");
const announcementController = require("../controllers/announcementController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Wrapper function to properly bind the middleware
const verifyAuth = (req, res, next) => {
  return authMiddleware.verifyAccessToken(req, res, next);
};

router.post("/", verifyAuth, roleMiddleware(["hr", "admin"]), announcementController.createAnnouncement);
router.get("/", verifyAuth, announcementController.getAnnouncements);
router.get("/:announcementId", verifyAuth, announcementController.getAnnouncementById);

module.exports = router;
