
import { useState } from "react";

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

  // EXPAND / COLLAPSE DETAILS
  const toggleOrderDetails = (orderId) => {
    setExpandedOrderId((previousId) =>
      previousId === orderId ? null : orderId
    );
  };

  // CUSTOMER SEARCH (FOR STANDALONE ADMIN ORDERS)
  const filteredCustomers = customers.filter((customer) =>
    `${customer.name || ""} ${customer.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const activeCustomerId = selectedCustomerId || selectedCustomer;

  const customer = customers.find(
    (item) => item._id === activeCustomerId
  );

  // ADMIN FILTERS ORDERS BY SELECTED CUSTOMER
  const visibleOrders = isAdmin
    ? orders.filter((order) => {
        const customerId =
          typeof order.user === "object"
            ? order.user?._id
            : order.user;

        return customerId === activeCustomerId;
      })
    : orders;

  // CUSTOMER-ONLY PDF RECEIPT
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

        {/* OPTIONAL SELECTED CUSTOMER DETAILS */}
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

                  <span className="badge bg-light text-dark border">
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

                {/* TOTAL AND ACTION BUTTONS */}
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

                    {/* ADMIN AND VENDOR VIEW DETAILS */}
                    {(isAdmin || isVendor) && (
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

                {/* PAYMENT INFORMATION */}
                <p className="small text-secondary mt-2 mb-0">
                  Payment: {order.paymentMethod || "N/A"}
                  {" | "}
                  {order.paymentStatus || "Pending"}
                </p>

                {/* EXPANDABLE ORDER DETAILS */}
                {(isAdmin || isVendor) &&
                  expandedOrderId === order._id && (
                    <div className="mt-3 border-top pt-3">

                      {/* CUSTOMER DETAILS */}
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

                              {/* VENDOR INFORMATION FOR ADMIN */}
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
                                {Number(item.price || 0).toLocaleString("en-IN")}
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
