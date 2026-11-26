import crypto from "crypto";
import bcrypt from "bcryptjs";
import transporter from "../config/email.js";
import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import mongoose from "mongoose";
import Wishlist from "../models/Wishlist.js";
import Cart from "../models/Cart.js";
import AdminInvitation from "../models/AdminInvitation.js";

const router = express.Router();
// GET LOGGED-IN ADMIN PROFILE
router.get(
  "/profile",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const admin = await User.findById(req.user.userId)
        .select("name email mobile role isVerified createdAt");

      if (!admin) {
        return res.status(404).json({
          message: "Admin account not found.",
        });
      }

      res.status(200).json({
        message: "Admin profile fetched successfully.",
        admin,
      });
    } catch (error) {
      console.error("Get admin profile error:", error);

      res.status(500).json({
        message: "Unable to fetch admin profile.",
      });
    }
  }
);

// UPDATE LOGGED-IN ADMIN NAME
router.patch(
  "/profile",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { name } = req.body;

      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 60
      ) {
        return res.status(400).json({
          message: "Name must contain between 2 and 60 characters.",
        });
      }

      const admin = await User.findByIdAndUpdate(
        req.user.userId,
        { $set: { name: name.trim() } },
        { new: true, runValidators: true }
      ).select("name email role");

      if (!admin) {
        return res.status(404).json({
          message: "Admin account not found.",
        });
      }

      res.status(200).json({
        message: "Admin name updated successfully.",
        admin,
      });
    } catch (error) {
      console.error("Update admin profile error:", error);

      res.status(500).json({
        message: "Unable to update admin profile.",
      });
    }
  }
);

// GET ALL USERS (CUSTOMERS AND VENDORS)
router.get(
  "/users",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const users = await User.find()
        .select("name email mobile role vendorDetails isVerified createdAt")
        .sort({ createdAt: -1 });

      res.status(200).json({
        message: "Users fetched successfully",
        totalUsers: users.length,
        users
      });

    } catch (error) {
      res.status(500).json({
        message: "Error fetching users",
        error: error.message
      });
    }
  }
);


// GET ALL VENDORS
router.get(
  "/vendors",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const vendors = await User.find({ role: "vendor" })
        .select("name email mobile role vendorDetails isVerified createdAt")
        .sort({ createdAt: -1 });

      res.status(200).json({
        message: "Vendors fetched successfully",
        totalVendors: vendors.length,
        vendors
      });

    } catch (error) {
      res.status(500).json({
        message: "Error fetching vendors",
        error: error.message
      });
    }
  }
);


 // DELETE CUSTOMER OR VENDOR
router.delete(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Validate MongoDB User ID
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          message: "Invalid User ID"
        });
      }

      // Find the user
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      // Only customers and vendors can be deleted
      if (!["customer", "vendor"].includes(user.role)) {
        return res.status(403).json({
          message: "Admin accounts cannot be deleted using this API"
        });
      }

      // If the user is a vendor, delete their products
      if (user.role === "vendor") {
        const products = await Product.find({
          createdBy: user._id
        });

        // Delete product images from Cloudinary
        for (const product of products) {
          for (const image of product.images) {
            if (image.publicId) {
              try {
                await cloudinary.uploader.destroy(image.publicId);
              } catch (error) {
                console.error(
                  "Cloudinary image deletion failed:",
                  error.message
                );
              }
            }
          }
        }

        // Delete vendor's products from MongoDB
        await Product.deleteMany({
          createdBy: user._id
        });
      }

      // Delete the customer or vendor account
      await user.deleteOne();

      res.status(200).json({
        message: `${user.role} deleted successfully`
      });

    } catch (error) {
      res.status(500).json({
        message: "Error deleting user",
        error: error.message
      });
    }
  }
);


const wishlistAdminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Access denied. Admin only.",
    });
  }

  next();
};

// GET ALL CUSTOMERS' WISHLISTS
router.get(
  "/wishlists",
  authMiddleware,
  wishlistAdminOnly,
  async (req, res) => {
    try {
      const customers = await User.find({
        role: "customer",
      }).select("_id name email");

      const wishlists = await Wishlist.find({
        user: { $in: customers.map(c => c._id) },
      }).populate("products");

      const result = customers.map(customer => {
        const wishlist = wishlists.find(
          w => w.user.toString() === customer._id.toString()
        );

        return {
          customer: {
            _id: customer._id,
            name: customer.name,
            email: customer.email,
          },
          products: wishlist?.products.filter(Boolean) || [],
        };
      });

      res.json({ customers: result });
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch customer wishlists.",
      });
    }
  }
);

// GET SELECTED CUSTOMER'S WISHLIST
router.get(
  "/customers/:customerId/wishlist",
  authMiddleware,
  wishlistAdminOnly,
  async (req, res) => {
    try {
      const { customerId } = req.params;

      if (!mongoose.isValidObjectId(customerId)) {
        return res.status(400).json({
          message: "Invalid customer ID.",
        });
      }

      const customer = await User.findOne({
        _id: customerId,
        role: "customer",
      }).select("_id name email");

      if (!customer) {
        return res.status(404).json({
          message: "Customer not found.",
        });
      }

      const wishlist = await Wishlist.findOne({
        user: customerId,
      }).populate("products");

      res.json({
        customer,
        products: wishlist?.products.filter(Boolean) || [],
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch customer wishlist.",
      });
    }
  }
);

