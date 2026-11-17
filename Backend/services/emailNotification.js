
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";
import { sendNotificationEmail } from "./emailService.js";

// Send emails for pending cart reminders
export const sendCartReminderEmails = async () => {
  const notifications = await Notification.find({
    type: "cart",
    emailSent: false,
  });

  let sentCount = 0;

  for (const notification of notifications) {
    try {
      // Find the customer
      const customer = await User.findById(notification.user)
        .select("name email role");

      if (
        !customer ||
        customer.role !== "customer" ||
        !customer.email
      ) {
        continue;
      }

      // Verify that the customer still has items in their cart
      const cart = await Cart.findOne({
        user: notification.user,
        "items.0": { $exists: true },
      });

      if (!cart) continue;

      // Verify that this reminder belongs to the
      // current cart activity period
      const expectedKey =
        `cart-reminder:${cart._id}:${cart.updatedAt.getTime()}`;

      if (notification.dedupeKey !== expectedKey) {
        continue;
      }

      const result = await sendNotificationEmail({
        to: customer.email,
        subject: "Your cart is waiting! 🛍️",
        message: `Hi ${customer.name || "there"},

You left something in your cart!

Your favourite products are waiting for you.

Visit Nykaa Clone and complete your shopping.

Happy Shopping!
Nykaa Clone Team`,
      });

      // Mark as sent only after SMTP accepts the email
      if (result.accepted?.includes(customer.email)) {
        await Notification.updateOne(
          {
            _id: notification._id,
            emailSent: false,
          },
          {
            $set: { emailSent: true },
          }
        );

        sentCount++;
      }
    } catch (error) {
      console.error(
        "Cart reminder email error:",
        error.message
      );
    }
  }

  return sentCount;
};

//for wishlist

export const sendWishlistReminderEmails = async () => {
  const notifications = await Notification.find({
    type: "wishlist",
    emailSent: false,
  });

  let sentCount = 0;

  for (const notification of notifications) {
    try {
      const customer = await User.findById(
        notification.user
      ).select("name email role");

      if (
        !customer ||
        customer.role !== "customer" ||
        !customer.email
      ) {
        continue;
      }

      // Check whether the wishlist still contains products
      const wishlist = await Wishlist.findOne({
        user: notification.user,
        "products.0": { $exists: true },
      });

      if (!wishlist) continue;

      // Check that the reminder belongs to the
      // current wishlist activity period
      const expectedKey =
        `wishlist-reminder:${wishlist._id}:${wishlist.updatedAt.getTime()}`;

      if (notification.dedupeKey !== expectedKey) {
        continue;
      }

      const result = await sendNotificationEmail({
        to: customer.email,
        subject: "Your wishlist is waiting! 💖",
        message: `Hi ${customer.name || "there"},

Your favourite products are still waiting in your wishlist!

Take another look at the products you loved.

Visit Nykaa Clone and explore your wishlist.

Happy Shopping!
Nykaa Clone Team`,
      });

      if (result.accepted?.includes(customer.email)) {
        await Notification.updateOne(
          {
            _id: notification._id,
            emailSent: false,
          },
          {
            $set: { emailSent: true },
          }
        );

        sentCount++;
      }
    } catch (error) {
      console.error(
        "Wishlist reminder email error:",
        error.message
      );
    }
  }

  return sentCount;
};

//for price drop email notification

export const sendPriceDropEmails = async (product) => {
  const eventKey =
    `price-drop:${product._id}:${product.updatedAt.getTime()}`;

  const notifications = await Notification.find({
    product: product._id,
    type: "price_drop",
    dedupeKey: eventKey,
    emailSent: false,
  });

  let sentCount = 0;

  for (const notification of notifications) {
    try {
      const customer = await User.findById(
        notification.user
      ).select("name email role");

      if (
        !customer ||
        customer.role !== "customer" ||
        !customer.email
      ) {
        continue;
      }

      const result = await sendNotificationEmail({
        to: customer.email,
        subject: "Price Drop Alert!",
        message: `Hi ${customer.name || "there"},

Good news! The price of ${product.productName} has dropped.

A product you saved in your cart or wishlist is now available at a lower price.

Visit Nykaa Clone to check it out!

Happy Shopping!
Nykaa Clone Team`,
      });

      if (result.accepted?.includes(customer.email)) {
        await Notification.updateOne(
          {
            _id: notification._id,
            emailSent: false,
          },
          {
            $set: { emailSent: true },
          }
        );

        sentCount++;
      }
    } catch (error) {
      console.error(
        "Price-drop email error:",
        error.message
      );
    }
  }

  return sentCount;
};

