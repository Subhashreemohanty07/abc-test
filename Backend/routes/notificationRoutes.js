
import express from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

// Only logged-in customers can access notifications.
const requireCustomer = (req, res, next) => {
  if (!req.user?.userId) {
    return res.status(401).json({
      message: "Please log in to view notifications.",
    });
  }

  if (req.user.role !== "customer") {
    return res.status(403).json({
      message: "Only customers can access notifications.",
    });
  }

  next();
};

// GET NOTIFICATIONS WITH PAGINATION
// Example:
// GET /api/notifications?page=1&limit=5&filter=all

router.get("/", requireCustomer, async (req, res) => {
  try {
    const userId = req.user.userId;

    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 5)
    );

    const filter = String(req.query.filter || "all")
      .trim()
      .toLowerCase();

    const query = {
      user: userId,
    };

    // Apply notification filter
    if (filter === "unread") {
      query.isRead = false;
    } else if (filter === "read") {
      query.isRead = true;
    } else if (filter !== "all") {
      return res.status(400).json({
        message: "Invalid filter.",
      });
    }

    const total = await Notification.countDocuments(query);

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    const totalPages = Math.max(
      1,
      Math.ceil(total / limit)
    );

    const safePage = Math.min(page, totalPages);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit);

    res.status(200).json({
      notifications,
      unreadCount,
      total,
      page: safePage,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error("Notification filter error:", error);

    res.status(500).json({
      message: "Unable to fetch notifications.",
    });
  }
});


// MARK ALL NOTIFICATIONS AS READ
router.patch("/read-all", requireCustomer, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        user: req.user.userId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    res.json({
      message: "All notifications marked as read.",
      unreadCount: 0,
    });
  } catch (error) {
    console.error("Mark all notifications error:", error);

    res.status(500).json({
      message: "Unable to update notifications.",
    });
  }
});

// MARK A SINGLE NOTIFICATION AS READ
router.patch("/:id/read", requireCustomer, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid notification ID.",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.userId,
      },
      {
        $set: { isRead: true },
      },
      { returnDocument: "after" }
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    res.json({ notification });
  } catch (error) {
    console.error("Mark notification error:", error);

    res.status(500).json({
      message: "Unable to update notification.",
    });
  }
});

export default router;
