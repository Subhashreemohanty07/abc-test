
import express from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";

import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Address from "../models/Address.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

// ROLE CHECK
const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: "You are not authorized to access this resource.",
    });
  }

  next();
};

// CREATE CUSTOM ERROR
function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// NORMALIZE PRODUCT SIZES AND COLOURS
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

// CHECK WHETHER PRODUCT HAS VARIANT INVENTORY
function hasVariantInventory(product) {
  return (
    Array.isArray(product.variants) &&
    product.variants.length > 0
  );
}

// VALIDATE SELECTED SIZE AND COLOUR
function validateSelectedOptions(product, size, color) {
  const sizes = normalizeOptions(product.sizes);
  const colors = normalizeOptions(product.colors);

  if (
    (sizes.length > 0 && !sizes.includes(size)) ||
    (sizes.length === 0 && size !== "")
  ) {
    throw createError(
      `Selected size is no longer available for ${product.productName}.`
    );
  }

  if (
    (colors.length > 0 && !colors.includes(color)) ||
    (colors.length === 0 && color !== "")
  ) {
    throw createError(
      `Selected colour is no longer available for ${product.productName}.`
    );
  }
}

// VALIDATE AND DEDUCT INVENTORY
async function deductInventory(product, item, session) {
  const quantity = Number(item.quantity);
  const size = item.size || "";
  const color = item.color || "";

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw createError("Invalid cart quantity.");
  }

  // Validate selected size and colour
  validateSelectedOptions(product, size, color);

  // VARIANT-BASED INVENTORY
  if (hasVariantInventory(product)) {
    const variant = product.variants.find(
      (variant) =>
        variant.size === size &&
        variant.color === color
    );

    if (!variant) {
      throw createError(
        `Selected combination is unavailable for ${product.productName}.`
      );
    }

    if (Number(variant.stock) < quantity) {
      throw createError(
        `Insufficient stock for ${product.productName} (${size}, ${color}). Only ${variant.stock} item(s) available.`
      );
    }

    // Atomically deduct selected variant and total stock
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: product._id,

        stock: { $gte: quantity },

        variants: {
          $elemMatch: {
            size,
            color,
            stock: { $gte: quantity },
          },
        },
      },
      {
        $inc: {
          stock: -quantity,
          "variants.$.stock": -quantity,
          __v: 1,
        },
      },
      {
        returnDocument: "after",
        session,
      }
    );

    if (!updatedProduct) {
      throw createError(
        `Insufficient stock for ${product.productName} (${size}, ${color}). Please update your cart.`
      );
    }

    return "variant";
  }

  // LEGACY PRODUCT INVENTORY
  // Older products without size and colour-wise stock
  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: product._id,

      stock: { $gte: quantity },

      "variants.0": { $exists: false },
    },
    {
      $inc: {
        stock: -quantity,
        __v: 1,
      },
    },
    {
      returnDocument: "after",
      session,
    }
  );

  if (!updatedProduct) {
    throw createError(
      `Insufficient stock for ${product.productName}.`
    );
  }

  return "legacy";
}


// RESTORE INVENTORY AFTER ORDER CANCELLATION
async function restoreInventory(item, session) {
  const quantity = Number(item.quantity);
  const size = item.size || "";
  const color = item.color || "";

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw createError("Invalid order quantity.");
  }

  const product = await Product.findById(
    item.product
  ).session(session);

  if (!product) {
    throw createError(
      `Product ${item.productName} no longer exists.`,
      409
    );
  }

  // RESTORE VARIANT INVENTORY
  if (item.inventoryType === "variant") {
    const variant = product.variants?.find(
      (variant) =>
        variant.size === size &&
        variant.color === color
    );

    if (!variant) {
      throw createError(
        `Original variant of ${item.productName} is no longer available.`,
        409
      );
    }

    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: product._id,
        variants: {
          $elemMatch: {
            size,
            color,
          },
        },
      },
      {
        $inc: {
          stock: quantity,
          "variants.$.stock": quantity,
          __v: 1,
        },
      },
      {
        returnDocument: "after",
        session,
      }
    );

    if (!updatedProduct) {
      throw createError(
        `Unable to restore stock for ${item.productName}.`,
        409
      );
    }

    return;
  }

  // RESTORE LEGACY INVENTORY
  if (item.inventoryType === "legacy") {
    if (hasVariantInventory(product)) {
      throw createError(
        `${item.productName} has been migrated to variant inventory. Manual stock reconciliation is required.`,
        409
      );
    }

    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: product._id,
        "variants.0": { $exists: false },
      },
      {
        $inc: {
          stock: quantity,
          __v: 1,
        },
      },
      {
        returnDocument: "after",
        session,
      }
    );

    if (!updatedProduct) {
      throw createError(
        `Unable to restore stock for ${item.productName}.`,
        409
      );
    }

    return;
  }

  // OLD ORDERS WITH UNKNOWN INVENTORY TYPE
  throw createError(
    `Inventory history is unavailable for ${item.productName}. Please contact support.`,
    409
  );
}


