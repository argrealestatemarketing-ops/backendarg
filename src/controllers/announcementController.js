const Announcement = require("../models/repositories/Announcement");
const AuditLog = require("../models/repositories/AuditLog");
const { auditLogger } = require("../utils/logger");

function toAnnouncementResponse(doc) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    message: doc.content || doc.message || "",
    createdBy: doc.author || doc.createdBy || "",
    createdAt: doc.createdAt,
    sentToAll: (doc.targetAudience || "all") === "all",
    priority: doc.priority,
    targetAudience: doc.targetAudience,
    startDate: doc.startDate,
    endDate: doc.endDate,
    isActive: doc.isActive
  };
}

const createAnnouncement = async (req, res) => {
  try {
    const { title, message, priority, targetAudience, endDate } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ success: false, error: "Title and message are required" });
    }

    const newAnnouncement = await Announcement.create({
      title: String(title).trim(),
      content: String(message).trim(),
      author: req.user.employeeId,
      priority: priority || "normal",
      targetAudience: targetAudience || "all",
      endDate: endDate ? new Date(endDate) : undefined,
      isActive: true
    });

    try {
      await AuditLog.create({
        actorId: String(req.user.id),
        actorEmployeeId: req.user.employeeId,
        targetEmployeeId: "ALL",
        action: "announcement_create",
        details: {
          announcementId: String(newAnnouncement._id),
          priority: newAnnouncement.priority,
          targetAudience: newAnnouncement.targetAudience
        },
        createdAt: new Date()
      });
    } catch (auditError) {
      auditLogger.warn("Failed to persist announcement audit log", {
        error: auditError.message,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      data: toAnnouncementResponse(newAnnouncement)
    });
  } catch (error) {
    auditLogger.error("Create announcement error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ success: false, error: "Failed to create announcement" });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      isActive: true,
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }]
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: announcements.map((doc) => toAnnouncementResponse(doc))
    });
  } catch (error) {
    auditLogger.error("Get announcements error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ success: false, error: "Failed to get announcements" });
  }
};

const getAnnouncementById = async (req, res) => {
  try {
    const { announcementId } = req.params;

    if (!announcementId) {
      return res.status(400).json({ success: false, error: "Announcement ID is required" });
    }

    const announcement = await Announcement.findById(announcementId).lean();

    if (!announcement) {
      return res.status(404).json({ success: false, error: "Announcement not found" });
    }

    return res.status(200).json({
      success: true,
      data: toAnnouncementResponse(announcement)
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, error: "Invalid announcement ID format" });
    }

    auditLogger.error("Get announcement by ID error", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ success: false, error: "Failed to get announcement" });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById
};
