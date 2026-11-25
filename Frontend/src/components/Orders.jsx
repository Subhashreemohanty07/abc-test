
import {useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

function Orders({
  isAdmin = false,
  isVendor = false,
  customers = [],
  orders = [],
  selectedCustomerId = "",
}) {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  // ORDER CANCELLATION
const [cancelOrderId, setCancelOrderId] = useState(null);
const [cancelReason, setCancelReason] = useState("");
const [otherReason, setOtherReason] = useState("");
const [cancellingOrderId, setCancellingOrderId] = useState(null);

const [cancelError, setCancelError] = useState("");
const [cancelSuccess, setCancelSuccess] = useState("");

// STORE UPDATED ORDERS AFTER CANCELLATION
const [updatedOrders, setUpdatedOrders] = useState({});

// PREVENT DUPLICATE CANCELLATION
const cancellationInProgress = useRef(false);

// CUSTOMER ROLE CHECK
const isCustomer = !isAdmin && !isVendor;

const cancellationReasons = [
  "Ordered by mistake",
  "Changed my mind",
  "Found a better price",
  "Delivery taking too long",
  "Ordered wrong size or colour",
  "Other",
];

  // EXPAND / COLLAPSE ORDER DETAILS
  const toggleOrderDetails = (orderId) => {
    setExpandedOrderId((previousId) =>
      previousId === orderId ? null : orderId
    );
  };

  // ADMIN CUSTOMER SEARCH
  const filteredCustomers = customers.filter((customer) =>
    `${customer.name || ""} ${customer.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const activeCustomerId = selectedCustomerId || selectedCustomer;

  const customer = customers.find(
    (item) => item._id === activeCustomerId
  );

 
// MERGE UPDATED ORDERS WITH EXISTING ORDERS
const currentOrders = orders.map((order) =>
  isCustomer
    ? updatedOrders[order._id] || order
    : order
);

// ADMIN ORDER FILTER
const visibleOrders = isAdmin
  ? currentOrders.filter((order) => {
      const customerId =
        typeof order.user === "object"
          ? order.user?._id
          : order.user;

      return customerId === activeCustomerId;
    })
  : currentOrders;


// CHECK WHETHER ORDER CAN BE CANCELLED
function canCancelOrder(order) {
  return (
    isCustomer &&
    ["Placed", "Confirmed"].includes(order.orderStatus) &&
    order.paymentStatus === "Pending" &&
    order.stockRestored !== true
  );
}

// OPEN CANCELLATION FORM
function openCancellation(order) {
  if (
    !canCancelOrder(order) ||
    cancellationInProgress.current
  ) {
    return;
  }

  setCancelOrderId(order._id);
  setCancelReason("");
  setOtherReason("");
  setCancelError("");
  setCancelSuccess("");
}

// CLOSE CANCELLATION FORM
function closeCancellation() {
  if (cancellationInProgress.current) return;

  setCancelOrderId(null);
  setCancelReason("");
  setOtherReason("");
  setCancelError("");
}

// CANCEL ORDER API
async function handleCancelOrder(order) {
  if (
    !canCancelOrder(order) ||
    cancellationInProgress.current ||
    cancelOrderId !== order._id
  ) {
    return;
  }

  setCancelError("");
  setCancelSuccess("");

  // VALIDATE CANCELLATION REASON
  const finalReason =
    cancelReason === "Other"
      ? otherReason.trim()
      : cancelReason.trim();

  if (!finalReason) {
    setCancelError(
      "Please provide a cancellation reason."
    );
    return;
  }

  if (finalReason.length > 500) {
    setCancelError(
      "Cancellation reason cannot exceed 500 characters."
    );
    return;
  }

  // CHECK LOGIN
  const token = localStorage.getItem("token");

  if (!token) {
    setCancelError(
      "Please sign in to cancel your order."
    );
    return;
  }

  // CONFIRM CANCELLATION
  const confirmed = window.confirm(
    "Are you sure you want to cancel this order?\n\n" +
    "All products in this order will be cancelled.\n\n" +
    "This action cannot be undone."
  );

  if (!confirmed) return;

  // PREVENT MULTIPLE REQUESTS
  cancellationInProgress.current = true;
  setCancellingOrderId(order._id);

  try {
    const response = await fetch(
      `${API_URL}/api/orders/${order._id}/cancel`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          reason: finalReason,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    // HANDLE EXPIRED LOGIN
    if (response.status === 401) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    // HANDLE API ERRORS
    if (!response.ok) {
      throw new Error(
        data.message || "Unable to cancel order."
      );
    }

    // VERIFY RESPONSE
    if (
      !data.order?._id ||
      String(data.order._id) !== String(order._id) ||
      data.order.orderStatus !== "Cancelled"
    ) {
      throw new Error(
        "Unable to verify cancellation. Please refresh your order history."
      );
    }

    // UPDATE ORDER IN UI
    setUpdatedOrders((previousOrders) => ({
      ...previousOrders,

      [order._id]: {
        ...order,
        ...data.order,
      },
    }));

    // SUCCESS MESSAGE
    setCancelSuccess(
      data.message || "Order cancelled successfully."
    );

    // RESET CANCELLATION FORM
    setCancelOrderId(null);
    setCancelReason("");
    setOtherReason("");

  } catch (error) {
    console.error("Order cancellation error:", error);

    setCancelError(
      error.message ||
      "Unable to confirm cancellation. Please refresh your orders."
    );

  } finally {
    cancellationInProgress.current = false;
    setCancellingOrderId(null);
  }
}

// ORDER STATUS BADGE COLOUR
function getOrderStatusClass(status) {
  switch (status) {
    case "Placed":
      return "bg-primary text-white";

    case "Confirmed":
      return "bg-info text-dark";

    case "Shipped":
      return "bg-warning text-dark";

    case "Delivered":
      return "bg-success text-white";

    case "Cancelled":
      return "bg-danger text-white";

    default:
      return "bg-light text-dark border";
  }
}


  // CUSTOMER PDF DOWNLOAD
  async function handleDownloadReceipt(orderId) {
    if (isAdmin || isVendor || downloadingOrderId !== null) return;

    const token = localStorage.getItem("token");

    if (!token) {
      setDownloadError("Please sign in to download your receipt.");
      return;
    }

    try {
      setDownloadingOrderId(orderId);
      setDownloadError("");

      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/receipt`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.message || "Unable to download receipt."
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `Nykaa-Receipt-${orderId}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error("Receipt download error:", error);

      setDownloadError(
        error.message || "Unable to download receipt."
      );
    } finally {
      setDownloadingOrderId(null);
    }
  }

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-3 p-md-4">

        {/* HEADER */}
        <div className="mb-4">
          <h5 className="fw-bold mb-1">
            <i
              className="bi bi-bag-check me-2"
              style={{ color: "#fc2779" }}
            ></i>

            {isAdmin
              ? "Customer Purchase Orders"
              : isVendor
              ? "Store Orders"
              : "My Orders"}
          </h5>

          <p className="text-secondary small mb-0">
            {isAdmin
              ? "View the selected customer's purchase history."
              : isVendor
              ? "View customers who purchased products from your store."
              : "View and track your purchase orders."}
          </p>
        </div>

        {/* OPTIONAL ADMIN CUSTOMER SEARCH */}
        {isAdmin && !selectedCustomerId && (
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">
                Search Customer
              </label>

              <input
                type="search"
                className="form-control"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">
                Select Customer
              </label>

              <select
                className="form-select"
                value={selectedCustomer}
                onChange={(e) =>
                  setSelectedCustomer(e.target.value)
                }
              >
                <option value="">Choose customer</option>

                {filteredCustomers.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name} ({item.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* OPTIONAL ADMIN SELECTED CUSTOMER */}
        {isAdmin && !selectedCustomerId && customer && (
          <div className="bg-light rounded-3 p-3 mb-4">
            <h6 className="fw-bold mb-1">
              {customer.name}
            </h6>

            <p className="small text-secondary mb-0">
              {customer.email}
            </p>
          </div>
        )}

        {/* PDF ERROR - CUSTOMER ONLY */}
        {!isAdmin && !isVendor && downloadError && (
          <div className="alert alert-danger" role="alert">
            {downloadError}
          </div>
        )}
        {/* CANCELLATION SUCCESS MESSAGE */}
        {isCustomer && cancelSuccess && (
          <div className="alert alert-success" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            {cancelSuccess}
          </div>
        )}

        {/* CANCELLATION ERROR MESSAGE */}
        {isCustomer && cancelError && (
          <div className="alert alert-danger" role="alert">
            <i className="bi bi-exclamation-circle me-2"></i>
            {cancelError}
          </div>
        )}

        {/* ORDER CONTENT */}
        {isAdmin && !activeCustomerId ? (
          <div className="text-center border rounded-3 py-5 px-3">
            <i className="bi bi-person-check fs-1 text-secondary"></i>

            <h6 className="fw-bold mt-3">
              Select a Customer
            </h6>

            <p className="text-secondary small mb-0">
              Choose a customer to view their purchase orders.
            </p>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="text-center border rounded-3 py-5 px-3">
            <i className="bi bi-bag-x fs-1 text-secondary"></i>

            <h6 className="fw-bold mt-3">
              No Orders Available
            </h6>

            <p className="text-secondary small mb-0">
              {isAdmin
                ? "No purchase orders found for this customer."
                : isVendor
                ? "No customers have purchased products from your store yet."
                : "You haven't placed any orders yet."}
            </p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {visibleOrders.map((order) => (
              <div
                key={order._id}
                className="border rounded-3 p-3"
              >
                {/* ORDER NUMBER AND STATUS */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <h6 className="fw-bold mb-0">
                    Order #{order.orderNumber || order._id}
                  </h6>

                  <span
                    className={`badge ${getOrderStatusClass(
                      order.orderStatus ||
                      order.status ||
                      "Pending"
                    )}`}
                  >
                    {order.orderStatus ||
                      order.status ||
                      "Pending"}
                  </span>
                </div>

                {/* ORDER DATE */}
                <p className="text-secondary small mb-2">
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString("en-IN")
                    : "Date unavailable"}
                </p>

                {/* TOTAL AND BUTTONS */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <span className="fw-semibold">
                    Total: ₹
                    {Number(
                      isVendor
                        ? order.subtotal ?? 0
                        : order.totalAmount ?? 0
                    ).toLocaleString("en-IN")}
                  </span>

                  <div className="d-flex flex-wrap gap-2">

                    {/* VIEW DETAILS - ALL ROLES */}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() =>
                        toggleOrderDetails(order._id)
                      }
                      aria-expanded={
                        expandedOrderId === order._id
                      }
                    >
                      {expandedOrderId === order._id
                        ? "Hide Details"
                        : "View Details"}

                      <i
                        className={`bi ms-2 ${
                          expandedOrderId === order._id
                            ? "bi-chevron-up"
                            : "bi-chevron-down"
                        }`}
                      ></i>
                    </button>
                    {/* CANCEL ORDER - CUSTOMER ONLY */}
                    {canCancelOrder(order) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => openCancellation(order)}
                        disabled={cancellingOrderId !== null}
                      >
                        {cancellingOrderId === order._id ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Cancelling...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-x-circle me-2"></i>
                            Cancel Order
                          </>
                        )}
                      </button>
                    )}

                    {/* CUSTOMER PDF DOWNLOAD ONLY */}
                    {!isAdmin && !isVendor && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() =>
                          handleDownloadReceipt(order._id)
                        }
                        disabled={downloadingOrderId !== null}
                      >
                        {downloadingOrderId === order._id ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Downloading...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-file-earmark-pdf me-2"></i>
                            Download PDF
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* PAYMENT DETAILS */}
                <p className="small text-secondary mt-2 mb-0">
                  Payment: {order.paymentMethod || "N/A"}
                  {" | "}
                  {order.paymentStatus || "Pending"}
                </p>

                {/* CANCELLATION FORM - CUSTOMER ONLY */}
                {isCustomer &&
                  cancelOrderId === order._id &&
                  canCancelOrder(order) && (
                      <div
                        className="border rounded-3 p-3 mt-3"
                        style={{
                          backgroundColor: "#fff7fa",
                          borderColor: "#fc2779",
                        }}
                      >
                        <h6 className="fw-bold text-danger mb-2">
                          Cancel Order
                        </h6>

                        <p className="small text-secondary">
                          Please select the reason for cancelling
                          your order.
                        </p>

                        <label
                          className="form-label fw-semibold small"
                          htmlFor={`cancel-reason-${order._id}`}
                        >
                          Cancellation Reason *
                        </label>

                        <select
                          id={`cancel-reason-${order._id}`}
                          className="form-select mb-3"
                          value={cancelReason}
                          disabled={cancellingOrderId !== null}
                          onChange={(e) => {
                            setCancelReason(e.target.value);
                            setOtherReason("");
                            setCancelError("");
                          }}
                        >
                          <option value="">
                            Select cancellation reason
                          </option>

                          {cancellationReasons.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>

                        {/* OTHER REASON */}
                        {cancelReason === "Other" && (
                          <div className="mb-3">
                            <label className="form-label small fw-semibold">
                              Please specify your reason
                            </label>

                            <textarea
                              className="form-control"
                              rows={3}
                              maxLength={500}
                              value={otherReason}
                              disabled={cancellingOrderId !== null}
                              placeholder="Enter your cancellation reason..."
                              onChange={(e) => {
                                setOtherReason(e.target.value);
                                setCancelError("");
                              }}
                            />

                            <p className="small text-secondary text-end mt-1">
                              {otherReason.length}/500
                            </p>
                          </div>
                        )}

                        <div className="alert alert-warning small">
                          <i className="bi bi-exclamation-triangle me-2"></i>

                          Cancelling this order will cancel all
                          products included in the order.
                        </div>

                        <div className="d-flex flex-wrap gap-2">

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={closeCancellation}
                            disabled={cancellingOrderId !== null}
                          >
                            Keep Order
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleCancelOrder(order)}
                            disabled={
                              cancellingOrderId !== null ||
                              !cancelReason ||
                              (
                                cancelReason === "Other" &&
                                !otherReason.trim()
                              )
                            }
                          >
                            {cancellingOrderId === order._id ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Cancelling...
                              </>
                            ) : (
                              "Confirm Cancellation"
                            )}
                          </button>

                        </div>
                      </div>
                )}

                {/* CANCELLED ORDER INFORMATION - ALL ROLES */}
                {order.orderStatus === "Cancelled" && (
                  <div className="bg-light border rounded-3 p-3 mt-3">

                    <h6 className="text-danger fw-bold small">
                      <i className="bi bi-x-circle-fill me-2"></i>
                      Order Cancelled
                    </h6>

                    <p className="small mb-1">
                      <strong>Cancellation Reason:</strong>{" "}
                      {order.cancellationReason || "Not provided"}
                    </p>

                    <p className="small mb-0">
                      <strong>Cancelled On:</strong>{" "}
                      {order.cancelledAt
                        ? new Date(order.cancelledAt).toLocaleString("en-IN")
                        : "N/A"}
                    </p>

                  </div>
                )}


                {/* EXPANDABLE DETAILS - ALL ROLES */}
                {expandedOrderId === order._id && (
                  <div className="mt-3 border-top pt-3">

                    {/* CUSTOMER DETAILS - ADMIN/VENDOR ONLY */}
                    {(isAdmin || isVendor) && (
                      <>
                        <h6 className="fw-bold">
                          Customer Details
                        </h6>

                        <p className="small mb-1">
                          <strong>Name:</strong>{" "}
                          {order.customer?.name ||
                            order.user?.name ||
                            order.deliveryAddress?.fullName ||
                            "N/A"}
                        </p>

                        <p className="small mb-3">
                          <strong>Email:</strong>{" "}
                          {order.customer?.email ||
                            order.user?.email ||
                            "N/A"}
                        </p>
                      </>
                    )}

                    {/* PURCHASED PRODUCTS */}
                    <h6 className="fw-bold">
                      Purchased Products
                    </h6>

                    {order.items?.length > 0 ? (
                      order.items.map((item, index) => (
                        <div
                          key={item._id || index}
                          className="d-flex gap-3 border rounded-3 p-2 mb-2"
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.productName || "Product"}
                              style={{
                                width: "65px",
                                height: "65px",
                                objectFit: "cover",
                                borderRadius: "8px",
                              }}
                            />
                          ) : (
                            <div
                              className="bg-light rounded d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{
                                width: "65px",
                                height: "65px",
                              }}
                            >
                              <i className="bi bi-image text-secondary"></i>
                            </div>
                          )}

                          <div className="flex-grow-1">
                            <p className="fw-semibold small mb-1">
                              {item.productName || "Product"}
                            </p>

                            {item.brand && (
                              <p className="small text-secondary mb-1">
                                Brand: {item.brand}
                              </p>
                            )}

                            {/* VENDOR INFO - ADMIN ONLY */}
                            {isAdmin && (
                              <p className="small mb-1">
                                <strong>Vendor:</strong>{" "}
                                {item.vendor?.storeName ||
                                  item.vendor?.name ||
                                  "N/A"}
                              </p>
                            )}

                            <p className="small mb-1">
                              Quantity: {item.quantity}
                            </p>

                            {item.size && (
                              <p className="small mb-1">
                                Size: {item.size}
                              </p>
                            )}

                            {item.color && (
                              <p className="small mb-1">
                                Color: {item.color}
                              </p>
                            )}

                            <p className="small mb-0">
                              Price: ₹
                              {Number(
                                item.price || 0
                              ).toLocaleString("en-IN")}
                              {" × "}
                              {item.quantity}
                              {" = ₹"}
                              {(
                                Number(item.price || 0) *
                                Number(item.quantity || 0)
                              ).toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-secondary small">
                        No products found for this order.
                      </p>
                    )}

                    {/* DELIVERY ADDRESS */}
                    <h6 className="fw-bold mt-3">
                      Delivery Address
                    </h6>

                    <div className="bg-light rounded-3 p-3 small">
                      <p className="fw-semibold mb-1">
                        {order.deliveryAddress?.fullName || "N/A"}
                      </p>

                      <p className="mb-1">
                        Phone:{" "}
                        {order.deliveryAddress?.phone || "N/A"}
                      </p>

                      <p className="mb-0">
                        {[
                          order.deliveryAddress?.house,
                          order.deliveryAddress?.area,
                          order.deliveryAddress?.city,
                          order.deliveryAddress?.state,
                          order.deliveryAddress?.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Address unavailable"}
                      </p>
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Orders;