// POST /api/orders
// POST /api/orders
// CUSTOMER PLACES CART OR BUY NOW ORDER

router.post("/", allowRoles("customer"), async (req, res) => {
  const {
    addressId,
    paymentMethod = "COD",
    checkoutMode = "cart",
    buyNowItem,
  } = req.body || {};

  // VALIDATE CHECKOUT MODE
  if (!["cart", "buyNow"].includes(checkoutMode)) {
    return res.status(400).json({
      message: "Invalid checkout mode.",
    });
  }

  const isBuyNow = checkoutMode === "buyNow";

  // VALIDATE DELIVERY ADDRESS
  if (!mongoose.isValidObjectId(addressId)) {
    return res.status(400).json({
      message: "Please select a valid delivery address.",
    });
  }

  // VALIDATE PAYMENT METHOD
  if (paymentMethod !== "COD") {
    return res.status(400).json({
      message: "Only Cash on Delivery is currently supported.",
    });
  }

  // VALIDATE BUY NOW REQUEST
  if (isBuyNow) {
    if (
      !buyNowItem ||
      typeof buyNowItem.productId !== "string" ||
      !mongoose.isValidObjectId(buyNowItem.productId) ||
      !Number.isSafeInteger(buyNowItem.quantity) ||
      buyNowItem.quantity < 1 ||
      typeof buyNowItem.size !== "string" ||
      typeof buyNowItem.color !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid Buy Now product details.",
      });
    }
  }

  let session;

  try {
    session = await mongoose.startSession();

    let createdOrder;

    await session.withTransaction(async () => {
      const userId = req.user.userId;

      // VERIFY DELIVERY ADDRESS
      const address = await Address.findOne({
        _id: addressId,
        user: userId,
      }).session(session);

      if (!address) {
        throw createError(
          "Delivery address not found.",
          404
        );
      }

      let cart = null;
      let itemsToOrder = [];

      // BUY NOW CHECKOUT
      if (isBuyNow) {
        itemsToOrder = [
          {
            product: buyNowItem.productId,
            quantity: buyNowItem.quantity,
            size: buyNowItem.size.trim(),
            color: buyNowItem.color.trim(),
          },
        ];
      }

      // NORMAL CART CHECKOUT
      else {
        cart = await Cart.findOne({
          user: userId,
        }).session(session);

        if (!cart || cart.items.length === 0) {
          throw createError("Your cart is empty.");
        }

        itemsToOrder = cart.items;
      }

      const orderItems = [];
      let subtotal = 0;

      // VALIDATE EACH ORDER ITEM
      for (const item of itemsToOrder) {
        const quantity = Number(item.quantity);

        if (
          !Number.isSafeInteger(quantity) ||
          quantity < 1
        ) {
          throw createError("Invalid product quantity.");
        }

        // FETCH LATEST PRODUCT DETAILS
        const product = await Product.findById(
          item.product
        ).session(session);

        if (!product) {
          throw createError(
            "A selected product is no longer available."
          );
        }

        // GET CURRENT PRODUCT PRICE
        const price = Number(
          product.discountPrice ?? product.price
        );

        if (!Number.isFinite(price) || price < 0) {
          throw createError(
            `Invalid price for ${product.productName}.`
          );
        }

        // VALIDATE AND DEDUCT STOCK
        const inventoryType = await deductInventory(
          product,
          item,
          session
        );

        // CALCULATE SUBTOTAL
        subtotal += price * quantity;

        if (!Number.isFinite(subtotal)) {
          throw createError("Invalid order amount.");
        }

        // GET IMAGE FOR SELECTED COLOUR
        const productImages = Array.isArray(product.images)
          ? product.images.filter((image) => image?.url)
          : [];

        const selectedColor = String(
          item.color || ""
        ).trim().toLowerCase();

        const matchingImages = productImages.filter(
          (image) =>
            String(image.color || "").trim().toLowerCase() ===
            selectedColor
        );

        const legacyImages = productImages.filter(
          (image) => !String(image.color || "").trim()
        );

        const availableImages = selectedColor
          ? matchingImages.length
            ? matchingImages
            : legacyImages
          : productImages;

        const sortedImages = [...availableImages].sort(
          (a, b) =>
            Number(Boolean(b.isPrimary)) -
              Number(Boolean(a.isPrimary)) ||
            Number(a.sortOrder ?? 0) -
              Number(b.sortOrder ?? 0)
        );

        const selectedImage =
          sortedImages[0]?.url || "";

        // SAVE PRODUCT SNAPSHOT
        orderItems.push({
          product: product._id,
          vendor: product.createdBy,
          productName: product.productName,
          brand: product.brand,
          image: selectedImage,
          price,
          quantity,
          size: item.size || "",
          color: item.color || "",
          inventoryType,
        });
      }

      // DELIVERY ADDRESS SNAPSHOT
      const deliveryAddress = {
        addressType: address.addressType,
        fullName: address.fullName,
        phone: address.phone,
        house: address.house,
        area: address.area,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      };

      const deliveryCharge = 0;

      // CREATE ORDER
      const orders = await Order.create(
        [
          {
            user: userId,
            items: orderItems,
            deliveryAddress,

            paymentMethod: "COD",
            paymentStatus: "Pending",
            orderStatus: "Placed",

            stockRestored: false,
            stockRestoredAt: null,
            cancelledAt: null,
            cancellationReason: "",

            subtotal,
            deliveryCharge,
            totalAmount: subtotal + deliveryCharge,
          },
        ],
        { session }
      );

      createdOrder = orders[0];

      // CLEAR CART ONLY FOR NORMAL CART CHECKOUT
      if (!isBuyNow && cart) {
        cart.items = [];

        await cart.save({ session });
      }

      // BUY NOW DOES NOT MODIFY THE CUSTOMER CART
    });

    return res.status(201).json({
      message: "Order placed successfully.",
      order: createdOrder,
    });

  } catch (error) {
    console.error("Place order error:", error);

    if (error.name === "VersionError") {
      return res.status(409).json({
        message:
          "Product or cart details have changed. Please refresh and try again.",
      });
    }

    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Unable to place order. Please check your orders before trying again.",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
});

