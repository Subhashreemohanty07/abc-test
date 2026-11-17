
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

// Convert sizes and colors into arrays
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

// Upload image to Cloudinary
const uploadToCloudinary = (file) => {
  const base64 = file.buffer.toString("base64");
  const dataUri = `data:${file.mimetype};base64,${base64}`;

  return cloudinary.uploader.upload(dataUri, {
    folder: "nykaa-products"
  });
};



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
        stock
      } = req.body;

      const sizes = parseArray(req.body.sizes);
      const colors = parseArray(req.body.colors);

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

      if (
        !Number.isFinite(Number(price)) ||
        Number(price) < 0 ||
        (discountPrice !== undefined &&
          discountPrice !== "" &&
          (!Number.isFinite(Number(discountPrice)) ||
            Number(discountPrice) < 0 ||
            Number(discountPrice) > Number(price))) ||
        !Number.isInteger(Number(stock)) ||
        Number(stock) < 0
      ) {
        return res.status(400).json({
          message: "Please enter valid price, discount and stock values"
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
        stock: Number(stock),
        sizes,
        colors,
        images: uploadedImages,
        createdBy: req.currentUser._id,
      });

      res.status(201).json({
        message: "Product added successfully",
        product
      });
    } catch (error) {
      for (const image of uploadedImages) {
        await cloudinary.uploader.destroy(image.publicId).catch(() => {});
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
        colors
      } = req.body;

      const oldSellingPrice = getSellingPrice(product);


      // Calculate the updated price and discount
      const updatedPrice =
        price !== undefined ? Number(price) : product.price;

      const updatedDiscount =
        discountPrice !== undefined
          ? discountPrice === "" ? null : Number(discountPrice)
          : product.discountPrice;

      // Validate price and discount
      if (
        !Number.isFinite(updatedPrice) ||
        updatedPrice < 0 ||
        (updatedDiscount !== null &&
          (!Number.isFinite(updatedDiscount) ||
            updatedDiscount < 0 ||
            updatedDiscount > updatedPrice))
      ) {
        return res.status(400).json({
          message: "Please enter valid price and discount values"
        });
      }

      // Validate stock
      if (
        stock !== undefined &&
        (!Number.isInteger(Number(stock)) || Number(stock) < 0)
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

      // Validate sizes and colours
      const updatedSizes =
        sizes !== undefined ? parseArray(sizes) : product.sizes;

      const updatedColors =
        colors !== undefined ? parseArray(colors) : product.colors;

      if (updatedSizes.length === 0 || updatedColors.length === 0) {
        return res.status(400).json({
          message: "At least one size and colour are required"
        });
      }

      // Update product fields
      if (productName !== undefined) {
        product.productName = productName.trim();
      }

      if (description !== undefined) {
        product.description = description.trim();
      }

      if (category !== undefined) product.category = category;
      if (subCategory !== undefined) {
        product.subCategory = subCategory.trim();
      }
      if (brand !== undefined) product.brand = brand.trim();

      product.price = updatedPrice;
      product.discountPrice = updatedDiscount;

      if (stock !== undefined) {
        product.stock = Number(stock);
      }

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

    
      const newSellingPrice = getSellingPrice(product);

      if (newSellingPrice < oldSellingPrice) {
        try {
          await createPriceDropNotifications({
            product,
            oldPrice: oldSellingPrice,
            newPrice: newSellingPrice,
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
                console.error("Old image deletion error:", error);
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

      res.status(500).json({
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
