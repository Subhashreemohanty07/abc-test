
import mongoose from "mongoose";

// PRODUCT DETAILS AT THE TIME OF ORDER
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    productName: {
      type: String,
      required: true,
    },

    brand: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantity must be a whole number.",
      },
    },

    size: {
      type: String,
      default: "",
      trim: true,
    },

    color: {
      type: String,
      default: "",
      trim: true,
    },

    // INVENTORY TYPE AT THE TIME OF ORDER
    inventoryType: {
      type: String,
      enum: ["variant", "legacy", "unknown"],
      default: "unknown",
    },
  },
  { _id: true }
);

// DELIVERY ADDRESS SNAPSHOT
const deliveryAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    house: {
      type: String,
      required: true,
    },

    area: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    state: {
      type: String,
      required: true,
    },

    pincode: {
      type: String,
      required: true,
    },

    addressType: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home",
    },
  },
  { _id: false }
);

// MAIN ORDER SCHEMA
const orderSchema = new mongoose.Schema(
  {
    // CUSTOMER WHO PLACED THE ORDER
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ORDERED PRODUCTS
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must contain at least one product.",
      },
    },

    // SELECTED DELIVERY ADDRESS
    deliveryAddress: {
      type: deliveryAddressSchema,
      required: true,
    },

    // PAYMENT METHOD
    paymentMethod: {
      type: String,
      enum: ["COD"],
      default: "COD",
    },

    // PAYMENT STATUS
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },

    // ORDER STATUS
    orderStatus: {
      type: String,
      enum: [
        "Placed",
        "Confirmed",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Placed",
    },

    // INVENTORY RESTORATION STATUS
    stockRestored: {
      type: Boolean,
      default: false,
    },

    // DATE AND TIME OF STOCK RESTORATION
    stockRestoredAt: {
      type: Date,
      default: null,
    },

    // ORDER CANCELLATION DATE
    cancelledAt: {
      type: Date,
      default: null,
    },

    // ORDER CANCELLATION REASON
    cancellationReason: {
      type: String,
      default: "",
      trim: true,
    },

    // PRICE DETAILS
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// INDEX FOR VENDOR ORDER LOOKUPS
orderSchema.index({ "items.vendor": 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