// GET /api/orders/my
// CUSTOMER SEES THEIR OWN ORDERS
router.get("/my", allowRoles("customer"), async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.json({ orders });

  } catch (error) {
    console.error("Customer orders error:", error);

    return res.status(500).json({
      message: "Unable to fetch your orders.",
    });
  }
});

// GET /api/orders/vendor
// VENDOR SEES THEIR PRODUCTS AND CUSTOMER DETAILS
router.get("/vendor", allowRoles("vendor"), async (req, res) => {
  try {
    const vendorId = String(req.user.userId);

    const orders = await Order.find({
      "items.vendor": vendorId,
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Only expose this vendor's items and totals
    const vendorOrders = orders.map((order) => {
      const vendorItems = order.items.filter(
        (item) => String(item.vendor) === vendorId
      );

      const vendorSubtotal = vendorItems.reduce(
        (total, item) =>
          total + item.price * item.quantity,
        0
      );

      return {
        _id: order._id,

        customer: order.user
          ? {
              _id: order.user._id,
              name: order.user.name,
              email: order.user.email,
            }
          : null,

        deliveryAddress: order.deliveryAddress,
        items: vendorItems,
        subtotal: vendorSubtotal,

        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,

        cancelledAt: order.cancelledAt,
        cancellationReason: order.cancellationReason,

        createdAt: order.createdAt,
      };
    });

    return res.json({
      orders: vendorOrders,
    });

  } catch (error) {
    console.error("Vendor orders error:", error);

    return res.status(500).json({
      message: "Unable to fetch vendor orders.",
    });
  }
});

// GET /api/orders/admin
// ADMIN SEES ALL ORDERS
router.get("/admin", allowRoles("admin"), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("items.vendor", "name email")
      .sort({ createdAt: -1 });

    return res.json({ orders });

  } catch (error) {
    console.error("Admin orders error:", error);

    return res.status(500).json({
      message: "Unable to fetch orders.",
    });
  }
});

