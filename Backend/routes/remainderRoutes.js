
import express from "express";
import { timingSafeEqual } from "node:crypto";

import {
  createCartReminderNotifications,
  createWishlistReminderNotifications,
} from "../services/bellNotification.js";

import {
  sendCartReminderEmails,
  sendWishlistReminderEmails,
} from "../services/emailNotification.js";

const router = express.Router();

router.post("/run", async (req, res) => {
  try {
    const secret = process.env.REMINDER_SECRET;
    const provided = req.get("x-reminder-secret");

    if (!secret || !provided) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const expectedBuffer = Buffer.from(secret);
    const providedBuffer = Buffer.from(provided);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // CART REMINDERS
    const cartNotificationsCreated =
      await createCartReminderNotifications();

    const cartEmailsSent =
      await sendCartReminderEmails();

    // WISHLIST REMINDERS
    const wishlistNotificationsCreated =
      await createWishlistReminderNotifications();

    const wishlistEmailsSent =
      await sendWishlistReminderEmails();

    return res.status(200).json({
      message: "Reminder check completed.",
      cart: {
        notificationsCreated: cartNotificationsCreated,
        emailsSent: cartEmailsSent,
      },
      wishlist: {
        notificationsCreated: wishlistNotificationsCreated,
        emailsSent: wishlistEmailsSent,
      },
    });
  } catch (error) {
    console.error("Reminder error:", error);

    return res.status(500).json({
      message: "Unable to process reminders.",
    });
  }
});

export default router;
