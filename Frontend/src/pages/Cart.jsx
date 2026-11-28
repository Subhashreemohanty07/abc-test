
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { COLOR_OPTIONS } from "../constants/productOptions";

const API_URL = import.meta.env.VITE_API_URL;

// Normalize product sizes and colours
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

function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const getToken = () => localStorage.getItem("token");

  // FETCH CART FROM MONGODB
  const fetchCart = async () => {
    const token = getToken();

    if (!token) {
      setCartItems([]);
      setLoading(false);
      navigate("/signin", {
        state: { from: "/cart" },
      });
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/cart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/signin", {
            state: { from: "/cart" },
          });
          return;
        }

        throw new Error(
          data.message || "Unable to load cart."
        );
      }

      setCartItems(data.items || []);

    } catch (err) {
      console.error("Fetch cart error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  // PRODUCT HELPERS
  const getProduct = (item) => item.product || {};

  const getPrice = (item) => {
    const product = getProduct(item);

    return Number(
      product.discountPrice ?? product.price ?? 0
    );
  };

  const getImage = (item) => {
    const product = getProduct(item);

    const image =
      product.images?.[0]?.url ||
      product.images?.[0] ||
      product.image?.url ||
      product.image ||
      "";

    return typeof image === "string" && image
      ? image
      : "https://placehold.co/300x400?text=No+Image";
  };

  // Get colour swatch
  const getColorHex = (colorName) => {
    const matchedColor = COLOR_OPTIONS.find(
      (color) =>
        color.name.toLowerCase() ===
        String(colorName).toLowerCase()
    );

    return matchedColor?.hex || "#E9ECEF";
  };

  // Check whether product has variant inventory
  const hasVariantInventory = (product) => {
    return (
      Array.isArray(product.variants) &&
      product.variants.length > 0
    );
  };

  // Get stock for the selected size and colour
  const getAvailableStock = (item) => {
    const product = getProduct(item);

    // Deleted or unavailable product
    if (!product._id) {
      return 0;
    }

    const sizes = normalizeOptions(product.sizes);
    const colors = normalizeOptions(product.colors);

    const size = item.size || "";
    const color = item.color || "";

    // Validate selected size
    if (
      (sizes.length > 0 && !sizes.includes(size)) ||
      (sizes.length === 0 && size !== "")
    ) {
      return 0;
    }

    // Validate selected colour
    if (
      (colors.length > 0 && !colors.includes(color)) ||
      (colors.length === 0 && color !== "")
    ) {
      return 0;
    }

    // Variant-based inventory
    if (hasVariantInventory(product)) {
      const variant = product.variants.find(
        (variant) =>
          variant.size === size &&
          variant.color === color
      );

      return Math.max(
        0,
        Number(variant?.stock || 0)
      );
    }

    // Backward compatibility for older products
    return Math.max(
      0,
      Number(product.stock || 0)
    );
  };

  // Calculate maximum allowed quantity for a cart item
  const getMaximumQuantity = (item) => {
    const product = getProduct(item);

    if (!product._id) return 0;

    const availableStock = getAvailableStock(item);

    const hasVariants = hasVariantInventory(product);

    // Check other cart items sharing the same inventory
    const otherCartQuantity = cartItems.reduce(
      (total, otherItem) => {
        if (
          String(otherItem._id) === String(item._id)
        ) {
          return total;
        }

        const otherProduct = getProduct(otherItem);

        if (
          String(otherProduct._id) !==
          String(product._id)
        ) {
          return total;
        }

        // For variant products, only count matching variants
        if (
          hasVariants &&
          (
            otherItem.size !== item.size ||
            otherItem.color !== item.color
          )
        ) {
          return total;
        }

        // Legacy products share total product stock
        return total + Number(otherItem.quantity || 0);
      },
      0
    );

    return Math.max(
      0,
      availableStock - otherCartQuantity
    );
  };

  // Check whether a cart item has insufficient stock
  const hasInsufficientStock = (item) => {
    const maximumQuantity = getMaximumQuantity(item);
    const quantity = Number(item.quantity);

    return (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      maximumQuantity <= 0 ||
      quantity > maximumQuantity
    );
  };

  // Check whether any cart item has a stock issue
  const hasStockIssues = cartItems.some(
    (item) => hasInsufficientStock(item)
  );

  // UPDATE PRODUCT QUANTITY IN MONGODB
  const changeQuantity = async (item, amount) => {
    const newQuantity = Number(item.quantity) + amount;

    if (
      !Number.isSafeInteger(newQuantity) ||
      newQuantity < 1 ||
      updatingId !== null
    ) {
      return;
    }

    const maximumQuantity = getMaximumQuantity(item);

    // Prevent increasing quantity beyond available stock
    if (
      amount > 0 &&
      newQuantity > maximumQuantity
    ) {
      setError(
        `Only ${maximumQuantity} item(s) are available for this size and colour.`
      );
      return;
    }

    const token = getToken();

    if (!token) {
      navigate("/signin", {
        state: { from: "/cart" },
      });
      return;
    }

    try {
      setUpdatingId(item._id);
      setError("");

      const response = await fetch(
        `${API_URL}/api/cart/${item._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quantity: newQuantity,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        navigate("/signin", {
          state: { from: "/cart" },
        });
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update quantity."
        );
      }

      setCartItems(data.items || []);

      window.dispatchEvent(
        new Event("cartUpdated")
      );

    } catch (err) {
      console.error("Update quantity error:", err);
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // REMOVE PRODUCT FROM MONGODB
  const removeItem = async (itemId) => {
    if (updatingId !== null) return;

    const token = getToken();

    if (!token) {
      navigate("/signin", {
        state: { from: "/cart" },
      });
      return;
    }

    try {
      setUpdatingId(itemId);
      setError("");

      const response = await fetch(
        `${API_URL}/api/cart/${itemId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        navigate("/signin", {
          state: { from: "/cart" },
        });
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to remove product."
        );
      }

      setCartItems(data.items || []);

      window.dispatchEvent(
        new Event("cartUpdated")
      );

    } catch (err) {
      console.error("Remove cart error:", err);
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // CALCULATE TOTAL
  const subtotal = cartItems.reduce(
    (total, item) =>
      total +
      getPrice(item) * Number(item.quantity || 1),
    0
  );

  const totalItems = cartItems.reduce(
    (total, item) =>
      total + Number(item.quantity || 1),
    0
  );

  // CHECKOUT
  const handleCheckout = async () => {
    if (
      cartItems.length === 0 ||
      updatingId !== null ||
      loading
    ) {
      return;
    }

    if (!getToken()) {
      navigate("/signin", {
        state: { from: "/checkout" },
      });
      return;
    }

    // Prevent checkout if cart has stock issues
    if (hasStockIssues) {
      setError(
        "Some products in your bag have insufficient stock. Please update their quantities or remove unavailable products."
      );
      return;
    }

    navigate("/checkout");
  };

  return (
    <div className="bg-white min-vh-100">

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

            <li className="breadcrumb-item active">
              Shopping Bag
            </li>

          </ol>
        </nav>

        {/* HEADING */}
        <div className="mb-4">

          <h2
            className="fw-bold"
            style={{ color: "#f3338f" }}
          >
            My Shopping Bag
          </h2>

          <p className="text-secondary">
            {totalItems}{" "}
            {totalItems === 1 ? "item" : "items"}{" "}
            in your bag
          </p>

        </div>

        {/* ERROR */}
        {error && (
          <div className="alert alert-danger">

            {error}

            <button
              type="button"
              className="btn btn-sm btn-outline-danger ms-3"
              onClick={fetchCart}
              disabled={updatingId !== null || loading}
            >
              Retry
            </button>

          </div>
        )}

        {/* STOCK WARNING */}
        {!loading && hasStockIssues && (
          <div className="alert alert-warning">

            <div className="fw-semibold mb-1">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Some items require your attention
            </div>

            <small>
              Product availability may have changed.
              Please reduce quantities or remove unavailable
              products before proceeding to checkout.
            </small>

          </div>
        )}

        {/* LOADING */}
        {loading ? (

          <div className="text-center py-5">

            <div
              className="spinner-border"
              role="status"
            ></div>

            <p className="text-secondary mt-3">
              Loading your shopping bag...
            </p>

          </div>

        ) : cartItems.length === 0 && !error ? (

          /* EMPTY CART */
          <div className="text-center py-5 border rounded-3">

            <i className="bi bi-bag display-1 text-secondary"></i>

            <h4 className="fw-bold mt-3">
              Your shopping bag is empty!
            </h4>

            <p className="text-secondary">
              Looks like you haven't added anything
              to your bag yet.
            </p>

            <Link
              to="/products"
              className="btn btn-dark mt-2"
            >
              Continue Shopping
            </Link>

          </div>

        ) : cartItems.length > 0 ? (

          <div className="row g-4">

            {/* CART PRODUCTS */}
            <div className="col-lg-8">

              <div className="border rounded-3 p-3 p-md-4">

                {cartItems.map((item, index) => {

                  const product = getProduct(item);
                  const price = getPrice(item);

                  const productName =
                    product.productName ||
                    product.name ||
                    "Unavailable Product";

                  const availableStock =
                    getAvailableStock(item);

                  const maximumQuantity =
                    getMaximumQuantity(item);

                  const currentQuantity =
                    Number(item.quantity);

                  const isOutOfStock =
                    availableStock <= 0;

                  const insufficientStock =
                    hasInsufficientStock(item);

                  const maximumReached =
                    currentQuantity >= maximumQuantity;

                  return (
                    <div key={item._id}>

                      <div className="row g-3 align-items-center">

                        {/* IMAGE */}
                        <div className="col-4 col-md-3">

                          <img
                            src={getImage(item)}
                            alt={productName}
                            className="img-fluid rounded"
                            style={{
                              width: "100%",
                              height: "170px",
                              objectFit: "contain",
                              backgroundColor: "#f8f8f8",
                            }}
                          />

                        </div>

                        {/* PRODUCT DETAILS */}
                        <div className="col-8 col-md-9">

                          <div className="d-flex justify-content-between align-items-start">

                            <div>

                              <h6 className="fw-bold mb-1">
                                {product.brand || "Nykaa Store"}
                              </h6>

                              {product._id ? (

                                <Link
                                  to={`/products/${product._id}`}
                                  className="text-dark text-decoration-none"
                                >
                                  <p className="mb-2">
                                    {productName}
                                  </p>
                                </Link>

                              ) : (

                                <p className="mb-2">
                                  {productName}
                                </p>

                              )}

                            </div>

                            {/* REMOVE */}
                            <button
                              type="button"
                              className="btn btn-link text-danger p-0"
                              onClick={() =>
                                removeItem(item._id)
                              }
                              disabled={updatingId !== null}
                              aria-label="Remove product"
                            >
                              <i className="bi bi-trash fs-5"></i>
                            </button>

                          </div>

                          {/* SIZE AND COLOUR */}
                          <div className="d-flex flex-wrap align-items-center gap-3 small text-secondary mb-2">

                            {item.size && (
                              <span>
                                Size:{" "}
                                <strong>{item.size}</strong>
                              </span>
                            )}

                            {item.color && (
                              <span className="d-flex align-items-center gap-2">

                                Colour:

                                <span
                                  className="rounded-circle"
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    background: getColorHex(
                                      item.color
                                    ),
                                    border: "1px solid #ccc",
                                  }}
                                />

                                <strong>
                                  {item.color}
                                </strong>

                              </span>
                            )}

                          </div>

                          {/* PRICE */}
                          <h6 className="fw-bold mb-3">
                            ₹{price.toLocaleString("en-IN")}
                          </h6>

                          {/* QUANTITY */}
                          <div className="d-flex flex-wrap align-items-center gap-2">

                            <span className="small text-secondary">
                              Quantity:
                            </span>

                            <div className="d-flex align-items-center border rounded">

                              {/* DECREASE */}
                              <button
                                type="button"
                                className="btn btn-light btn-sm"
                                onClick={() =>
                                  changeQuantity(item, -1)
                                }
                                disabled={
                                  currentQuantity <= 1 ||
                                  updatingId !== null
                                }
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>

                              <span className="px-3">
                                {item.quantity}
                              </span>

                              {/* INCREASE */}
                              <button
                                type="button"
                                className="btn btn-light btn-sm"
                                onClick={() =>
                                  changeQuantity(item, 1)
                                }
                                disabled={
                                  updatingId !== null ||
                                  isOutOfStock ||
                                  maximumReached
                                }
                                aria-label="Increase quantity"
                                title={
                                  maximumReached
                                    ? "Maximum available quantity reached"
                                    : "Increase quantity"
                                }
                              >
                                +
                              </button>

                            </div>

                            {updatingId === item._id && (
                              <span
                                className="spinner-border spinner-border-sm text-secondary"
                                role="status"
                              />
                            )}

                          </div>

                          {/* STOCK INFORMATION */}
                          <div className="mt-3">

                            {isOutOfStock ? (

                              <p className="small text-danger fw-semibold mb-1">

                                <i className="bi bi-x-circle me-1"></i>

                                {product._id
                                  ? "Selected combination is unavailable or out of stock"
                                  : "This product is no longer available"}

                              </p>

                            ) : insufficientStock ? (

                              <p className="small text-danger fw-semibold mb-1">

                                <i className="bi bi-exclamation-circle me-1"></i>

                                Only {maximumQuantity} item(s)
                                can be kept in this cart item.
                                Please reduce the quantity.

                              </p>

                            ) : (

                              <p
                                className={`small fw-semibold mb-1 ${
                                  availableStock <= 5
                                    ? "text-danger"
                                    : "text-success"
                                }`}
                              >

                                <i
                                  className={`bi ${
                                    availableStock <= 5
                                      ? "bi-exclamation-circle"
                                      : "bi-check-circle"
                                  } me-1`}
                                />

                                {availableStock <= 5
                                  ? `Only ${availableStock} left in stock`
                                  : `${availableStock} items available`}

                              </p>

                            )}

                            {/* MAXIMUM QUANTITY WARNING */}
                            {!insufficientStock &&
                              maximumReached && (

                                <small className="text-secondary">

                                  Maximum available quantity reached.

                                </small>

                              )}

                          </div>

                          {/* ITEM TOTAL */}
                          <p className="fw-semibold mt-3 mb-0">

                            Item Total: ₹
                            {(
                              price * currentQuantity
                            ).toLocaleString("en-IN")}

                          </p>

                        </div>

                      </div>

                      {index !== cartItems.length - 1 && (
                        <hr className="my-4" />
                      )}

                    </div>
                  );
                })}

              </div>

              <Link
                to="/products"
                className="btn btn-outline-dark mt-3"
              >
                <i className="bi bi-arrow-left me-2"></i>
                Continue Shopping
              </Link>

            </div>

            {/* PRICE SUMMARY */}
            <div className="col-lg-4">

              <div className="border rounded-3 p-4">

                <h5 className="fw-bold mb-4">
                  Price Details
                </h5>

                <div className="d-flex justify-content-between mb-3">

                  <span className="text-secondary">
                    Total Items
                  </span>

                  <span>{totalItems}</span>

                </div>

                <div className="d-flex justify-content-between mb-3">

                  <span className="text-secondary">
                    Subtotal
                  </span>

                  <span>
                    ₹{subtotal.toLocaleString("en-IN")}
                  </span>

                </div>

                <div className="d-flex justify-content-between mb-3">

                  <span className="text-secondary">
                    Delivery Charges
                  </span>

                  <span className="text-success">
                    FREE
                  </span>

                </div>

                <hr />

                <div className="d-flex justify-content-between mb-4">

                  <h6 className="fw-bold">
                    Total Amount
                  </h6>

                  <h5 className="fw-bold">
                    ₹{subtotal.toLocaleString("en-IN")}
                  </h5>

                </div>

                {/* CHECKOUT STOCK WARNING */}
                {hasStockIssues && (
                  <div className="alert alert-warning small">

                    Please resolve stock issues in your
                    shopping bag before checkout.

                  </div>
                )}

                {/* CHECKOUT BUTTON */}
                <button
                  type="button"
                  className="btn text-white w-100 py-3 fw-semibold"
                  style={{
                    backgroundColor: hasStockIssues
                      ? "#999"
                      : "#fc2779",
                  }}
                  onClick={handleCheckout}
                  disabled={
                    cartItems.length === 0 ||
                    updatingId !== null ||
                    hasStockIssues ||
                    loading
                  }
                >

                  <i className="bi bi-lock-fill me-2"></i>

                  PROCEED TO CHECKOUT

                </button>

                <p className="small text-secondary text-center mt-3 mb-0">

                  <i className="bi bi-shield-check me-1"></i>

                  Safe and secure shopping

                </p>

              </div>

            </div>

          </div>

        ) : null}

      </main>

      <Footer showSocial={false} />

    </div>
  );
}

export default Cart;