// GET /api/orders/admin/customers/:customerId
// ADMIN SEES ORDERS OF ONE CUSTOMER
router.get(
  "/admin/customers/:customerId",
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { customerId } = req.params;

      if (!mongoose.isValidObjectId(customerId)) {
        return res.status(400).json({
          message: "Invalid customer ID.",
        });
      }

      const orders = await Order.find({
        user: customerId,
      })
        .populate("user", "name email")
        .populate("items.vendor", "name email")
        .sort({ createdAt: -1 });

      return res.json({ orders });

    } catch (error) {
      console.error(
        "Admin customer orders error:",
        error
      );

      return res.status(500).json({
        message: "Unable to fetch customer orders.",
      });
    }
  }
);

// GET /api/orders/:orderId/receipt
// DOWNLOAD CUSTOMER ORDER RECEIPT
router.get(
  "/:orderId/receipt",
  allowRoles("customer"),
  async (req, res) => {
    try {
      const { orderId } = req.params;

      // VALIDATE ORDER ID
      if (!mongoose.isValidObjectId(orderId)) {
        return res.status(400).json({
          message: "Invalid order ID.",
        });
      }

      // FIND CUSTOMER'S OWN ORDER
      const order = await Order.findOne({
        _id: orderId,
        user: req.user.userId,
      }).lean();

      if (!order) {
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      // CREATE PDF
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Nykaa-Receipt-${order._id}.pdf"`
      );

      doc.pipe(res);

      // RECEIPT HEADER
      doc
        .fontSize(24)
        .fillColor("#fc2779")
        .text("NYKAA CLONE", {
          align: "center",
        });

      doc
        .fontSize(15)
        .fillColor("#333333")
        .text("ORDER RECEIPT", {
          align: "center",
        });

      doc.moveDown(2);

      // ORDER INFORMATION
      doc.fontSize(11).fillColor("#000000");

      doc.text(`Order ID: ${order._id}`);

      doc.text(
        `Order Date: ${new Date(
          order.createdAt
        ).toLocaleString("en-IN")}`
      );

      doc.text(
        `Order Status: ${order.orderStatus}`
      );

      doc.text(
        `Payment Method: ${order.paymentMethod}`
      );

      doc.text(
        `Payment Status: ${order.paymentStatus}`
      );

      doc.moveDown(1.5);

      // DELIVERY ADDRESS
      const address = order.deliveryAddress || {};

      doc.fontSize(14).text("Delivery Address");

      doc.moveDown(0.5);
      doc.fontSize(11);

      doc.text(
        `Name: ${address.fullName || ""}`
      );

      doc.text(
        `Phone: ${address.phone || ""}`
      );

      doc.text(
        [
          address.house,
          address.area,
          address.city,
          address.state,
        ]
          .filter(Boolean)
          .join(", ")
      );

      doc.text(
        `Pincode: ${address.pincode || ""}`
      );

      doc.moveDown(1.5);

      // ORDERED PRODUCTS
      doc.fontSize(14).text("Ordered Products");
      doc.moveDown();

      for (const item of order.items) {
        const price = Number(item.price || 0);
        const quantity = Number(item.quantity || 0);

        doc.fontSize(11).fillColor("#000000");

        doc.text(
          `Product: ${item.productName || "Product"}`
        );

        doc.text(
          `Brand: ${item.brand || "N/A"}`
        );

        doc.text(`Quantity: ${quantity}`);

        if (item.size) {
          doc.text(`Size: ${item.size}`);
        }

        if (item.color) {
          doc.text(`Colour: ${item.color}`);
        }

        doc.text(
          `Unit Price: Rs. ${price.toFixed(2)}`
        );

        doc.text(
          `Item Total: Rs. ${(
            price * quantity
          ).toFixed(2)}`
        );

        doc.moveDown();
      }

      // PAYMENT SUMMARY
      doc.moveDown();

      doc.fontSize(14).text("Payment Summary");
      doc.moveDown(0.5);

      doc.fontSize(11);

      doc.text(
        `Subtotal: Rs. ${Number(
          order.subtotal || 0
        ).toFixed(2)}`
      );

      doc.text(
        `Delivery Charge: Rs. ${Number(
          order.deliveryCharge || 0
        ).toFixed(2)}`
      );

      doc.moveDown(0.5);

      doc
        .fontSize(15)
        .fillColor("#fc2779")
        .text(
          `Total Amount: Rs. ${Number(
            order.totalAmount || 0
          ).toFixed(2)}`
        );

      doc.moveDown(2);

      doc
        .fontSize(9)
        .fillColor("#777777")
        .text(
          "Thank you for shopping with Nykaa Clone!",
          { align: "center" }
        );

      doc.text(
        "This is an order receipt, not proof of payment.",
        { align: "center" }
      );

      // FINISH PDF
      doc.end();

    } catch (error) {
      console.error(
        "Receipt generation error:",
        error
      );

      if (!res.headersSent) {
        return res.status(500).json({
          message: "Unable to generate receipt.",
        });
      }

      res.destroy(error);
    }
  }
);


