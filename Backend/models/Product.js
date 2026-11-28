
import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      trim: true
    },

    color: {
      type: String,
      required: true,
      trim: true
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Variant stock must be a whole number"
      }
    }
  },
  {
    _id: false
  }
);

const productSchema = new mongoose.Schema(
  {
    // 1. Basic product information
    productName: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    // 2. Main category
    category: {
      type: String,
      enum: ["men", "women"],
      required: true
    },

    // 3. Clothing type
    subCategory: {
      type: String,
      required: true
    },

    // 4. Brand name
    brand: {
      type: String,
      required: true,
      trim: true
    },

    // 5. Product price
    price: {
      type: Number,
      required: true,
      min: 0
    },

    discountPrice: {
      type: Number,
      default: null,
      min: 0
    },

    // 6. Colour-wise product image
    images: [
      {
        url: {
          type: String,
          required: true
        },

        publicId: {
          type: String,
          default: null
        },

        color: {
          type: String,
          trim: true,
          default: null
        },

        provider: {
          type: String,
          enum: ["cloudinary", "r2"],
          default: "cloudinary"
        },

        isPrimary: {
          type: Boolean,
          default: false
        },

        sortOrder: {
          type: Number,
          default: 0,
          min: 0
        }
      }
    ],
    // 7. Available sizes
    sizes: {
      type: [String],
      required: true
    },

    // 8. Available colours
    colors: {
      type: [String],
      required: true
    },

    // 9. Size and colour-wise inventory
    variants: {
      type: [variantSchema],
      default: [],
      validate: {
        validator: function (variants) {
          const combinations = variants.map((variant) =>
            JSON.stringify([variant.size, variant.color])
          );

          return new Set(combinations).size === combinations.length;
        },
        message: "Duplicate size and colour combinations are not allowed"
      }
    },

    // 10. Available stock
    stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    validate: {
      validator: Number.isSafeInteger,
      message: "Total stock must be a valid whole number"
      }
    },

    // 11. Product rating
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },

    numReviews: {
      type: Number,
      default: 0,
      min:0
    },

    // 12. Vendor who added the product
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