// GET SELECTED CUSTOMER'S CART - ADMIN ONLY
router.get("/customers/:customerId/cart", authMiddleware,adminMiddleware, async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({
        message: "Invalid customer ID.",
      });
    }

    const cart = await Cart.findOne({
      user: customerId,
    }).populate("items.product");

    res.status(200).json({
      items: cart?.items || [],
    });
  } catch (error) {
    console.error("Admin get customer cart error:", error);

    res.status(500).json({
      message: "Unable to fetch customer cart.",
    });
  }
});


// INVITE NEW ADMIN - ADMIN ONLY
router.post(
  "/invite",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { email } = req.body ?? {};

      // 1. Validate email
      if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ) {
        return res.status(400).json({
          message: "Please enter a valid email address.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // 2. Check whether account already exists
      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        return res.status(409).json({
          message: "An account with this email already exists.",
        });
      }

      // 3. Check whether invitation already exists
      const existingInvitation = await AdminInvitation.findOne({
        email: normalizedEmail,
      });

      if (existingInvitation) {
        return res.status(409).json({
          message: "An invitation already exists for this email.",
        });
      }

      // 4. Generate invitation token
      const inviteToken = crypto.randomBytes(32).toString("hex");

      // 5. Hash token before saving
      const hashedInviteToken = crypto
        .createHash("sha256")
        .update(inviteToken)
        .digest("hex");

      // 6. Set invitation expiry (24 hours)
      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

      // 7. Store invitation in MongoDB
      const invitation = await AdminInvitation.create({
        email: normalizedEmail,
        tokenHash: hashedInviteToken,
        expiresAt,
        invitedBy: req.user.userId,
      });

      // 8. Generate invitation link
      const inviteLink =
        `${process.env.CLIENT_URL}/accept-admin-invite?token=${inviteToken}`;

      // 9. Send invitation email
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: normalizedEmail,
          subject: "Invitation to Join Sabkoo as Admin",
          text:
            `You have been invited to join Sabkoo as an administrator. ` +
            `Accept your invitation here: ${inviteLink}. ` +
            `This link expires in 24 hours.`,
        });
      } catch (emailError) {
        await invitation.deleteOne();

        console.error("Admin invitation email error:", emailError);

        return res.status(500).json({
          message: "Unable to send invitation email.",
        });
      }

      return res.status(201).json({
        message: "Admin invitation sent successfully.",
      });

    } catch (error) {
      console.error("Create admin invitation error:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "An invitation already exists for this email.",
        });
      }

      return res.status(500).json({
        message: "Unable to create admin invitation.",
      });
    }
  }
);


// ACCEPT ADMIN INVITATION
// Public endpoint - protected by the invitation token
router.post("/accept-invite", async (req, res) => {
  try {
    const { token, name, password } = req.body;

    // 1. Validate required fields
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token) ||
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 60 ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Enter a valid invitation token, name, and password (minimum 8 characters).",
      });
    }

    // 2. Hash the received token
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 3. Find an invitation that has not expired
    const invitation = await AdminInvitation.findOne({
      tokenHash: hashedToken,
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return res.status(400).json({
        message: "Invalid or expired invitation link.",
      });
    }

    // 4. Check whether the email is already registered
    const existingUser = await User.findOne({
      email: invitation.email,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    // 5. Hash the new admin's password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Atomically claim the invitation
    // Only one request can claim this invitation
    const claimedInvitation = await AdminInvitation.findOneAndDelete({
      _id: invitation._id,
      tokenHash: hashedToken,
      expiresAt: { $gt: new Date() },
    });

    if (!claimedInvitation) {
      return res.status(400).json({
        message: "This invitation has already been used or expired.",
      });
    }

    // 7. Create the new admin account
    try {
      await User.create({
        name: name.trim(),
        email: claimedInvitation.email,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
      });
    } catch (createError) {
      // Restore the invitation if account creation failed
      // and no other account was created with this email.
      if (createError.code !== 11000) {
        try {
          await AdminInvitation.create({
            email: claimedInvitation.email,
            tokenHash: claimedInvitation.tokenHash,
            expiresAt: claimedInvitation.expiresAt,
            invitedBy: claimedInvitation.invitedBy,
          });
        } catch (restoreError) {
          console.error(
            "Unable to restore admin invitation:",
            restoreError
          );
        }
      }

      throw createError;
    }

    // 8. Return success response
    return res.status(201).json({
      message: "Admin account created successfully. Please sign in.",
    });

  } catch (error) {
    console.error("Accept admin invitation error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    return res.status(500).json({
      message: "Unable to accept admin invitation.",
    });
  }
});


export default router;

