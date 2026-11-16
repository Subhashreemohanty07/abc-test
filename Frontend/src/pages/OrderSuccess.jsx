
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const API_URL = import.meta.env.VITE_API_URL;

function OrderSuccess() {
  const location = useLocation();
  const order = location.state?.order;

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  // DOWNLOAD PDF RECEIPT
  async function handleDownloadReceipt() {
    if (!order?._id || downloading) return;

    const token = localStorage.getItem("token");

    if (!token) {
      setDownloadError("Please sign in to download your receipt.");
      return;
    }

    try {
      setDownloading(true);
      setDownloadError("");

      const response = await fetch(
        `${API_URL}/api/orders/${order._id}/receipt`,
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

      // Convert API response to PDF Blob
      const blob = await response.blob();

      // Create temporary URL
      const url = window.URL.createObjectURL(blob);

      // Download PDF
      const link = document.createElement("a");
      link.href = url;
      link.download = `Nykaa-Receipt-${order._id}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Clean up temporary URL
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

    } catch (error) {
      console.error("Receipt download error:", error);

      setDownloadError(
        error.message || "Unable to download receipt."
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-light min-vh-100">
      <Navbar />

      <main
        className="container text-center pb-5"
        style={{ paddingTop: "190px" }}
      >
        <div
          className="bg-white border rounded-3 shadow-sm p-4 p-md-5 mx-auto"
          style={{ maxWidth: "650px" }}
        >
          {order ? (
            <>
              {/* SUCCESS ICON */}
              <i
                className="bi bi-check-circle-fill"
                style={{
                  fontSize: "75px",
                  color: "#28a745",
                }}
              ></i>

              <h2 className="fw-bold mt-3" style={{ color: "#f3338f" }}>
                Order Placed Successfully!
              </h2>

              <p className="text-secondary">
                Thank you for shopping with us.
                Your order has been confirmed.
              </p>

              {/* ORDER DETAILS */}
              <div className="bg-light rounded-3 p-3 my-4 text-start">
                <p>
                  <strong>Order ID:</strong> {order._id}
                </p>

                <p>
                  <strong>Order Date:</strong>{" "}
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString(
                        "en-IN"
                      )
                    : "N/A"}
                </p>

                <p>
                  <strong>Total Amount:</strong>{" "}
                  ₹{Number(order.totalAmount || 0).toLocaleString(
                    "en-IN"
                  )}
                </p>

                <p>
                  <strong>Payment Method:</strong>{" "}
                  {order.paymentMethod === "COD"
                    ? "Cash on Delivery"
                    : order.paymentMethod}
                </p>

                <p>
                  <strong>Order Status:</strong>{" "}
                  {order.orderStatus}
                </p>

                <p className="mb-0">
                  <strong>Payment Status:</strong>{" "}
                  {order.paymentStatus}
                </p>
              </div>

              {/* DOWNLOAD ERROR */}
              {downloadError && (
                <div className="alert alert-danger" role="alert">
                  {downloadError}
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                <Link
                  to="/"
                  className="btn btn-outline-secondary"
                >
                  Continue Shopping
                </Link>

                <Link
                  to="/my-orders"
                  className="btn text-white"
                  style={{ backgroundColor: "#fc2779" }}
                >
                  View My Orders
                </Link>

                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  disabled={downloading}
                  className="btn btn-success"
                >
                  {downloading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      ></span>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-file-earmark-pdf me-2"></i>
                      Download PDF Receipt
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* NO ORDER DATA */}
              <i
                className="bi bi-bag"
                style={{
                  fontSize: "65px",
                  color: "#fc2779",
                }}
              ></i>

              <h3 className="fw-bold mt-3">
                Order Details Not Available
              </h3>

              <p className="text-secondary">
                Please visit My Orders to view your orders
                and download receipts.
              </p>

              <Link
                to="/my-orders"
                className="btn text-white mt-3"
                style={{ backgroundColor: "#fc2779" }}
              >
                View My Orders
              </Link>
            </>
          )}
        </div>
      </main>

      <Footer showSocial={false} />
    </div>
  );
}

export default OrderSuccess;
