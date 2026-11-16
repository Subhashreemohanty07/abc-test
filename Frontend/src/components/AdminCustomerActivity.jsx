
import { useEffect, useState } from "react";
import Orders from "./Orders";
import Wishlist from "./Wishlist";

const API_URL = import.meta.env.VITE_API_URL;

function AdminCustomerActivity({
  customers = [],
  orders = [],
}) {
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] =
    useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("wishlist");
  const [wishlistCount, setWishlistCount] = useState(0);

  // CART STATES
  const [customerCart, setCustomerCart] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const [cartRefresh, setCartRefresh] = useState(0);

  // FILTER CUSTOMERS BY NAME OR EMAIL
  const filteredCustomers = customers.filter((customer) =>
    `${customer.name || ""} ${customer.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // SELECTED CUSTOMER
  const selectedCustomer = customers.find(
    (customer) => customer._id === selectedCustomerId
  );

  // GET CUSTOMER ID FROM ACTIVITY RECORD
  const getCustomerId = (item) => {
    const owner = item.user || item.customerId;

    return typeof owner === "object"
      ? owner?._id
      : owner;
  };

  // FILTER ORDERS
  const customerOrders = orders.filter(
    (item) => getCustomerId(item) === selectedCustomerId
  );

  // FETCH SELECTED CUSTOMER'S CART FROM MONGODB
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerCart([]);
      setCartLoading(false);
      setCartError("");
      return;
    }

    const controller = new AbortController();

    async function fetchCustomerCart() {
      setCartLoading(true);
      setCartError("");
      setCustomerCart([]);

      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("Admin login required.");
        }

        const response = await fetch(
          `${API_URL}/api/admin/customers/${selectedCustomerId}/cart`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to fetch customer cart."
          );
        }

        if (!controller.signal.aborted) {
          setCustomerCart(
            Array.isArray(data.items) ? data.items : []
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Admin cart error:", error);
          setCartError(error.message);
          setCustomerCart([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCartLoading(false);
        }
      }
    }

    fetchCustomerCart();

    return () => controller.abort();
  }, [selectedCustomerId, cartRefresh]);

  // SELECT CUSTOMER
  const handleSelectCustomer = (customer) => {
    setSelectedCustomerId(customer._id);
    setSearch(`${customer.name} (${customer.email})`);
    setDropdownOpen(false);
    setActiveTab("wishlist");

    setWishlistCount(0);
    setCustomerCart([]);
    setCartError("");
    setCartLoading(true);

    setCartRefresh((previous) => previous + 1);
  };

  // SEARCH CUSTOMER
  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setSelectedCustomerId("");
    setDropdownOpen(true);

    setWishlistCount(0);
    setCustomerCart([]);
    setCartError("");
  };

  // CLEAR CUSTOMER SELECTION
  const handleClearCustomer = () => {
    setSearch("");
    setSelectedCustomerId("");
    setDropdownOpen(false);
    setActiveTab("wishlist");

    setWishlistCount(0);
    setCustomerCart([]);
    setCartError("");
  };

  // REFRESH CART
  const handleRefreshCart = () => {
    setCartRefresh((previous) => previous + 1);
  };

  // CART SUMMARY
  const cartQuantity = customerCart.reduce(
    (total, item) =>
      total + Number(item.quantity || 1),
    0
  );

  const cartTotal = customerCart.reduce((total, item) => {
    const product = item.product || {};

    const price = Number(
      product.discountPrice ?? product.price ?? 0
    );

    const quantity = Number(item.quantity || 1);

    return total + price * quantity;
  }, 0);

  // ACTIVITY TABS
  const tabs = [
    {
      id: "wishlist",
      label: "Wishlist",
      icon: "bi-heart",
      count: wishlistCount,
    },
    {
      id: "cart",
      label: "Add to Cart",
      icon: "bi-cart3",
      count: customerCart.length,
    },
    {
      id: "orders",
      label: "Orders Placed",
      icon: "bi-bag-check",
      count: customerOrders.length,
    },
  ];

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-3 p-md-4">

        {/* HEADER */}
        <div className="mb-4">
          <h5 className="fw-bold mb-1">
            <i
              className="bi bi-people-fill me-2"
              style={{ color: "#fc2779" }}
            ></i>
            Customer Activity
          </h5>

          <p className="text-secondary small mb-0">
            Search for a customer to view their wishlist,
            cart, and placed orders.
          </p>
        </div>

        {/* CUSTOMER SEARCH */}
        <div
          className="mb-4 position-relative"
          style={{ maxWidth: "550px" }}
        >
          <label className="form-label fw-semibold">
            Search and Select Customer
          </label>

          <div className="input-group">
            <span className="input-group-text bg-white">
              <i className="bi bi-search"></i>
            </span>

            <input
              type="text"
              className="form-control"
              placeholder="Type customer name or email..."
              value={search}
              onChange={handleSearchChange}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => {
                  setDropdownOpen(false);
                }, 150);
              }}
              autoComplete="off"
            />

            {search && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleClearCustomer}
                aria-label="Clear customer"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>

          {/* SEARCH RESULTS */}
          {dropdownOpen && (
            <div
              className="position-absolute bg-white border rounded-3 shadow-sm w-100 mt-1 overflow-auto"
              style={{
                zIndex: 10,
                maxHeight: "250px",
              }}
            >
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer._id}
                    type="button"
                    className="btn btn-light rounded-0 text-start w-100 border-bottom px-3 py-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      handleSelectCustomer(customer)
                    }
                  >
                    <div className="fw-semibold">
                      {customer.name}
                    </div>

                    <small className="text-secondary">
                      {customer.email}
                    </small>
                  </button>
                ))
              ) : (
                <div className="p-3 text-secondary small">
                  No matching customers found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* NO CUSTOMER SELECTED */}
        {!selectedCustomer ? (
          <div className="border rounded-3 text-center py-5 px-3">
            <i className="bi bi-person-check fs-1 text-secondary"></i>

            <h6 className="fw-bold mt-3">
              Select a Customer
            </h6>

            <p className="text-secondary small mb-0">
              Search by name or email and select a customer
              to view their activity.
            </p>
          </div>
        ) : (
          <>
            {/* SELECTED CUSTOMER DETAILS */}
            <div className="bg-light rounded-3 p-3 mb-4">
              <div className="d-flex align-items-center gap-3">

                {/* CUSTOMER AVATAR */}
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                  style={{
                    width: "45px",
                    height: "45px",
                    backgroundColor: "#fc2779",
                  }}
                >
                  {selectedCustomer.name
                    ?.charAt(0)
                    ?.toUpperCase() || "C"}
                </div>

                {/* CUSTOMER INFORMATION */}
                <div className="overflow-hidden">
                  <h6 className="fw-bold mb-1">
                    {selectedCustomer.name}
                  </h6>

                  <p className="text-secondary small mb-0 text-break">
                    {selectedCustomer.email}
                  </p>
                </div>
              </div>
            </div>

            {/* ACTIVITY TABS */}
            <div className="d-flex flex-wrap gap-2 mb-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="btn btn-sm"
                  style={{
                    backgroundColor:
                      activeTab === tab.id
                        ? "#fc2779"
                        : "#fff0f5",
                    color:
                      activeTab === tab.id
                        ? "#ffffff"
                        : "#fc2779",
                    border: "1px solid #f7d5e2",
                    padding: "10px 14px",
                  }}
                >
                  <i className={`bi ${tab.icon} me-2`}></i>

                  {tab.label}

                  <span className="ms-2">
                    ({tab.count})
                  </span>
                </button>
              ))}
            </div>

            {/* WISHLIST TAB */}
            {activeTab === "wishlist" && (
              <Wishlist
                isAdmin={true}
                selectedCustomerId={selectedCustomerId}
                onCountChange={setWishlistCount}
              />
            )}

            {/* CART TAB */}
            {activeTab === "cart" && (
              <div className="border rounded-3 p-3">

                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">
                    <i className="bi bi-cart3 me-2"></i>
                    Cart Items
                  </h6>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={handleRefreshCart}
                    disabled={cartLoading}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh
                  </button>
                </div>

                {cartLoading ? (
                  <div className="text-center py-4">
                    <div
                      className="spinner-border"
                      style={{ color: "#fc2779" }}
                      role="status"
                    ></div>

                    <p className="text-secondary mt-3">
                      Loading customer cart...
                    </p>
                  </div>
                ) : cartError ? (
                  <div className="alert alert-danger">
                    {cartError}
                  </div>
                ) : customerCart.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="bi bi-cart-x fs-1 text-secondary"></i>

                    <p className="text-secondary small mt-3 mb-0">
                      This customer has no items in their cart.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* CART PRODUCT LIST */}
                    <div className="row g-3">
                      {customerCart.map((item) => {
                        const product = item.product || {};

                        const unitPrice = Number(
                          product.discountPrice ??
                            product.price ??
                            0
                        );

                        const itemQuantity = Number(
                          item.quantity || 1
                        );

                        return (
                          <div
                            className="col-12 col-md-6"
                            key={item._id}
                          >
                            <div className="border rounded-3 p-3 h-100">
                              <div className="d-flex gap-3">

                                {/* PRODUCT IMAGE */}
                                {product.images?.[0]?.url ? (
                                  <img
                                    src={product.images[0].url}
                                    alt={
                                      product.productName ||
                                      "Product"
                                    }
                                    className="rounded"
                                    style={{
                                      width: "80px",
                                      height: "100px",
                                      objectFit: "cover",
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="bg-light rounded d-flex align-items-center justify-content-center"
                                    style={{
                                      width: "80px",
                                      height: "100px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <i className="bi bi-image text-secondary fs-3"></i>
                                  </div>
                                )}

                                {/* PRODUCT INFORMATION */}
                                <div className="flex-grow-1">
                                  <h6 className="fw-bold mb-1">
                                    {product.productName ||
                                      "Product"}
                                  </h6>

                                  {product.brand && (
                                    <p className="small text-secondary mb-1">
                                      {product.brand}
                                    </p>
                                  )}

                                  {item.size && (
                                    <p className="small mb-1">
                                      Size: {item.size}
                                    </p>
                                  )}

                                  {item.color && (
                                    <p className="small mb-1">
                                      Colour: {item.color}
                                    </p>
                                  )}

                                  <p className="small mb-1">
                                    Quantity: {itemQuantity}
                                  </p>

                                  <p className="small mb-1">
                                    Unit Price: ₹
                                    {unitPrice.toLocaleString(
                                      "en-IN"
                                    )}
                                  </p>

                                  <p className="fw-bold mb-0">
                                    Total: ₹
                                    {(
                                      unitPrice * itemQuantity
                                    ).toLocaleString("en-IN")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* CART SUMMARY */}
                    <hr />

                    <div className="d-flex justify-content-between flex-wrap gap-3">
                      <div>
                        <p className="small text-secondary mb-1">
                          Different Cart Items
                        </p>

                        <h6 className="fw-bold mb-0">
                          {customerCart.length}
                        </h6>
                      </div>

                      <div>
                        <p className="small text-secondary mb-1">
                          Total Quantity
                        </p>

                        <h6 className="fw-bold mb-0">
                          {cartQuantity}
                        </h6>
                      </div>

                      <div>
                        <p className="small text-secondary mb-1">
                          Cart Total
                        </p>

                        <h6
                          className="fw-bold mb-0"
                          style={{ color: "#fc2779" }}
                        >
                          ₹{cartTotal.toLocaleString("en-IN")}
                        </h6>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ORDERS PLACED TAB */}
            {activeTab === "orders" && (
              <Orders
                isAdmin={true}
                selectedCustomerId={selectedCustomerId}
                orders={customerOrders}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminCustomerActivity;
