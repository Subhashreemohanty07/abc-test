import express from "express";
import Product from "../models/Product.js";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

import upload, {
  MAX_IMAGES_PER_COLOR,
  MAX_PRODUCT_IMAGES
} from "../middleware/uploadMiddleware.js";

import {
  uploadImage,
  deleteImage
} from "../services/imageStorage.js";

import {
  createPriceDropNotifications
} from "../services/bellNotification.js";

import {
  sendPriceDropEmails
} from "../services/emailNotification.js";

const router = express.Router();

// Get logged-in user
const loadCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    req.currentUser = user;
    next();

  } catch (error) {
    res.status(500).json({
      message: "Unable to verify user"
    });
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
    return value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }
};

// Validate and prepare size-colour inventory
const prepareVariants = (value, sizes, colors) => {

  const variants = parseArray(value);

  if (variants.length === 0) {
    throw new Error(
      "At least one product variant is required"
    );
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
      throw new Error(
        `Invalid stock for ${size} - ${color}`
      );
    }

    // Prevent duplicate combinations
    const key = JSON.stringify([size, color]);

    if (combinations.has(key)) {
      throw new Error(
        `Duplicate variant: ${size} - ${color}`
      );
    }

    combinations.add(key);

    return {
      size,
      color,
      stock
    };
  });

  // Ensure every selected size-colour combination
  // has stock information
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

// Validate colour-wise product images
// Used by Add Product and complete image replacement
const prepareImageMetadata = (
  files,
  rawMetadata,
  colors
) => {

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Please upload product images");
  }

  if (files.length > MAX_PRODUCT_IMAGES) {
    throw new Error(
      `Maximum ${MAX_PRODUCT_IMAGES} images allowed per product`
    );
  }

  if (
    !Array.isArray(colors) ||
    colors.length === 0 ||
    colors.some(
      color =>
        typeof color !== "string" ||
        !color.trim()
    ) ||
    new Set(colors).size !== colors.length
  ) {
    throw new Error("Invalid selected colours");
  }

  let metadata;

  try {
    metadata =
      typeof rawMetadata === "string"
        ? JSON.parse(rawMetadata)
        : rawMetadata;

  } catch {
    throw new Error("Invalid image metadata");
  }

  if (
    !Array.isArray(metadata) ||
    metadata.length !== files.length
  ) {
    throw new Error(
      "Colour information is required for every image"
    );
  }

  const colorCounts = new Map();

  const validatedMetadata = metadata.map((item) => {

    if (
      !item ||
      typeof item.color !== "string"
    ) {
      throw new Error("Invalid image colour");
    }

    const color = item.color.trim();

    // Check whether colour belongs to product
    if (!colors.includes(color)) {
      throw new Error(
        `Image colour ${color} is not selected`
      );
    }

    const count = colorCounts.get(color) || 0;

    // Maximum five images per colour
    if (count >= MAX_IMAGES_PER_COLOR) {
      throw new Error(
        `Maximum ${MAX_IMAGES_PER_COLOR} images allowed for ${color}`
      );
    }

    colorCounts.set(color, count + 1);

    return {
      color,
      isPrimary: count === 0,
      sortOrder: count
    };
  });

  // Every selected colour must have an image
  for (const color of colors) {

    if (!colorCounts.has(color)) {
      throw new Error(
        `Upload at least one image for ${color}`
      );
    }
  }

  return validatedMetadata;
};

