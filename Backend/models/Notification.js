import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "cart",
        "wishlist",
        "order",
        "promotion",
        "price_drop",
      ],
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    emailSent: {
      type: Boolean,
      default: false,
    },

    link: {
      type: String,
      default: "",
    },

    dedupeKey: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate notifications for the same event.
notificationSchema.index(
  { user: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dedupeKey: { $type: "string" },
    },
  }
);

export default mongoose.model(
  "Notification",
  notificationSchema
);