// PATCH /api/orders/:orderId/cancel
// CUSTOMER CANCELS THEIR OWN ORDER

router.patch(
  "/:orderId/cancel",
  allowRoles("customer"),
  async (req, res) => {
    const { orderId } = req.params;
    const { reason = "" } = req.body || {};

    // VALIDATE ORDER ID
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    // VALIDATE CANCELLATION REASON
    if (
      typeof reason !== "string" ||
      reason.trim().length > 500
    ) {
      return res.status(400).json({
        message: "Invalid cancellation reason.",
      });
    }

    let session;

    try {
      session = await mongoose.startSession();

      let cancelledOrder;

      await session.withTransaction(async () => {
        const userId = req.user.userId;

        // FIND CUSTOMER'S OWN ORDER
        const order = await Order.findOne({
          _id: orderId,
          user: userId,
        }).session(session);

        if (!order) {
          throw createError(
            "Order not found.",
            404
          );
        }

        // PREVENT DUPLICATE CANCELLATION
        if (
          order.orderStatus === "Cancelled" ||
          order.stockRestored
        ) {
          throw createError(
            "This order has already been cancelled or its stock restored.",
            409
          );
        }

        // CHECK CANCELLATION ELIGIBILITY
        const cancellableStatuses = [
          "Placed",
          "Confirmed",
        ];

        if (
          !cancellableStatuses.includes(
            order.orderStatus
          )
        ) {
          throw createError(
            `An order with status ${order.orderStatus} cannot be cancelled.`,
            409
          );
        }

        // PAID ORDERS REQUIRE REFUND HANDLING
        if (order.paymentStatus !== "Pending") {
          throw createError(
            "This order requires payment verification before cancellation. Please contact support.",
            409
          );
        }

        const cancelledAt = new Date();

        // ATOMICALLY CLAIM ORDER CANCELLATION
        cancelledOrder = await Order.findOneAndUpdate(
          {
            _id: order._id,
            user: userId,

            orderStatus: {
              $in: ["Placed", "Confirmed"],
            },

            paymentStatus: "Pending",

            stockRestored: {
              $ne: true,
            },
          },
          {
            $set: {
              orderStatus: "Cancelled",
              stockRestored: true,
              stockRestoredAt: cancelledAt,
              cancelledAt,
              cancellationReason: reason.trim(),
            },

            $inc: {
              __v: 1,
            },
          },
          {
            returnDocument: "after",
            session,
            runValidators: true,
          }
        );

        if (!cancelledOrder) {
          throw createError(
            "Order status has changed. Please refresh and try again.",
            409
          );
        }

        // RESTORE EACH ORDER ITEM'S INVENTORY
        for (const item of order.items) {
          await restoreInventory(item, session);
        }
      });

      return res.status(200).json({
        message: "Order cancelled successfully.",
        order: cancelledOrder,
      });

    } catch (error) {
      console.error(
        "Cancel order error:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        message: error.statusCode
          ? error.message
          : "Unable to confirm cancellation. Please check your order status before trying again.",
      });

    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }
);


export default router;
