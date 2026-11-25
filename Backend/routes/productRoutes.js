
import express from "express";
import Product from "../models/Product.js";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import cloudinary from "../config/cloudinary.js";
import { createPriceDropNotifications } from "../services/bellNotification.js";
import { sendPriceDropEmails } from "../services/emailNotification.js";

const router = express.Router();

// Get logged-in user
const loadCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: "Unable to verify user" });
  }
};

// Check user role
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).json({
        message: "You do not have permission"
      });
    }

    next();
  };
};

// Convert sizes, colors and variants into arrays
const parseArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(",").map(item => item.trim()).filter(Boolean);
  }
};

// Validate and prepare size-colour inventory
const prepareVariants = (value, sizes, colors) => {
  const variants = parseArray(value);

  if (variants.length === 0) {
    throw new Error("At least one product variant is required");
  }

  const combinations = new Set();

  const validatedVariants = variants.map((variant) => {
    if (
      !variant ||
      typeof variant.size !== "string" ||
      typeof variant.color !== "string"
    ) {
      throw new Error("Invalid product variant");
    }

    const size = variant.size.trim();
    const color = variant.color.trim();
    const stock = variant.stock;

    // Validate selected size
    if (!size || !sizes.includes(size)) {
      throw new Error(`Invalid variant size: ${size}`);
    }

    // Validate selected colour
    if (!color || !colors.includes(color)) {
      throw new Error(`Invalid variant colour: ${color}`);
    }

    // Validate stock
    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw new Error(`Invalid stock for ${size} - ${color}`);
    }

    // Prevent duplicate combinations
    const key = JSON.stringify([size, color]);

    if (combinations.has(key)) {
      throw new Error(`Duplicate variant: ${size} - ${color}`);
    }

    combinations.add(key);

    return {
      size,
      color,
      stock
    };
  });

  // Ensure every selected size-colour combination has stock information
  if (
    validatedVariants.length !==
    new Set(sizes).size * new Set(colors).size
  ) {
    throw new Error(
      "Provide stock for every selected size and colour combination"
    );
  }

  // Calculate total stock automatically
  const totalStock = validatedVariants.reduce(
    (total, variant) => total + variant.stock,
    0
  );

  if (!Number.isSafeInteger(totalStock)) {
    throw new Error("Invalid total stock");
  }

  return {
    variants: validatedVariants,
    totalStock
  };
};

// Upload image to Cloudinary
const uploadToCloudinary = (file) => {
  const base64 = file.buffer.toString("base64");
  const dataUri = `data:${file.mimetype};base64,${base64}`;

  return cloudinary.uploader.upload(dataUri, {
    folder: "nykaa-products"
  });
};

// Get actual selling price
const getSellingPrice = (product) => {
  return product.discountPrice != null
    ? Number(product.discountPrice)
    : Number(product.price);
};

// 1. Get all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("createdBy", "name email vendorDetails.storeName");

    res.status(200).json({
      message: "Products fetched successfully",
      products
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to fetch products"
    });
  }
});

// 2. Get products added by logged-in vendor
router.get(
  "/mine",
  authMiddleware,
  loadCurrentUser,
  allowRoles("vendor"),
  async (req, res) => {
    try {
      const products = await Product.find({
        createdBy: req.currentUser._id
      });

      res.status(200).json({ products });
    } catch (error) {
      res.status(500).json({
        message: "Unable to fetch your products"
      });
    }
  }
);

// 3. Add product (Vendor or Admin)
router.post(
  "/",
  authMiddleware,
  loadCurrentUser,
  allowRoles("vendor", "admin"),
  upload.array("images", 5),
  async (req, res) => {
    const uploadedImages = [];

    try {
      const {
        productName,
        description,
        category,
        subCategory,
        brand,
        price,
        discountPrice,
        stock,
        variants: rawVariants
      } = req.body;

      const sizes = parseArray(req.body.sizes);
      const colors = parseArray(req.body.colors);

      // Validate required product details
      if (
        !productName?.trim() ||
        !description?.trim() ||
        !["men", "women"].includes(category) ||
        !subCategory ||
        !brand ||
        price === undefined ||
        sizes.length === 0 ||
        colors.length === 0 ||
        !req.files?.length
      ) {
        return res.status(400).json({
          message: "Please provide all required product details and images"
        });
      }

      // Validate price and discount
      if (
        !Number.isFinite(Number(price)) ||
        Number(price) < 0 ||
        (
          discountPrice !== undefined &&
          discountPrice !== "" &&
          (
            !Number.isFinite(Number(discountPrice)) ||
            Number(discountPrice) < 0 ||
            Number(discountPrice) > Number(price)
          )
        )
      ) {
        return res.status(400).json({
          message: "Please enter valid price and discount values"
        });
      }

      // Prepare inventory
      // Temporarily support the existing frontend
      let inventory = {
        variants: [],
        totalStock: Number(stock)
      };

      // If variant data is provided, calculate stock from variants
      if (rawVariants !== undefined) {
        try {
          inventory = prepareVariants(
            rawVariants,
            sizes,
            colors
          );
        } catch (error) {
          return res.status(400).json({
            message: error.message
          });
        }
      } else if (
        stock == null ||
        String(stock).trim() === "" ||
        !Number.isSafeInteger(Number(stock)) ||
        Number(stock) < 0
      ) {
        return res.status(400).json({
          message: "Stock must be a non-negative whole number"
        });
      }

      // Upload images
      for (const file of req.files) {
        const result = await uploadToCloudinary(file);

        uploadedImages.push({
          url: result.secure_url,
          publicId: result.public_id
        });
      }

      // Create product
      const product = await Product.create({
        productName: productName.trim(),
        description: description.trim(),
        category,
        subCategory,
        brand: brand.trim(),
        price: Number(price),

        discountPrice:
          discountPrice === "" || discountPrice === undefined
            ? null
            : Number(discountPrice),

        // Automatically calculated stock
        stock: inventory.totalStock,

        // Size and colour-wise inventory
        variants: inventory.variants,

        sizes,
        colors,
        images: uploadedImages,
        createdBy: req.currentUser._id
      });

      res.status(201).json({
        message: "Product added successfully",
        product
      });

    } catch (error) {
      // Clean up uploaded images if product creation fails
      for (const image of uploadedImages) {
        await cloudinary.uploader
          .destroy(image.publicId)
          .catch(() => {});
      }

      console.error("Add product error:", error);

      res.status(500).json({
        message: "Unable to add product"
      });
    }
  }
);