// Validate existing and newly uploaded product images
// Used by Edit Product
const prepareImageUpdate = (
  files,
  rawManifest,
  colors,
  oldImages
) => {

  let manifest;

  try {
    manifest =
      typeof rawManifest === "string"
        ? JSON.parse(rawManifest)
        : rawManifest;

  } catch {
    throw new Error("Invalid image manifest");
  }

  // Validate selected colours
  if (
    !Array.isArray(colors) ||
    colors.length === 0 ||
    colors.some(
      color =>
        typeof color !== "string" ||
        !color.trim()
    ) ||
    new Set(colors).size !== colors.length
  ) {
    throw new Error("Invalid selected colours");
  }

  // Validate final image collection
  if (
    !Array.isArray(manifest) ||
    manifest.length === 0
  ) {
    throw new Error("Please provide product images");
  }

  if (manifest.length > MAX_PRODUCT_IMAGES) {
    throw new Error(
      `Maximum ${MAX_PRODUCT_IMAGES} images allowed per product`
    );
  }

  const uploadedFiles = files || [];

  // Map existing product images by MongoDB image ID
  const existingImageMap = new Map(
    oldImages
      .filter(image => image._id)
      .map(image => [
        String(image._id),
        image
      ])
  );

  const usedExistingIds = new Set();
  const usedFileIndexes = new Set();
  const colorCounts = new Map();

  const preparedImages = manifest.map(item => {

    if (
      !item ||
      typeof item.color !== "string"
    ) {
      throw new Error("Invalid image colour");
    }

    const color = item.color.trim();

    // Ensure colour belongs to the product
    if (!colors.includes(color)) {
      throw new Error(
        `Image colour ${color} is not selected`
      );
    }

    const count = colorCounts.get(color) || 0;

    // Maximum five images per colour
    if (count >= MAX_IMAGES_PER_COLOR) {
      throw new Error(
        `Maximum ${MAX_IMAGES_PER_COLOR} images allowed for ${color}`
      );
    }

    colorCounts.set(color, count + 1);

    // First image of each colour becomes primary
    const metadata = {
      color,
      isPrimary: count === 0,
      sortOrder: count
    };

    // Retain an existing product image
    if (item.type === "existing") {

      if (
        typeof item.imageId !== "string" ||
        !existingImageMap.has(item.imageId)
      ) {
        throw new Error("Invalid existing image");
      }

      if (usedExistingIds.has(item.imageId)) {
        throw new Error("Duplicate existing image");
      }

      usedExistingIds.add(item.imageId);

      const existingImage =
        existingImageMap.get(item.imageId);

      return {
        type: "existing",
        image: existingImage,
        metadata
      };
    }

    // Upload a new product image
    if (item.type === "new") {

      const fileIndex = item.fileIndex;

      if (
        !Number.isSafeInteger(fileIndex) ||
        fileIndex < 0 ||
        fileIndex >= uploadedFiles.length
      ) {
        throw new Error(
          "Invalid uploaded image index"
        );
      }

      if (usedFileIndexes.has(fileIndex)) {
        throw new Error("Duplicate uploaded image");
      }

      usedFileIndexes.add(fileIndex);

      return {
        type: "new",
        file: uploadedFiles[fileIndex],
        metadata
      };
    }

    throw new Error("Invalid image type");
  });

  // Ensure every uploaded file is included
  if (
    usedFileIndexes.size !== uploadedFiles.length
  ) {
    throw new Error(
      "Image information is required for every uploaded file"
    );
  }

  // Every selected colour must have an image
  for (const color of colors) {

    if (!colorCounts.has(color)) {
      throw new Error(
        `Upload at least one image for ${color}`
      );
    }
  }

  return preparedImages;
};

// Get unique storage identifier for an image
const getImageStorageKey = (image) => {

  if (!image?.publicId) return null;

  return JSON.stringify([
    image.provider || "cloudinary",
    image.publicId
  ]);
};

// Find images removed from the final collection
const getRemovedImages = (
  oldImages,
  finalImages
) => {

  const retainedStorageKeys = new Set(
    finalImages
      .map(getImageStorageKey)
      .filter(Boolean)
  );

  return oldImages.filter(image => {

    const storageKey = getImageStorageKey(image);

    return (
      storageKey &&
      !retainedStorageKeys.has(storageKey)
    );
  });
};

// Safely delete images from storage
// Supports Cloudinary and future R2 migration
const cleanupImages = async (
  images,
  errorMessage = "Image cleanup error:"
) => {

  const deletedStorageKeys = new Set();

  for (const image of images) {

    const storageKey = getImageStorageKey(image);

    if (
      !storageKey ||
      deletedStorageKeys.has(storageKey)
    ) {
      continue;
    }

    deletedStorageKeys.add(storageKey);

    try {
      await deleteImage(image);

    } catch (error) {
      console.error(errorMessage, error);
    }
  }
};

// Get actual selling price
const getSellingPrice = (product) => {

  return product.discountPrice != null
    ? Number(product.discountPrice)
    : Number(product.price);
};


// ==================================================
// 1. GET ALL PRODUCTS
// ==================================================

router.get("/", async (req, res) => {

  try {

    const products = await Product.find()
      .populate(
        "createdBy",
        "name email vendorDetails.storeName"
      );

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


// ==================================================
// 2. GET PRODUCTS ADDED BY LOGGED-IN VENDOR
// ==================================================

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

      res.status(200).json({
        products
      });

    } catch (error) {

      res.status(500).json({
        message: "Unable to fetch your products"
      });
    }
  }
);


// ==================================================
// 3. ADD PRODUCT (VENDOR OR ADMIN)
// ==================================================

