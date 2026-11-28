import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AddressManager from "../components/AddressManger";
import { COLOR_OPTIONS } from "../constants/productOptions";

const API_URL = import.meta.env.VITE_API_URL;

// SABKOO CUSTOMER THEME
const THEME = {
  primary: "#07868B",
  primaryDark: "#084F55",
  light: "#EAF7F7",
  border: "#B9DFE0",
  background: "#F8F9FA",
};

// NORMALIZE PRODUCT OPTIONS
function normalizeOptions(value) {
  return [
    ...new Set(
      (
        Array.isArray(value)
          ? value
          : String(value || "").split(",")
      )
        .map((item) => String(item).trim())
        .filter(Boolean)
    ),
  ];
}

// CHECK VARIANT INVENTORY
function hasVariantInventory(product) {
  return (
    Array.isArray(product?.variants) &&
    product.variants.length > 0
  );
}

// GET AVAILABLE STOCK
function getAvailableStock(item) {
  const product = item.product;

  if (!product?._id) return 0;

  const size = item.size || "";
  const color = item.color || "";

  const sizes = normalizeOptions(product.sizes);
  const colors = normalizeOptions(product.colors);

  // VALIDATE SIZE
  if (
    (sizes.length > 0 && !sizes.includes(size)) ||
    (sizes.length === 0 && size !== "")
  ) {
    return 0;
  }

  // VALIDATE COLOUR
  if (
    (colors.length > 0 && !colors.includes(color)) ||
    (colors.length === 0 && color !== "")
  ) {
    return 0;
  }

  // VARIANT INVENTORY
  if (hasVariantInventory(product)) {
    const variant = product.variants.find(
      (variant) =>
        variant.size === size &&
        variant.color === color
    );

    const stock = Number(variant?.stock ?? 0);

    return Number.isSafeInteger(stock) && stock >= 0
      ? stock
      : 0;
  }

  // LEGACY INVENTORY
  const stock = Number(product.stock ?? 0);

  return Number.isSafeInteger(stock) && stock >= 0
    ? stock
    : 0;
}

// MAXIMUM ALLOWED QUANTITY
function getMaximumQuantity(item, cartItems) {
  const product = item.product;

  if (!product?._id) return 0;

  const availableStock = getAvailableStock(item);

  const hasVariants = hasVariantInventory(product);

  const otherCartQuantity = cartItems.reduce(
    (total, otherItem) => {
      if (
        String(otherItem._id) === String(item._id)
      ) {
        return total;
      }

      if (
        String(otherItem.product?._id) !==
        String(product._id)
      ) {
        return total;
      }

      // ONLY COUNT MATCHING VARIANTS
      if (
        hasVariants &&
        (
          (otherItem.size || "") !==
            (item.size || "") ||
          (otherItem.color || "") !==
            (item.color || "")
        )
      ) {
        return total;
      }

      return total + Number(otherItem.quantity || 0);
    },
    0
  );

  return Math.max(
    0,
    availableStock - otherCartQuantity
  );
}

// CHECK STOCK ISSUE
function hasInsufficientStock(item, cartItems) {
  const quantity = Number(item.quantity);

  const maximumQuantity = getMaximumQuantity(
    item,
    cartItems
  );

  return (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    maximumQuantity <= 0 ||
    quantity > maximumQuantity
  );
}

// GET COLOUR SWATCH
function getColorHex(colorName) {
  const color = COLOR_OPTIONS.find(
    (item) =>
      item.name.toLowerCase() ===
      String(colorName).toLowerCase()
  );

  return color?.hex || "#E9ECEF";
}

// GET SELECTED COLOUR'S PRIMARY IMAGE
function getProductImage(product, selectedColor) {
  const allImages = Array.isArray(product?.images)
    ? product.images.filter((image) => image?.url)
    : [];

  const normalizeColor = (color) =>
    String(color || "").trim().toLowerCase();

  const matchingImages = allImages.filter(
    (image) =>
      normalizeColor(image.color) ===
      normalizeColor(selectedColor)
  );

  const legacyImages = allImages.filter(
    (image) => !normalizeColor(image.color)
  );

  const selectedImages = selectedColor
    ? matchingImages.length > 0
      ? matchingImages
      : legacyImages
    : allImages;

  const sortedImages = [...selectedImages].sort(
    (a, b) =>
      Number(Boolean(b.isPrimary)) -
        Number(Boolean(a.isPrimary)) ||
      Number(a.sortOrder ?? 0) -
        Number(b.sortOrder ?? 0)
  );

  return (
    sortedImages[0]?.url ||
    "https://placehold.co/100x120?text=Product"
  );
}

