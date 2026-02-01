const { Announcement } = require("../models");

const createAnnouncement = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, error: "Title and message are required" });
    }

    const newAnnouncement = await Announcement.create({
      title,
      message,
      createdBy: req.user.employeeId,
      sentToAll: true
    });

    res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      data: newAnnouncement
    });
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({ success: false, error: "Failed to create announcement" });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error("Get announcements error:", error);
    res.status(500).json({ success: false, error: "Failed to get announcements" });
  }
};

const getAnnouncementById = async (req, res) => {
  try {
    const { announcementId } = req.params;

    if (!announcementId) {
      return res.status(400).json({ success: false, error: "Announcement ID is required" });
    }

    const announcement = await Announcement.findByPk(announcementId);

    if (!announcement) {
      return res.status(404).json({ success: false, error: "Announcement not found" });
    }

    res.status(200).json({
      success: true,
      data: announcement
    });
  } catch (error) {
    console.error("Get announcement by ID error:", error);
    res.status(500).json({ success: false, error: "Failed to get announcement" });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById
};