router.post(
  "/",
  authMiddleware,
  loadCurrentUser,
  allowRoles("vendor", "admin"),
  upload.array("images", MAX_PRODUCT_IMAGES),

  async (req, res) => {

    const uploadedImages = [];

    let productSaved = false;

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
          message:
            "Please provide all required product details and images"
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
          message:
            "Please enter valid price and discount values"
        });
      }

      // Prepare inventory
      // Maintain compatibility with existing frontend
      let inventory = {
        variants: [],
        totalStock: Number(stock)
      };

      // Calculate stock from variants
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
          message:
            "Stock must be a non-negative whole number"
        });
      }

      // Validate colour-wise image metadata
      let imageMetadata;

      try {

        imageMetadata = prepareImageMetadata(
          req.files,
          req.body.imageMetadata,
          colors
        );

      } catch (error) {

        return res.status(400).json({
          message: error.message
        });
      }

      // Upload colour-wise product images
      for (let i = 0; i < req.files.length; i++) {

        const uploadedImage = await uploadImage(
          req.files[i],
          imageMetadata[i]
        );

        uploadedImages.push(uploadedImage);
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
          discountPrice === "" ||
          discountPrice === undefined
            ? null
            : Number(discountPrice),

        // Automatically calculated stock
        stock: inventory.totalStock,

        // Size and colour-wise inventory
        variants: inventory.variants,

        sizes,
        colors,

        // Colour-wise product images
        images: uploadedImages,

        createdBy: req.currentUser._id
      });

      productSaved = true;

      res.status(201).json({
        message: "Product added successfully",
        product
      });

    } catch (error) {

      // Clean up uploaded images only if creation fails
      if (!productSaved) {

        await cleanupImages(
          uploadedImages,
          "Image cleanup error:"
        );
      }

      console.error("Add product error:", error);

      res.status(500).json({
        message: "Unable to add product"
      });
    }
  }
);


// ==================================================
// 4. GET A SINGLE PRODUCT
// ==================================================