// GET PRODUCT SELLING PRICE
function getProductPrice(product) {
  return Number(
    product?.discountPrice ??
    product?.price ??
    0
  );
}

// CALCULATE SUBTOTAL
function calculateSubtotal(items) {
  return items.reduce(
    (total, item) =>
      total +
      getProductPrice(item.product) *
        Number(item.quantity || 0),
    0
  );
}

// CHECK WHETHER CHECKOUT ITEMS OR PRICES CHANGED
function getCheckoutSignature(items) {
  return JSON.stringify(
    items
      .map((item) => ({
        id: String(item._id),
        product: String(item.product?._id),
        size: item.size || "",
        color: item.color || "",
        quantity: Number(item.quantity),
        price: getProductPrice(item.product),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

function Checkout() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  // =====================================
  // CHECKOUT MODE
  // =====================================

  const checkoutMode =
    searchParams.get("mode") || "cart";

  const isBuyNow = checkoutMode === "buyNow";

  const buyNowProductId =
    searchParams.get("productId") || "";

  const buyNowQuantity = Number(
    searchParams.get("quantity")
  );

  const buyNowSize =
    searchParams.get("size") || "";

  const buyNowColor =
    searchParams.get("color") || "";

  const returnPath = isBuyNow && buyNowProductId
    ? `/products/${encodeURIComponent(buyNowProductId)}`
    : "/cart";

  const returnLabel = isBuyNow
    ? "Return to Product"
    : "Return to Shopping Bag";

  // =====================================
  // CHECKOUT ITEMS
  // =====================================

  const [cartItems, setCartItems] = useState([]);

  const [cartLoading, setCartLoading] =
    useState(true);

  const [cartError, setCartError] =
    useState("");

  // DELIVERY ADDRESSES
  const [savedAddresses, setSavedAddresses] =
    useState([]);

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] = useState("");

  const [addressReady, setAddressReady] =
    useState(false);

  const [addressError, setAddressError] =
    useState("");

  // PAYMENT
  const [paymentMethod, setPaymentMethod] =
    useState("COD");

  // ORDER
  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [orderError, setOrderError] =
    useState("");

  const [orderUncertain, setOrderUncertain] =
    useState(false);

  // PREVENT RAPID DUPLICATE SUBMISSIONS
  const orderInProgress = useRef(false);

  // =====================================
  // HANDLE EXPIRED LOGIN
  // =====================================

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.dispatchEvent(
      new Event("authUpdated")
    );

    navigate("/signin", {
      replace: true,

      state: {
        from: `/checkout${window.location.search}`,
      },
    });
  }, [navigate]);

  // =====================================
  // FETCH CART OR BUY NOW PRODUCT
  // =====================================

  const fetchCart = useCallback(
    async (signal, silent = false) => {
      const token = localStorage.getItem("token");

      if (!token) {
        handleUnauthorized();
        return null;
      }

      try {
        if (!silent) {
          setCartLoading(true);
        }

        setCartError("");

        if (
          !["cart", "buyNow"].includes(checkoutMode)
        ) {
          throw new Error("Invalid checkout mode.");
        }

        let items = [];

        // =====================================
        // BUY NOW CHECKOUT
        // =====================================

        if (isBuyNow) {
          if (
            !/^[a-fA-F0-9]{24}$/.test(
              buyNowProductId
            ) ||
            !Number.isSafeInteger(buyNowQuantity) ||
            buyNowQuantity < 1
          ) {
            throw new Error(
              "Invalid Buy Now product details."
            );
          }

          const response = await fetch(
            `${API_URL}/api/products/${encodeURIComponent(
              buyNowProductId
            )}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },

              signal,
              cache: "no-store",
            }
          );

          const data = await response.json();

          if (signal?.aborted) return null;

          if (response.status === 401) {
            handleUnauthorized();
            return null;
          }

          if (!response.ok) {
            throw new Error(
              data.message ||
              "Failed to load selected product."
            );
          }

          const product =
            data.product || data.data || data;

          if (
            !product?._id ||
            String(product._id) !== buyNowProductId
          ) {
            throw new Error("Product not found.");
          }

          // CREATE TEMPORARY CHECKOUT ITEM
          // NOTHING IS SAVED TO MONGODB CART

          items = [
            {
              _id: `buy-now-${product._id}`,

              product,

              quantity: buyNowQuantity,
              size: buyNowSize,
              color: buyNowColor,
            },
          ];
        }

        // =====================================
        // NORMAL CART CHECKOUT
        // =====================================

        else {
          const response = await fetch(
            `${API_URL}/api/cart`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },

              signal,
              cache: "no-store",
            }
          );

          const data = await response.json();

          if (signal?.aborted) return null;

          if (response.status === 401) {
            handleUnauthorized();
            return null;
          }

          if (!response.ok) {
            throw new Error(
              data.message || "Failed to load cart."
            );
          }

          items = Array.isArray(data.items)
            ? data.items
            : [];
        }

        if (signal?.aborted) return null;

        setCartItems(items);

        // REDIRECT ONLY FOR EMPTY NORMAL CART
        if (
          !isBuyNow &&
          items.length === 0 &&
          !silent
        ) {
          navigate("/cart", {
            replace: true,
          });
        }

        return items;

      } catch (error) {
        if (
          error.name !== "AbortError" &&
          !signal?.aborted
        ) {
          setCartItems([]);

          setCartError(
            error.message ||
            "Unable to load checkout details."
          );
        }

        return null;

      } finally {
        if (!signal?.aborted && !silent) {
          setCartLoading(false);
        }
      }
    },

    [
      navigate,
      handleUnauthorized,
      checkoutMode,
      isBuyNow,
      buyNowProductId,
      buyNowQuantity,
      buyNowSize,
      buyNowColor,
    ]
  );

  // INITIAL CHECKOUT FETCH
  useEffect(() => {
    const controller = new AbortController();

    setOrderError("");

    fetchCart(controller.signal);

    return () => controller.abort();

  }, [fetchCart]);

  // =====================================
  // DELIVERY ADDRESS FUNCTIONS
  // =====================================

  const handleAddressesChange = useCallback(
    (updatedAddresses) => {
      setSavedAddresses(
        Array.isArray(updatedAddresses)
          ? updatedAddresses
          : []
      );

      setAddressReady(true);
      setAddressError("");
    },
    []
  );

  const handleSelectAddress = useCallback(
    (id) => {
      setSelectedAddressId(id);
      setAddressError("");
    },
    []
  );

  // CHECKOUT SUBTOTAL
  const subtotal = calculateSubtotal(cartItems);

  // TOTAL ITEMS
  const totalItems = cartItems.reduce(
    (total, item) =>
      total + Number(item.quantity || 0),
    0
  );

  // SELECTED ADDRESS
  const selectedAddress = savedAddresses.find(
    (item) => item._id === selectedAddressId
  );

  // CHECK STOCK
  const hasStockIssues = cartItems.some(
    (item) =>
      hasInsufficientStock(item, cartItems)
  );

  // =====================================
  // PLACE ORDER
  // =====================================

  async function handlePlaceOrder() {
    if (
      orderInProgress.current ||
      placingOrder ||
      cartLoading ||
      cartError ||
      orderUncertain
    ) {
      return;
    }

    setAddressError("");
    setOrderError("");

    // VALIDATE ADDRESS
    if (!selectedAddress) {
      setAddressError(
        "Please select a delivery address."
      );

      return;
    }

    // VALIDATE PAYMENT METHOD
    if (paymentMethod !== "COD") {
      setOrderError(
        "Please select a valid payment method."
      );

      return;
    }

    // VALIDATE CHECKOUT ITEMS
    if (cartItems.length === 0) {
      setOrderError(
        isBuyNow
          ? "No product selected for checkout."
          : "Your shopping bag is empty."
      );

      return;
    }

    // VALIDATE CURRENT STOCK
    if (hasStockIssues) {
      setOrderError(
        isBuyNow
          ? "The selected product or quantity is unavailable. Please return to the product page."
          : "Some products have insufficient stock. Please update your shopping bag."
      );

      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      handleUnauthorized();
      return;
    }

    // LOCK ORDER SUBMISSION
    orderInProgress.current = true;

    setPlacingOrder(true);

    let orderRequestSent = false;
    let definitiveResponse = false;

    try {
      // FETCH LATEST INVENTORY
      const latestItems = await fetchCart(
        undefined,
        true
      );

      if (!latestItems) {
        setOrderError(
          "Unable to verify your latest checkout details. Please try again."
        );

        return;
      }

      if (latestItems.length === 0) {
        setOrderError(
          isBuyNow
            ? "Selected product is unavailable."
            : "Your shopping bag is empty."
        );

        return;
      }

      // CHECK LATEST STOCK
      const latestStockIssues = latestItems.some(
        (item) =>
          hasInsufficientStock(item, latestItems)
      );

      if (latestStockIssues) {
        setOrderError(
          isBuyNow
            ? "Product availability has changed. Please return to the product page and select an available quantity."
            : "Product availability has changed. Please return to your cart and update the quantities."
        );

        return;
      }

      // CALCULATE LATEST TOTAL
      const latestSubtotal =
        calculateSubtotal(latestItems);

      if (
        !Number.isFinite(latestSubtotal) ||
        latestSubtotal < 0 ||
        latestItems.some(
          (item) =>
            !Number.isFinite(
              getProductPrice(item.product)
            ) ||
            getProductPrice(item.product) < 0
        )
      ) {
        setOrderError("Invalid order amount.");
        return;
      }

      // CHECK PRODUCT DETAILS AND PRICE CHANGES
      if (
        getCheckoutSignature(latestItems) !==
        getCheckoutSignature(cartItems)
      ) {
        setOrderError(
          "Product details or prices have changed. Please review the updated order summary before placing your order."
        );

        return;
      }

      // COD CONFIRMATION
      const confirmed = window.confirm(
        "Confirm your Cash on Delivery order?\n\n" +
        `Total Amount: ₹${latestSubtotal.toLocaleString(
          "en-IN"
        )}\n\n` +
        "You will pay when your order is delivered.\n\n" +
        "Click OK to place your order."
      );

      if (!confirmed) return;

      // =====================================
      // PREPARE ORDER REQUEST
      // =====================================

      const orderPayload = {
        addressId: selectedAddress._id,
        paymentMethod: "COD",

        checkoutMode: isBuyNow
          ? "buyNow"
          : "cart",
      };

      // SEND SELECTED PRODUCT ONLY FOR BUY NOW
      if (isBuyNow) {
        orderPayload.buyNowItem = {
          productId: buyNowProductId,
          quantity: buyNowQuantity,
          size: buyNowSize,
          color: buyNowColor,
        };
      }

      // =====================================
      // CALL ORDER API
      // =====================================

      orderRequestSent = true;

      const response = await fetch(
        `${API_URL}/api/orders`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify(orderPayload),
        }
      );

      if (response.status === 401) {
        definitiveResponse = true;

        handleUnauthorized();

        return;
      }

      const data = await response.json();

      // HANDLE ORDER FAILURE
      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error(
            "Unable to confirm whether your order was placed."
          );
        }

        definitiveResponse = true;

        setOrderError(
          data.message ||
          "Unable to place order."
        );

        // REFRESH STOCK INFORMATION
        if (
          response.status === 400 ||
          response.status === 409
        ) {
          await fetchCart(undefined, true);
        }

        return;
      }

      if (!data.order?._id) {
        throw new Error(
          "Unable to verify the order response."
        );
      }

      definitiveResponse = true;

      // CLEAR LOCAL CHECKOUT ITEMS
      setCartItems([]);

      // UPDATE NAVBAR CART COUNT
      // ONLY FOR NORMAL CART CHECKOUT
      if (!isBuyNow) {
        window.dispatchEvent(
          new Event("cartUpdated")
        );
      }

      // NAVIGATE TO ORDER SUCCESS
      navigate("/order-success", {
        replace: true,

        state: {
          order: data.order,
        },
      });

    } catch (error) {
      console.error(
        "Place order error:",
        error
      );

      // NETWORK FAILURE AFTER ORDER REQUEST
      if (
        orderRequestSent &&
        !definitiveResponse
      ) {
        setOrderUncertain(true);

        setOrderError(
          "We could not confirm your order status. Please check your order history before attempting to place another order."
        );

      } else {
        setOrderError(
          error.message ||
          "Unable to place order. Please try again."
        );
      }

    } finally {
      orderInProgress.current = false;

      setPlacingOrder(false);
    }
  }

  // =====================================
  // CHECKOUT UI
  // =====================================

  return (
    <div className="bg-light min-vh-100 w-100">

      <Navbar />

      <main className="container pt-3 pt-lg-4 pb-5">

        {/* BREADCRUMB */}
        <nav aria-label="breadcrumb">

          <ol className="breadcrumb small">

            <li className="breadcrumb-item">

              <Link
                to="/"
                className="text-secondary text-decoration-none"
              >
                Home
              </Link>

            </li>

            <li className="breadcrumb-item">

              <Link
                to={returnPath}
                className="text-secondary text-decoration-none"
              >
                {isBuyNow ? "Product" : "Cart"}
              </Link>

            </li>

            <li
              className="breadcrumb-item active"
              aria-current="page"
            >
              Checkout
            </li>

          </ol>

        </nav>

        {/* PAGE HEADING */}
        <div className="mb-4 text-center">

          <h2
            className="fw-bold"
            style={{
              color: THEME.primary,
            }}
          >
            Checkout
          </h2>

          <p className="text-secondary mb-2">
            Select your delivery address to continue.
          </p>

          {/* BUY NOW INFORMATION */}
          {isBuyNow && (
            <span
              className="badge rounded-pill px-3 py-2"
              style={{
                backgroundColor: THEME.light,
                color: THEME.primaryDark,
                border: `1px solid ${THEME.border}`,
              }}
            >
              <i className="bi bi-lightning-charge me-1"></i>

              Direct Purchase
            </span>
          )}

        </div>

        {/* STOCK WARNING */}
        {!cartLoading && hasStockIssues && (
          <div className="alert alert-warning text-start">

            <h6 className="fw-bold">

              <i className="bi bi-exclamation-triangle me-2"></i>

              Product availability has changed

            </h6>

            <p className="mb-2">
              {isBuyNow
                ? "The selected product or quantity is unavailable. Please update your selection."
                : "Some items in your shopping bag have insufficient stock. Please update your quantities before placing an order."}
            </p>

            <Link
              to={returnPath}
              className="btn btn-sm btn-outline-dark"
            >
              {returnLabel}
            </Link>

          </div>
        )}

        {/* LOADING STATE */}
        {cartLoading ? (

          <div className="bg-white border rounded-3 text-center p-5">

            <div
              className="spinner-border"
              style={{
                color: THEME.primary,
              }}
              role="status"
            >
              <span className="visually-hidden">
                Loading...
              </span>
            </div>

            <p className="text-secondary mt-3 mb-0">
              Loading your checkout details...
            </p>

          </div>

        ) : cartError ? (

          /* ERROR STATE */
          <div className="alert alert-danger">

            <p className="mb-3">
              {cartError}
            </p>

            <div className="d-flex flex-wrap justify-content-center gap-2">

              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => fetchCart()}
                disabled={placingOrder}
              >
                Retry
              </button>

              <Link
                to={returnPath}
                className="btn btn-outline-dark"
              >
                {returnLabel}
              </Link>

            </div>

          </div>

        ) : cartItems.length === 0 ? (

          /* EMPTY CHECKOUT */
          <div className="bg-white border rounded-3 text-center p-5">

            <i
              className="bi bi-bag-x display-4"
              style={{
                color: THEME.primary,
              }}
            ></i>

            <h5 className="fw-bold mt-3">
              No items available for checkout
            </h5>

            <Link
              to={returnPath}
              className="btn text-white mt-3"
              style={{
                backgroundColor: THEME.primary,
              }}
            >
              {returnLabel}
            </Link>

          </div>

        ) : (

          <div className="row g-4">

            {/* ===================================== */}
            {/* LEFT SIDE */}
            {/* ===================================== */}

            <div className="col-12 col-lg-8">

              {/* DELIVERY ADDRESS */}
              <fieldset
                disabled={placingOrder}
                className="mb-4"
              >

                <AddressManager
                  mode="checkout"
                  selectedAddressId={
                    selectedAddressId
                  }
                  onSelectAddress={
                    handleSelectAddress
                  }
                  onAddressesChange={
                    handleAddressesChange
                  }
                />

              </fieldset>

              {/* PAYMENT METHOD */}
              <div className="bg-white border rounded-3 p-3 p-md-4 text-start">

                <h5 className="fw-bold mb-4">

                  <i
                    className="bi bi-credit-card me-2"
                    style={{
                      color: THEME.primary,
                    }}
                  ></i>

                  Payment Method

                </h5>

                <div
                  className="rounded-3 p-3"
                  style={{
                    backgroundColor: THEME.light,

                    border: `1px solid ${THEME.border}`,
                  }}
                >

                  <div className="form-check">

                    <input
                      type="radio"
                      className="form-check-input"
                      name="paymentMethod"
                      id="cod"
                      checked={
                        paymentMethod === "COD"
                      }
                      onChange={() =>
                        setPaymentMethod("COD")
                      }
                      disabled={placingOrder}
                    />

                    <label
                      className="form-check-label fw-semibold"
                      htmlFor="cod"
                    >

                      <i className="bi bi-cash-coin me-2"></i>

                      Cash on Delivery (COD)

                    </label>

                  </div>

                  <p className="small text-secondary mt-2 mb-0 ms-4">
                    Pay when your order is delivered.
                  </p>

                </div>

              </div>

            </div>

            {/* ===================================== */}
            {/* RIGHT SIDE - ORDER SUMMARY */}
            {/* ===================================== */}

            <div className="col-12 col-lg-4">

              <div className="bg-white border rounded-3 p-3 p-md-4 text-start">

                <h5 className="fw-bold mb-4">

                  <i
                    className="bi bi-bag-check me-2"
                    style={{
                      color: THEME.primary,
                    }}
                  ></i>

                  Order Summary ({totalItems}{" "}
                  {totalItems === 1
                    ? "item"
                    : "items"})

                </h5>

                {/* BUY NOW MESSAGE */}
                {isBuyNow && (
                  <div
                    className="rounded-3 p-3 small mb-3"
                    style={{
                      backgroundColor: THEME.light,
                      color: THEME.primaryDark,
                      border: `1px solid ${THEME.border}`,
                    }}
                  >

                    <i className="bi bi-info-circle me-2"></i>

                    You are purchasing this product
                    directly. Your shopping bag will
                    remain unchanged.

                  </div>
                )}

                {/* CHECKOUT PRODUCTS */}
                {cartItems.map((item) => {
                  const product =
                    item.product || {};

                  const price =
                    getProductPrice(product);

                  const quantity = Number(
                    item.quantity || 0
                  );

                  const availableStock =
                    getAvailableStock(item);

                  const maximumQuantity =
                    getMaximumQuantity(
                      item,
                      cartItems
                    );

                  const insufficientStock =
                    hasInsufficientStock(
                      item,
                      cartItems
                    );

                  // GET CORRECT COLOUR IMAGE
                  const image = getProductImage(
                    product,
                    item.color
                  );

                  return (
                    <div
                      key={item._id}
                      className="d-flex gap-3 mb-3 pb-3 border-bottom"
                    >

                      {/* PRODUCT IMAGE */}
                      <img
                        src={image}
                        alt={
                          product.productName ||
                          "Product"
                        }
                        className="rounded border flex-shrink-0"
                        style={{
                          width: "75px",
                          height: "95px",
                          objectFit: "contain",
                          backgroundColor:
                            THEME.background,
                        }}
                      />

                      {/* PRODUCT DETAILS */}
                      <div
                        className="flex-grow-1"
                        style={{
                          minWidth: 0,
                        }}
                      >

                        <h6 className="small fw-bold mb-1 text-break">
                          {product.productName ||
                            "Unavailable Product"}
                        </h6>

                        {product.brand && (
                          <p className="small text-secondary mb-1">
                            {product.brand}
                          </p>
                        )}

                        <p className="small text-secondary mb-1">

                          Qty: {quantity}

                          {item.size &&
                            ` | Size: ${item.size}`}

                        </p>

                        {/* SELECTED COLOUR */}
                        {item.color && (
                          <div className="d-flex align-items-center flex-wrap gap-2 small text-secondary mb-1">

                            Colour:

                            <span
                              className="rounded-circle flex-shrink-0"
                              style={{
                                width: "14px",
                                height: "14px",

                                background:
                                  getColorHex(
                                    item.color
                                  ),

                                border:
                                  "1px solid #CCC",
                              }}
                            />

                            {item.color}

                          </div>
                        )}

                        {/* PRICE */}
                        <span className="fw-semibold small">

                          ₹
                          {(
                            price * quantity
                          ).toLocaleString("en-IN")}

                        </span>

                        {/* STOCK STATUS */}
                        {insufficientStock ? (

                          <p className="small text-danger fw-semibold mt-2 mb-0">

                            <i className="bi bi-exclamation-circle me-1"></i>

                            {availableStock === 0
                              ? "Unavailable or out of stock"
                              : `Only ${maximumQuantity} item(s) available`}

                          </p>

                        ) : (

                          <p className="small text-success mt-2 mb-0">

                            <i className="bi bi-check-circle me-1"></i>

                            In Stock

                          </p>

                        )}

                      </div>

                    </div>
                  );
                })}

                {/* TOTAL ITEMS */}
                <div className="d-flex justify-content-between mb-3">

                  <span className="text-secondary">
                    Total Items
                  </span>

                  <span>
                    {totalItems}
                  </span>

                </div>

                {/* SUBTOTAL */}
                <div className="d-flex justify-content-between mb-3">

                  <span className="text-secondary">
                    Subtotal
                  </span>

                  <span>
                    ₹
                    {subtotal.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                </div>

                {/* DELIVERY */}
                <div className="d-flex justify-content-between mb-3">

                  <span className="text-secondary">
                    Delivery
                  </span>

                  <span className="text-success fw-semibold">
                    FREE
                  </span>

                </div>

                <hr />

                {/* TOTAL AMOUNT */}
                <div
                  className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3 rounded-3 mb-4"
                  style={{
                    backgroundColor: THEME.light,

                    color: THEME.primaryDark,
                  }}
                >

                  <h6 className="fw-bold mb-0">
                    Total Amount
                  </h6>

                  <h5 className="fw-bold mb-0">

                    ₹
                    {subtotal.toLocaleString(
                      "en-IN"
                    )}

                  </h5>

                </div>

                {/* ADDRESS ERROR */}
                {addressError && (
                  <div className="alert alert-danger small">
                    {addressError}
                  </div>
                )}

                {/* ORDER ERROR */}
                {orderError && (
                  <div className="alert alert-danger small">
                    {orderError}
                  </div>
                )}

                {/* UNCERTAIN ORDER STATUS */}
                {orderUncertain && (
                  <p className="small text-danger">
                    Check your existing orders from
                    your account before trying again.
                  </p>
                )}

                {/* STOCK ISSUE */}
                {hasStockIssues && (
                  <div className="alert alert-warning small">

                    Resolve stock issues before
                    placing your order.

                    <Link
                      to={returnPath}
                      className="d-block mt-2 fw-semibold text-dark"
                    >
                      {returnLabel}
                    </Link>

                  </div>
                )}

                {/* PLACE ORDER BUTTON */}
                <button
                  type="button"
                  className="btn w-100 py-3 fw-semibold text-white rounded-3"
                  style={{
                    backgroundColor:
                      hasStockIssues ||
                      orderUncertain
                        ? "#999999"
                        : THEME.primary,
                  }}
                  onClick={handlePlaceOrder}
                  disabled={
                    placingOrder ||
                    cartLoading ||
                    Boolean(cartError) ||
                    cartItems.length === 0 ||
                    !addressReady ||
                    !selectedAddress ||
                    hasStockIssues ||
                    orderUncertain
                  }
                >

                  {placingOrder ? (

                    <>

                      <span className="spinner-border spinner-border-sm me-2"></span>

                      PROCESSING ORDER...

                    </>

                  ) : (

                    <>

                      <i className="bi bi-bag-check me-2"></i>

                      PLACE ORDER

                    </>

                  )}

                </button>

                {!addressReady && (
                  <p className="small text-secondary text-center mt-2">
                    Loading delivery addresses...
                  </p>
                )}

                <p className="small text-secondary text-center mt-3 mb-0">

                  <i className="bi bi-shield-check me-1"></i>

                  Secure checkout

                </p>

              </div>

            </div>

          </div>

        )}

      </main>

      <Footer showSocial={false} />

    </div>
  );
}

export default Checkout;