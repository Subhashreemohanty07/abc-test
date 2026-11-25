
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link, useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AddressManager from "../components/AddressManger";
import { COLOR_OPTIONS } from "../constants/productOptions";

const API_URL = import.meta.env.VITE_API_URL;

// NORMALIZE PRODUCT OPTIONS
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

// CHECK VARIANT INVENTORY
function hasVariantInventory(product) {
  return (
    Array.isArray(product.variants) &&
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

      // Only count matching variants
      if (
        hasVariants &&
        (
          (otherItem.size || "") !== (item.size || "") ||
          (otherItem.color || "") !== (item.color || "")
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

function Checkout() {
  const navigate = useNavigate();

  // CART
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState("");

  // DELIVERY ADDRESSES
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressReady, setAddressReady] = useState(false);
  const [addressError, setAddressError] = useState("");

  // PAYMENT
  const [paymentMethod, setPaymentMethod] = useState("COD");

  // ORDER
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderUncertain, setOrderUncertain] = useState(false);

  // PREVENT RAPID DUPLICATE SUBMISSIONS
  const orderInProgress = useRef(false);

  // HANDLE EXPIRED LOGIN
  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.dispatchEvent(new Event("authUpdated"));

    navigate("/signin", {
      replace: true,
      state: { from: "/checkout" },
    });
  }, [navigate]);

  // FETCH LATEST CART
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

        const items = Array.isArray(data.items)
          ? data.items
          : [];

        setCartItems(items);

        if (items.length === 0 && !silent) {
          navigate("/cart", { replace: true });
        }

        return items;

      } catch (error) {
        if (
          error.name !== "AbortError" &&
          !signal?.aborted
        ) {
          setCartError(
            error.message || "Unable to load cart."
          );
        }

        return null;

      } finally {
        if (!signal?.aborted && !silent) {
          setCartLoading(false);
        }
      }
    },
    [navigate, handleUnauthorized]
  );

  // INITIAL CART FETCH
  useEffect(() => {
    const controller = new AbortController();

    fetchCart(controller.signal);

    return () => controller.abort();
  }, [fetchCart]);

  // RECEIVE ADDRESSES
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

  // SELECT ADDRESS
  const handleSelectAddress = useCallback((id) => {
    setSelectedAddressId(id);
    setAddressError("");
  }, []);

  // CART SUBTOTAL
  const subtotal = cartItems.reduce((total, item) => {
    const product = item.product || {};

    const price = Number(
      product.discountPrice ?? product.price ?? 0
    );

    const quantity = Number(item.quantity || 0);

    return total + price * quantity;
  }, 0);

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

  // CHECK ALL CART ITEMS
  const hasStockIssues = cartItems.some(
    (item) => hasInsufficientStock(item, cartItems)
  );

  // PLACE ORDER
  async function handlePlaceOrder() {
    if (
      orderInProgress.current ||
      placingOrder ||
      cartLoading ||
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

    // VALIDATE CART
    if (cartItems.length === 0) {
      setOrderError("Your shopping bag is empty.");
      return;
    }

    // VALIDATE CURRENT STOCK
    if (hasStockIssues) {
      setOrderError(
        "Some products have insufficient stock. Please update your shopping bag."
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
      // FETCH LATEST INVENTORY BEFORE PLACING ORDER
      const latestItems = await fetchCart(
        undefined,
        true
      );

      if (!latestItems) {
        setOrderError(
          "Unable to verify your latest cart. Please try again."
        );
        return;
      }

      if (latestItems.length === 0) {
        setOrderError("Your shopping bag is empty.");
        return;
      }

      // CHECK LATEST STOCK
      const latestStockIssues = latestItems.some(
        (item) =>
          hasInsufficientStock(item, latestItems)
      );

      if (latestStockIssues) {
        setOrderError(
          "Product availability has changed. Please return to your cart and update the quantities."
        );
        return;
      }

      // CALCULATE LATEST TOTAL
      const latestSubtotal = latestItems.reduce(
        (total, item) => {
          const product = item.product || {};

          const price = Number(
            product.discountPrice ??
            product.price ??
            0
          );

          return total + price * Number(item.quantity);
        },
        0
      );

      // CHECK WHETHER CART CONTENTS OR PRICES CHANGED
      const cartSignature = (items) =>
        JSON.stringify(
          items.map((item) => ({
            id: String(item._id),
            product: String(item.product?._id),
            size: item.size || "",
            color: item.color || "",
            quantity: Number(item.quantity),
            price: Number(
              item.product?.discountPrice ??
              item.product?.price ??
              0
            ),
          })).sort((a, b) => a.id.localeCompare(b.id))
        );

      if (
        cartSignature(latestItems) !==
        cartSignature(cartItems)
      ) {
        setOrderError(
          "Your cart or product prices have changed. Please review the updated order summary before placing your order."
        );
        return;
      }

      // COD CONFIRMATION
      const confirmed = window.confirm(
        "Confirm your Cash on Delivery order?\n\n" +
        `Total Amount: ₹${latestSubtotal.toLocaleString("en-IN")}\n\n` +
        "You will pay when your order is delivered.\n\n" +
        "Click OK to place your order."
      );

      if (!confirmed) return;

      // CALL ORDER API
      orderRequestSent = true;

      const response = await fetch(
        `${API_URL}/api/orders`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            addressId: selectedAddress._id,
            paymentMethod: "COD",
          }),
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
          data.message || "Unable to place order."
        );

        // REFRESH CART AND STOCK INFORMATION
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

      // CLEAR LOCAL CART
      setCartItems([]);

      // UPDATE NAVBAR CART COUNT
      window.dispatchEvent(
        new Event("cartUpdated")
      );

      // NAVIGATE TO SUCCESS PAGE
      navigate("/order-success", {
        replace: true,
        state: {
          order: data.order,
        },
      });

    } catch (error) {
      console.error("Place order error:", error);

      // NETWORK FAILURE AFTER ORDER REQUEST
      if (orderRequestSent && !definitiveResponse) {
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

  return (
    <div className="bg-light min-vh-100">

      <Navbar />

      <main
        className="container pb-5"
        style={{ paddingTop: "190px" }}
      >

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
                to="/cart"
                className="text-secondary text-decoration-none"
              >
                Cart
              </Link>
            </li>

            <li className="breadcrumb-item active">
              Checkout
            </li>

          </ol>
        </nav>

        {/* PAGE HEADING */}
        <div className="mb-4">

          <h2
            className="fw-bold"
            style={{ color: "#f3338f" }}
          >
            Checkout
          </h2>

          <p className="text-secondary">
            Select your delivery address to continue.
          </p>

        </div>

        {/* STOCK WARNING */}
        {!cartLoading && hasStockIssues && (
          <div className="alert alert-warning">

            <h6 className="fw-bold">

              <i className="bi bi-exclamation-triangle me-2"></i>

              Product availability has changed

            </h6>

            <p className="mb-2">
              Some items in your shopping bag have
              insufficient stock. Please update your
              quantities before placing an order.
            </p>

            <Link
              to="/cart"
              className="btn btn-sm btn-outline-dark"
            >
              Update Shopping Bag
            </Link>

          </div>
        )}

        {/* LOADING CART */}
        {cartLoading ? (

          <div className="bg-white border rounded-3 text-center p-5">

            <div
              className="spinner-border"
              style={{ color: "#fc2779" }}
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

          <div className="alert alert-danger">

            <p className="mb-2">{cartError}</p>

            <button
              type="button"
              className="btn btn-outline-danger me-2"
              onClick={() => fetchCart()}
              disabled={placingOrder}
            >
              Retry
            </button>

            <Link
              to="/cart"
              className="btn btn-outline-dark"
            >
              Back to Cart
            </Link>

          </div>

        ) : (

          <div className="row g-4">

            {/* LEFT SIDE */}
            <div className="col-lg-8">

              {/* DELIVERY ADDRESS */}
              <fieldset
                disabled={placingOrder}
                className="mb-4"
              >
                <AddressManager
                  mode="checkout"
                  selectedAddressId={selectedAddressId}
                  onSelectAddress={handleSelectAddress}
                  onAddressesChange={handleAddressesChange}
                />
              </fieldset>

              {/* PAYMENT METHOD */}
              <div className="bg-white border rounded-3 p-3 p-md-4">

                <h5 className="fw-bold mb-4">

                  <i
                    className="bi bi-credit-card me-2"
                    style={{ color: "#fc2779" }}
                  ></i>

                  Payment Method

                </h5>

                <div
                  className="border rounded-3 p-3"
                  style={{
                    backgroundColor: "#fff7fa",
                    borderColor: "#fc2779",
                  }}
                >

                  <div className="form-check">

                    <input
                      type="radio"
                      className="form-check-input"
                      name="paymentMethod"
                      id="cod"
                      checked={paymentMethod === "COD"}
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

            {/* RIGHT SIDE */}
            <div className="col-lg-4">

              <div className="bg-white border rounded-3 p-3 p-md-4">

                <h5 className="fw-bold mb-4">
                  Order Summary ({totalItems} items)
                </h5>

                {/* CART PRODUCTS */}
                {cartItems.map((item) => {

                  const product = item.product || {};

                  const price = Number(
                    product.discountPrice ??
                    product.price ??
                    0
                  );

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

                  const image =
                    product.images?.[0]?.url ||
                    "https://placehold.co/100x120?text=Product";

                  return (
                    <div
                      key={item._id}
                      className="d-flex gap-3 mb-3 pb-3 border-bottom"
                    >

                      <img
                        src={image}
                        alt={
                          product.productName ||
                          "Product"
                        }
                        className="rounded border"
                        style={{
                          width: "65px",
                          height: "80px",
                          objectFit: "contain",
                        }}
                      />

                      <div className="flex-grow-1">

                        <h6 className="small fw-bold mb-1">
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
                          <div className="d-flex align-items-center gap-2 small text-secondary mb-1">

                            Colour:

                            <span
                              className="rounded-circle"
                              style={{
                                width: "14px",
                                height: "14px",
                                background: getColorHex(
                                  item.color
                                ),
                                border: "1px solid #ccc",
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
                              : `Only ${maximumQuantity} allowed for this cart item`}

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

                  <span>{totalItems}</span>

                </div>

                {/* SUBTOTAL */}
                <div className="d-flex justify-content-between mb-3">

                  <span className="text-secondary">
                    Subtotal
                  </span>

                  <span>
                    ₹{subtotal.toLocaleString("en-IN")}
                  </span>

                </div>

                {/* DELIVERY */}
                <div className="d-flex justify-content-between mb-3">

                  <span className="text-secondary">
                    Delivery
                  </span>

                  <span className="text-success">
                    FREE
                  </span>

                </div>

                <hr />

                {/* TOTAL AMOUNT */}
                <div
                  className="d-flex justify-content-between align-items-center p-3 rounded-3 mb-4"
                  style={{
                    backgroundColor: "#fff0f6",
                  }}
                >

                  <h6 className="fw-bold mb-0">
                    Total Amount
                  </h6>

                  <h5 className="fw-bold mb-0">
                    ₹{subtotal.toLocaleString("en-IN")}
                  </h5>

                </div>

                {/* ADDRESS ERROR */}
                {addressError && (
                  <div className="alert alert-danger">
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
                    Check your existing orders from your
                    account before trying again.
                  </p>
                )}

                {/* STOCK ISSUE */}
                {hasStockIssues && (
                  <div className="alert alert-warning small">

                    Resolve stock issues before placing
                    your order.

                    <Link
                      to="/cart"
                      className="d-block mt-2 fw-semibold text-dark"
                    >
                      Return to Shopping Bag
                    </Link>

                  </div>
                )}

                {/* PLACE ORDER */}
                <button
                  type="button"
                  className="btn w-100 py-3 fw-semibold text-white"
                  style={{
                    backgroundColor:
                      hasStockIssues || orderUncertain
                        ? "#999"
                        : "#fc2779",
                  }}
                  onClick={handlePlaceOrder}
                  disabled={
                    placingOrder ||
                    cartLoading ||
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
