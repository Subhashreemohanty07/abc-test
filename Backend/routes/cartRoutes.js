
import express from "express";
import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// All cart routes require customer login
router.use(authMiddleware);

router.use((req, res, next) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({
      message: "Only customers can access their cart.",
    });
  }

  next();
});

// Normalize existing product sizes and colours
function normalizeOptions(value) {
  return [
    ...new Set(
      (Array.isArray(value)
        ? value
        : String(value || "").split(",")
      )
        .map((item) => String(item).trim())
        .filter(Boolean)
    ),
  ];
}

// Check whether product has variant inventory
function hasVariantInventory(product) {
  return (
    Array.isArray(product.variants) &&
    product.variants.length > 0
  );
}

// Get available stock for selected size and colour
function getAvailableStock(product, size, color) {
  const sizes = normalizeOptions(product.sizes);
  const colors = normalizeOptions(product.colors);

  // Validate selected size
  if (
    (sizes.length > 0 && !sizes.includes(size)) ||
    (sizes.length === 0 && size !== "")
  ) {
    return {
      valid: false,
      stock: 0,
      message: "Selected size is not available.",
    };
  }

  // Validate selected colour
  if (
    (colors.length > 0 && !colors.includes(color)) ||
    (colors.length === 0 && color !== "")
  ) {
    return {
      valid: false,
      stock: 0,
      message: "Selected colour is not available.",
    };
  }

  // Check size and colour-wise inventory
  if (hasVariantInventory(product)) {
    const variant = product.variants.find(
      (item) =>
        item.size === size &&
        item.color === color
    );

    if (!variant) {
      return {
        valid: false,
        stock: 0,
        message: "Selected size and colour combination is unavailable.",
      };
    }

    return {
      valid: true,
      stock: Number(variant.stock || 0),
    };
  }

  // Backward compatibility for old products
  return {
    valid: true,
    stock: Number(product.stock || 0),
  };
}

// Calculate quantity already present in cart
function getCartQuantity(
  cart,
  product,
  size,
  color,
  excludedItemId = null
) {
  const hasVariants = hasVariantInventory(product);

  return cart.items.reduce((total, item) => {
    // Exclude the item currently being updated
    if (
      excludedItemId &&
      String(item._id) === String(excludedItemId)
    ) {
      return total;
    }

    // Check product ID
    if (
      String(item.product) !== String(product._id)
    ) {
      return total;
    }

    // For variant products, check size and colour
    if (
      hasVariants &&
      (item.size !== size || item.color !== color)
    ) {
      return total;
    }

    // Old products share the same total stock
    return total + Number(item.quantity || 0);
  }, 0);
}

// Handle simultaneous cart updates
function handleCartError(error, res, message) {
  if (
    error.name === "VersionError" ||
    error.code === 11000
  ) {
    return res.status(409).json({
      message:
        "Your cart was updated by another request. Please refresh and try again.",
    });
  }

  console.error(message, error);

  return res.status(500).json({
    message,
  });
}

// GET CUSTOMER CART
router.get("/", async (req, res) => {
  try {
    const cart = await Cart.findOne({
      user: req.user.userId,
    }).populate("items.product");

    res.json({
      items: cart?.items || [],
    });

  } catch (error) {
    console.error("Get cart error:", error);

    res.status(500).json({
      message: "Unable to load cart.",
    });
  }
});