// 4. Get a single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("createdBy", "name");

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.status(200).json({ product });

  } catch (error) {
    res.status(500).json({
      message: "Unable to fetch product"
    });
  }
});

// 5. Update product (Owner vendor or Admin)
router.put(
  "/:id",
  authMiddleware,
  loadCurrentUser,
  allowRoles("vendor", "admin"),
  upload.array("images", 5),
  async (req, res) => {
    const newlyUploadedImages = [];

    try {
      const user = req.currentUser;
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({
          message: "Product not found"
        });
      }

      // Save old image details before replacing them
      const oldImages = [...product.images];

      // Vendor can update only their own products
      if (
        user.role === "vendor" &&
        product.createdBy.toString() !== user._id.toString()
      ) {
        return res.status(403).json({
          message: "You can update only your own products"
        });
      }

      const {
        productName,
        description,
        category,
        subCategory,
        brand,
        price,
        discountPrice,
        stock,
        sizes,
        colors,
        variants: rawVariants,
        expectedVersion
      } = req.body;
      // VALIDATE ORIGINAL PRODUCT VERSION
      if (
        expectedVersion === undefined ||
        expectedVersion === null ||
        String(expectedVersion).trim() === "" ||
        !Number.isSafeInteger(Number(expectedVersion)) ||
        Number(expectedVersion) < 0
      ) {
        return res.status(400).json({
          message: "Product version is required. Please reload the product."
        });
      }

      // CHECK WHETHER PRODUCT HAS CHANGED
      if (Number(expectedVersion) !== product.__v) {
        return res.status(409).json({
          message:
            "Product details or inventory have changed. Please reload the latest product details before editing.",
          code: "PRODUCT_VERSION_CONFLICT",
          currentVersion: product.__v
        });
      }

      const oldSellingPrice = getSellingPrice(product);

      // Calculate the updated price
      const updatedPrice =
        price !== undefined
          ? Number(price)
          : product.price;

      // Calculate the updated discount
      const updatedDiscount =
        discountPrice !== undefined
          ? discountPrice === ""
            ? null
            : Number(discountPrice)
          : product.discountPrice;

      // Validate price and discount
      if (
        !Number.isFinite(updatedPrice) ||
        updatedPrice < 0 ||
        (
          updatedDiscount !== null &&
          (
            !Number.isFinite(updatedDiscount) ||
            updatedDiscount < 0 ||
            updatedDiscount > updatedPrice
          )
        )
      ) {
        return res.status(400).json({
          message: "Please enter valid price and discount values"
        });
      }

      // Validate old product-level stock
      if (
        rawVariants === undefined &&
        stock !== undefined &&
        (
          stock === null ||
          String(stock).trim() === "" ||
          !Number.isSafeInteger(Number(stock)) ||
          Number(stock) < 0
        )
      ) {
        return res.status(400).json({
          message: "Stock must be a non-negative whole number"
        });
      }

      // Validate category
      if (
        category !== undefined &&
        !["men", "women"].includes(category)
      ) {
        return res.status(400).json({
          message: "Category must be men or women"
        });
      }

      // Get updated sizes
      const updatedSizes =
        sizes !== undefined
          ? parseArray(sizes)
          : product.sizes;

      // Get updated colours
      const updatedColors =
        colors !== undefined
          ? parseArray(colors)
          : product.colors;

      // Validate sizes and colours
      if (
        updatedSizes.length === 0 ||
        updatedColors.length === 0
      ) {
        return res.status(400).json({
          message: "At least one size and colour are required"
        });
      }

      // Validate inventory before modifying the product
      let inventory;

      if (rawVariants !== undefined) {
        try {
          inventory = prepareVariants(
            rawVariants,
            updatedSizes,
            updatedColors
          );
        } catch (error) {
          return res.status(400).json({
            message: error.message
          });
        }

      } else if (product.variants?.length) {

        // Prevent older clients from incorrectly updating
        // variant-managed products
        try {
          inventory = prepareVariants(
            product.variants,
            updatedSizes,
            updatedColors
          );
        } catch (error) {
          return res.status(400).json({
            message:
              "Provide updated variants when changing sizes or colours"
          });
        }

        if (
          stock !== undefined &&
          Number(stock) !== inventory.totalStock
        ) {
          return res.status(400).json({
            message: "Update stock through product variants"
          });
        }
      }

      // PREVENT STOCK LOSS DURING LEGACY INVENTORY MIGRATION
      if (
        !product.variants?.length &&
        rawVariants !== undefined &&
        inventory.totalStock !== product.stock
      ) {
        return res.status(400).json({
          message:
            `Please distribute the existing ${product.stock} stock units among the selected variants before updating inventory.`
        });
      }

      // Update product name
      if (productName !== undefined) {
        product.productName = productName.trim();
      }

      // Update description
      if (description !== undefined) {
        product.description = description.trim();
      }

      // Update category
      if (category !== undefined) {
        product.category = category;
      }

      // Update subcategory
      if (subCategory !== undefined) {
        product.subCategory = subCategory.trim();
      }

      // Update brand
      if (brand !== undefined) {
        product.brand = brand.trim();
      }

      // Update price and discount
      product.price = updatedPrice;
      product.discountPrice = updatedDiscount;

      // Update variant inventory and total stock
      if (inventory) {
        if (rawVariants !== undefined) {
          product.variants = inventory.variants;
        }

        product.stock = inventory.totalStock;

      } else if (stock !== undefined) {

        // Maintain compatibility with existing products
        product.stock = Number(stock);
      }

      // Update sizes and colours
      product.sizes = updatedSizes;
      product.colors = updatedColors;

      // Upload new images if provided
      if (req.files?.length) {
        for (const file of req.files) {
          const result = await uploadToCloudinary(file);

          newlyUploadedImages.push({
            url: result.secure_url,
            publicId: result.public_id
          });
        }

        product.images = newlyUploadedImages;
      }

      // Save updated product
      await product.save();

      // Check if selling price has decreased
      const newSellingPrice = getSellingPrice(product);

      if (newSellingPrice < oldSellingPrice) {
        try {
          await createPriceDropNotifications({
            product,
            oldPrice: oldSellingPrice,
            newPrice: newSellingPrice
          });

          await sendPriceDropEmails(product);

        } catch (notificationError) {
          console.error(
            "Price-drop notification/email error:",
            notificationError
          );
        }
      }

      // Delete old images only after successful save
      if (newlyUploadedImages.length) {
        for (const image of oldImages) {
          if (image.publicId) {
            await cloudinary.uploader
              .destroy(image.publicId)
              .catch(error => {
                console.error(
                  "Old image deletion error:",
                  error
                );
              });
          }
        }
      }

      res.status(200).json({
        message: "Product updated successfully",
        product
      });

    } catch (error) {
    console.error("Update product error:", error);

    // Clean up newly uploaded images if update fails
    for (const image of newlyUploadedImages) {
      await cloudinary.uploader
        .destroy(image.publicId)
        .catch(() => {});
    }

    // HANDLE CONCURRENT PRODUCT UPDATES
    if (error.name === "VersionError") {
      return res.status(409).json({
        message:
          "Product inventory was updated by another operation while you were saving. Please reload the product and try again.",
        code: "PRODUCT_VERSION_CONFLICT"
      });
    }

    // HANDLE VALIDATION ERRORS
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message
      });
    }

    return res.status(500).json({
      message: "Unable to update product"
    });
  }
  }
);

// 6. Delete product (Owner vendor or Admin)
router.delete(
  "/:id",
  authMiddleware,
  loadCurrentUser,
  allowRoles("vendor", "admin"),
  async (req, res) => {
    try {
      const user = req.currentUser;
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({
          message: "Product not found"
        });
      }

      // Vendor can delete only their own products
      if (
        user.role === "vendor" &&
        product.createdBy.toString() !== user._id.toString()
      ) {
        return res.status(403).json({
          message: "You can delete only your own products"
        });
      }

      // Delete product images from Cloudinary
      for (const image of product.images) {
        if (image.publicId) {
          await cloudinary.uploader.destroy(image.publicId);
        }
      }

      // Delete product from MongoDB
      await product.deleteOne();

      res.status(200).json({
        message: "Product deleted successfully"
      });

    } catch (error) {
      console.error("Delete product error:", error);

      res.status(500).json({
        message: "Unable to delete product"
      });
    }
  }
);

export default router;
