
import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  quantity: {
    type: Number,
    required: true,
    default: 1,
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
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    items: [cartItemSchema],
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

export default mongoose.model("Cart", cartSchema);