// ADD PRODUCT TO CART
router.post("/", async (req, res) => {
  try {
    const {
      productId,
      quantity = 1,
      size = "",
      color = "",
    } = req.body;

    const qty = Number(quantity);

    // Validate request
    if (
      typeof productId !== "string" ||
      !mongoose.isValidObjectId(productId) ||
      !["number", "string"].includes(typeof quantity) ||
      !Number.isSafeInteger(qty) ||
      qty < 1 ||
      typeof size !== "string" ||
      typeof color !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid product, variant or quantity.",
      });
    }

    const selectedSize = size.trim();
    const selectedColor = color.trim();

    // Find product
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    // Check selected variant stock
    const inventory = getAvailableStock(
      product,
      selectedSize,
      selectedColor
    );

    if (!inventory.valid) {
      return res.status(400).json({
        message: inventory.message,
      });
    }

    // Check out-of-stock product
    if (inventory.stock <= 0) {
      return res.status(400).json({
        message: "Selected product combination is out of stock.",
        availableStock: 0,
      });
    }

    // Find customer cart
    let cart = await Cart.findOne({
      user: req.user.userId,
    });

    // Create cart if it does not exist
    if (!cart) {
      cart = new Cart({
        user: req.user.userId,
        items: [],
      });
    }

    // Calculate quantity already present in cart
    const quantityInCart = getCartQuantity(
      cart,
      product,
      selectedSize,
      selectedColor
    );

    const requestedQuantity = quantityInCart + qty;

    // Prevent adding more than available stock
    if (
      !Number.isSafeInteger(requestedQuantity) ||
      requestedQuantity > inventory.stock
    ) {
      const remainingQuantity = Math.max(
        0,
        inventory.stock - quantityInCart
      );

      return res.status(400).json({
        message:
          remainingQuantity > 0
            ? `Only ${remainingQuantity} more item(s) can be added to your cart.`
            : "Maximum available quantity is already in your cart.",

        availableStock: inventory.stock,
        quantityInCart,
        remainingQuantity,
      });
    }

    // Find same product with same size and colour
    const existingItem = cart.items.find(
      (item) =>
        String(item.product) === String(product._id) &&
        item.size === selectedSize &&
        item.color === selectedColor
    );

    // Update existing cart item
    if (existingItem) {
      existingItem.quantity += qty;
    } else {
      // Create separate item for a different variant
      cart.items.push({
        product: product._id,
        quantity: qty,
        size: selectedSize,
        color: selectedColor,
      });
    }

    // Save cart
    await cart.save();

    // Include complete product details and variants
    await cart.populate("items.product");

    res.status(200).json({
      message: "Product added to cart.",
      items: cart.items,
    });

  } catch (error) {
    return handleCartError(
      error,
      res,
      "Unable to add product to cart."
    );
  }
});

// UPDATE CART ITEM QUANTITY
router.patch("/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const rawQuantity = req.body.quantity;
    const quantity = Number(rawQuantity);

    // Validate quantity
    if (
      !mongoose.isValidObjectId(itemId) ||
      !["number", "string"].includes(typeof rawQuantity) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        message: "Invalid cart item or quantity.",
      });
    }

    // Find customer cart
    const cart = await Cart.findOne({
      user: req.user.userId,
    });

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found.",
      });
    }

    // Find selected cart item
    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        message: "Cart item not found.",
      });
    }

    // Allow customers to reduce quantities even
    // when inventory has changed
    if (quantity < item.quantity) {
      item.quantity = quantity;

      await cart.save();
      await cart.populate("items.product");

      return res.json({
        message: "Cart updated.",
        items: cart.items,
      });
    }

    // Fetch latest product inventory
    const product = await Product.findById(
      item.product
    );

    if (!product) {
      return res.status(404).json({
        message:
          "This product is no longer available. Please remove it from your cart.",
      });
    }

    // Check stock for cart item's size and colour
    const inventory = getAvailableStock(
      product,
      item.size,
      item.color
    );

    if (!inventory.valid) {
      return res.status(400).json({
        message: inventory.message,
      });
    }

    if (inventory.stock <= 0) {
      return res.status(400).json({
        message: "Selected product combination is out of stock.",
        availableStock: 0,
      });
    }

    // Check other cart items sharing this inventory
    const otherCartQuantity = getCartQuantity(
      cart,
      product,
      item.size,
      item.color,
      item._id
    );

    const maximumQuantity = Math.max(
      0,
      inventory.stock - otherCartQuantity
    );

    // Prevent quantity from exceeding available stock
    if (quantity > maximumQuantity) {
      return res.status(400).json({
        message: `Only ${maximumQuantity} item(s) are available for this cart item.`,
        availableStock: inventory.stock,
        maximumQuantity,
      });
    }

    // Update quantity
    item.quantity = quantity;

    await cart.save();
    await cart.populate("items.product");

    res.json({
      message: "Cart updated.",
      items: cart.items,
    });

  } catch (error) {
    return handleCartError(
      error,
      res,
      "Unable to update cart."
    );
  }
});

// REMOVE PRODUCT FROM CART
router.delete("/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({
        message: "Invalid cart item ID.",
      });
    }

    const cart = await Cart.findOne({
      user: req.user.userId,
    });

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found.",
      });
    }

    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        message: "Cart item not found.",
      });
    }

    // Remove selected cart item
    cart.items.pull({ _id: itemId });

    await cart.save();
    await cart.populate("items.product");

    res.json({
      message: "Product removed from cart.",
      items: cart.items,
    });

  } catch (error) {
    return handleCartError(
      error,
      res,
      "Unable to remove product."
    );
  }
});

export default router;
