
import Cart from "../models/Cart.js";
import User from "../models/User.js";
import Wishlist from "../models/Wishlist.js";
import Notification from "../models/Notification.js";

// 2 minutes for testing for Add to cart
const CART_REMINDER_MINUTES = 2;

export const createCartReminderNotifications = async () => {
  const cutoff = new Date(
    Date.now() - CART_REMINDER_MINUTES * 60 * 1000
  );

  // Find non-empty carts inactive for 2 minutes
  const carts = await Cart.find({
    updatedAt: { $lte: cutoff },
    "items.0": { $exists: true },
  });

  let createdCount = 0;

  for (const cart of carts) {
    const customer = await User.exists({
  _id: cart.user,
  role: "customer",
});

if (!customer) continue;
    // Check whether the cart is still eligible
    const currentCart = await Cart.findOne({
      _id: cart._id,
      updatedAt: cart.updatedAt,
      "items.0": { $exists: true },
    });

    if (!currentCart) continue;

    // One notification per cart activity period
    const dedupeKey =
      `cart-reminder:${cart._id}:${cart.updatedAt.getTime()}`;

    const result = await Notification.updateOne(
      {
        user: cart.user,
        dedupeKey,
      },
      {
        $setOnInsert: {
          user: cart.user,
          title: "Your cart is waiting!",
          message:
            "You left something in your cart. Complete your shopping!",
          type: "cart",
          isRead: false,
          emailSent: false,
          link: "/cart",
          dedupeKey,
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      createdCount++;
    }
  }

  return createdCount;
};

//for wishlist
export const createWishlistReminderNotifications = async () => {
  // 2 minutes for testing
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);

  const wishlists = await Wishlist.find({
    updatedAt: { $lte: cutoff },
    "products.0": { $exists: true },
  });

  let createdCount = 0;

  for (const wishlist of wishlists) {
    const customer = await User.exists({
    _id: wishlist.user,
    role: "customer",
});

if (!customer) continue;
    // Verify wishlist has not changed
    const currentWishlist = await Wishlist.findOne({
      _id: wishlist._id,
      updatedAt: wishlist.updatedAt,
      "products.0": { $exists: true },
    });

    if (!currentWishlist) continue;

    const dedupeKey =
      `wishlist-reminder:${wishlist._id}:${wishlist.updatedAt.getTime()}`;

    const result = await Notification.updateOne(
      {
        user: wishlist.user,
        dedupeKey,
      },
      {
        $setOnInsert: {
          user: wishlist.user,
          title: "Your wishlist is waiting!",
          message:
            "Your favourite products are still waiting in your wishlist. Check them out!",
          type: "wishlist",
          isRead: false,
          emailSent: false,
          link: "/wishlist",
          dedupeKey,
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      createdCount++;
    }
  }

  return createdCount;
};

//Price drop Notification

export const createPriceDropNotifications = async ({
  product,
  oldPrice,
  newPrice,
}) => {
  if (
    !Number.isFinite(oldPrice) ||
    !Number.isFinite(newPrice) ||
    newPrice >= oldPrice
  ) {
    return 0;
  }

  const [wishlists, carts] = await Promise.all([
    Wishlist.find({ products: product._id }).select("user"),
    Cart.find({ "items.product": product._id }).select("user"),
  ]);

  // Avoid duplicates between cart and wishlist
  const customerIds = new Set();

  wishlists.forEach((wishlist) => {
    customerIds.add(wishlist.user.toString());
  });

  carts.forEach((cart) => {
    customerIds.add(cart.user.toString());
  });

  if (customerIds.size === 0) return 0;

  // Only include existing customer accounts
  const validCustomers = await User.find({
    _id: { $in: [...customerIds] },
    role: "customer",
  }).select("_id");

  if (validCustomers.length === 0) return 0;

  const eventKey =
    `price-drop:${product._id}:${product.updatedAt.getTime()}`;

  const notifications = validCustomers.map((customer) => ({
    user: customer._id,
    title: "Price Drop Alert!",
    message: `Good news! The price of ${product.productName} has dropped. Check it out now!`,
    type: "price_drop",
    product: product._id,
    isRead: false,
    emailSent: false,
    link: `/products/${product._id}`,
    dedupeKey: eventKey,
  }));

  try {
    const result = await Notification.bulkWrite(
      notifications.map((notification) => ({
        updateOne: {
          filter: {
            user: notification.user,
            dedupeKey: notification.dedupeKey,
          },
          update: {
            $setOnInsert: notification,
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    return result.upsertedCount || 0;
  } catch (error) {
    if (error.code === 11000) return 0;
    throw error;
  }
};