router.get("/:id", async (req, res) => {

  try {

    const product = await Product.findById(
      req.params.id
    ).populate("createdBy", "name");

    if (!product) {

      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.status(200).json({
      product
    });

  } catch (error) {

    res.status(500).json({
      message: "Unable to fetch product"
    });
  }
});


// ==================================================
// 5. UPDATE PRODUCT (OWNER VENDOR OR ADMIN)
// ==================================================

router.put(
  "/:id",
  authMiddleware,
  loadCurrentUser,
  allowRoles("vendor", "admin"),
  upload.array("images", MAX_PRODUCT_IMAGES),

  async (req, res) => {

    const newlyUploadedImages = [];

    let imagesToDelete = [];
    let productSaved = false;

    try {

      const user = req.currentUser;

      const product = await Product.findById(
        req.params.id
      );

      if (!product) {

        return res.status(404).json({
          message: "Product not found"
        });
      }

      // Vendor can update only their own products
      if (
        user.role === "vendor" &&
        product.createdBy.toString() !==
          user._id.toString()
      ) {

        return res.status(403).json({
          message:
            "You can update only your own products"
        });
      }

      // Save original image details
      const oldImages = [...product.images];

      // Save original selected colours
      const originalColors = [...product.colors];

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
          message:
            "Product version is required. Please reload the product."
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

      const oldSellingPrice =
        getSellingPrice(product);

      // Calculate updated price
      const updatedPrice =
        price !== undefined
          ? Number(price)
          : product.price;

      // Calculate updated discount
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
          updatedDiscount != null &&
          (
            !Number.isFinite(updatedDiscount) ||
            updatedDiscount < 0 ||
            updatedDiscount > updatedPrice
          )
        )
      ) {

        return res.status(400).json({
          message:
            "Please enter valid price and discount values"
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
          message:
            "Stock must be a non-negative whole number"
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
          message:
            "At least one size and colour are required"
        });
      }

      // Validate inventory before modifying product
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

        // Prevent older clients from incorrectly
        // updating variant-managed products
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
            message:
              "Update stock through product variants"
          });
        }
      }

      // PREVENT STOCK LOSS DURING LEGACY
      // INVENTORY MIGRATION
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

        // Maintain compatibility with legacy products
        product.stock = Number(stock);
      }

      // Update sizes and colours
      product.sizes = updatedSizes;
      product.colors = updatedColors;


      // ============================================
      // NEW: INDIVIDUAL IMAGE MANAGEMENT
      // ============================================

      if (req.body.imageManifest !== undefined) {

        let preparedImages;

        try {

          preparedImages = prepareImageUpdate(
            req.files || [],
            req.body.imageManifest,
            updatedColors,
            oldImages
          );

        } catch (error) {

          return res.status(400).json({
            message: error.message
          });
        }

        const finalImages = [];

        for (const item of preparedImages) {

          // Retain existing image without reuploading
          if (item.type === "existing") {

            finalImages.push({

              // Preserve MongoDB image ID
              _id: item.image._id,

              // Preserve existing storage information
              url: item.image.url,
              publicId: item.image.publicId,

              provider:
                item.image.provider || "cloudinary",

              // Update colour, primary and order
              ...item.metadata
            });

          } else {

            // Upload only newly selected images
            const uploadedImage = await uploadImage(
              item.file,
              item.metadata
            );

            newlyUploadedImages.push(uploadedImage);

            finalImages.push(uploadedImage);
          }
        }

        // Identify removed or replaced images
        imagesToDelete = getRemovedImages(
          oldImages,
          finalImages
        );

        // Save complete final image collection
        product.images = finalImages;


      // ============================================
      // BACKWARD COMPATIBILITY:
      // COMPLETE IMAGE REPLACEMENT
      // ============================================

      } else if (req.files?.length) {

        let imageMetadata;

        try {

          imageMetadata = prepareImageMetadata(
            req.files,
            req.body.imageMetadata,
            updatedColors
          );

        } catch (error) {

          return res.status(400).json({
            message: error.message
          });
        }

        for (let i = 0; i < req.files.length; i++) {

          const uploadedImage = await uploadImage(
            req.files[i],
            imageMetadata[i]
          );

          newlyUploadedImages.push(uploadedImage);
        }

        // Replace complete image collection
        product.images = newlyUploadedImages;

        // Identify old images to delete
        imagesToDelete = getRemovedImages(
          oldImages,
          newlyUploadedImages
        );


      // ============================================
      // NORMAL PRODUCT UPDATE WITHOUT IMAGE CHANGES
      // ============================================

      } else {

        const previousColors = new Set(
          originalColors
        );

        const colorsChanged =
          updatedColors.length !== previousColors.size ||
          updatedColors.some(
            color => !previousColors.has(color)
          );

        // Require image information when changing colours
        if (colorsChanged) {

          return res.status(400).json({
            message:
              "Please provide images for all selected colours"
          });
        }

        // Existing images remain unchanged.
        // Legacy products without colour metadata
        // can still update normal product details.
      }


      // ============================================
      // SAVE UPDATED PRODUCT
      // ============================================

      await product.save();

      // Mark database update as successful
      productSaved = true;


      // ============================================
      // DELETE ONLY REMOVED OR REPLACED IMAGES
      // ============================================

      await cleanupImages(
        imagesToDelete,
        "Removed image deletion error:"
      );


      // ============================================
      // PRICE-DROP NOTIFICATIONS AND EMAILS
      // ============================================

      const newSellingPrice =
        getSellingPrice(product);

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

      // Return updated product
      res.status(200).json({
        message: "Product updated successfully",
        product
      });

    } catch (error) {

      console.error(
        "Update product error:",
        error
      );

      // Clean up newly uploaded images only
      // if MongoDB save did not succeed
      if (!productSaved) {

        await cleanupImages(
          newlyUploadedImages,
          "Image cleanup error:"
        );
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


// ==================================================
// 6. DELETE PRODUCT (OWNER VENDOR OR ADMIN)
// ==================================================

router.delete(
  "/:id",
  authMiddleware,
  loadCurrentUser,
  allowRoles("vendor", "admin"),

  async (req, res) => {

    try {

      const user = req.currentUser;

      const product = await Product.findById(
        req.params.id
      );

      if (!product) {

        return res.status(404).json({
          message: "Product not found"
        });
      }

      // Vendor can delete only their own products
      if (
        user.role === "vendor" &&
        product.createdBy.toString() !==
          user._id.toString()
      ) {

        return res.status(403).json({
          message:
            "You can delete only your own products"
        });
      }

      // Save image details before deleting product
      const imagesToDelete = [...product.images];

      // Delete product from MongoDB first
      await product.deleteOne();

      // Delete associated images from storage
      await cleanupImages(
        imagesToDelete,
        "Image deletion error:"
      );

      res.status(200).json({
        message: "Product deleted successfully"
      });

    } catch (error) {

      console.error(
        "Delete product error:",
        error
      );

      res.status(500).json({
        message: "Unable to delete product"
      });
    }
  }
);

export default router;