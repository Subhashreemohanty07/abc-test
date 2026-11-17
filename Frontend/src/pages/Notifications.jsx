
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 5;

const icons = {
  cart: "bi-bag-heart",
  wishlist: "bi-heart",
  order: "bi-box-seam",
  price_drop: "bi-tags",
  promotion: "bi-gift",
};

function Notifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/notifications?page=${page}&limit=${PAGE_SIZE}&filter=${filter}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load notifications.");
      }

      const data = await response.json();

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
      setTotalPages(data.totalPages || 1);

      if (data.page && data.page !== page) {
        setPage(data.page);
      }

      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filter, navigate]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // Mark one notification as read.
  const markOne = async (notification) => {
    if (busy) return;

    setBusy(true);

    try {
      if (!notification.isRead) {
        const response = await fetch(
          `${API_URL}/api/notifications/${notification._id}/read`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Unable to mark notification as read.");
        }

        window.dispatchEvent(
          new Event("notificationsUpdated")
        );
      }

      if (
        notification.link?.startsWith("/") &&
        !notification.link.startsWith("//")
      ) {
        navigate(notification.link);
      } else {
        await fetchPage();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Mark all notifications as read.
  const markAll = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/read-all`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to mark all as read.");
      }

      window.dispatchEvent(
        new Event("notificationsUpdated")
      );

      await fetchPage();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="container py-4"
      style={{
        maxWidth: 850,
        minHeight: "65vh",
      }}
    >
      {/* PAGE HEADER */}
      <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
        <div>
          <h3 className="fw-bold mb-1">
            All Notifications
          </h3>

          <small className="text-muted">
            {unreadCount} unread
          </small>
        </div>

        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={busy || unreadCount === 0}
          onClick={markAll}
        >
          Mark all as read
        </button>
      </div>

      {/* FILTER BUTTONS */}
      <div className="d-flex gap-2 mb-3">
        {["all", "unread", "read"].map((option) => (
          <button
            key={option}
            className={`btn btn-sm ${
              filter === option
                ? "btn-dark"
                : "btn-outline-secondary"
            }`}
            onClick={() => {
              setFilter(option);
              setPage(1);
            }}
          >
            {option.charAt(0).toUpperCase() +
              option.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {/* NOTIFICATIONS */}
      {loading ? (
        <p className="text-muted">
          Loading notifications...
        </p>
      ) : notifications.length === 0 ? (
        <div className="text-center text-muted p-5 border rounded">
          No notifications found.
        </div>
      ) : (
        <div className="border rounded overflow-hidden">
          {notifications.map((notification) => (
            <button
              key={notification._id}
              type="button"
              disabled={busy}
              onClick={() => markOne(notification)}
              className="w-100 d-flex align-items-start gap-3 p-3 border-0 border-bottom text-start"
              style={{
                background: notification.isRead
                  ? "#fff"
                  : "#fff0f6",
                cursor: "pointer",
              }}
            >
              <i
                className={`bi ${
                  icons[notification.type] || "bi-bell"
                }`}
                style={{
                  color: "#fc2779",
                  fontSize: 22,
                }}
              />

              <div className="flex-grow-1">
                <div className="d-flex justify-content-between gap-2">
                  <strong>
                    {notification.title}
                  </strong>

                  {!notification.isRead && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#fc2779",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>

                <p className="text-muted small mb-1">
                  {notification.message}
                </p>

                <small className="text-muted">
                  {notification.createdAt
                    ? new Date(
                        notification.createdAt
                      ).toLocaleString()
                    : ""}
                </small>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* PAGINATION */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <small className="text-muted">
          Page {page} of {totalPages}
        </small>

        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || page <= 1}
            onClick={() =>
              setPage((previous) => previous - 1)
            }
          >
            Previous
          </button>

          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || page >= totalPages}
            onClick={() =>
              setPage((previous) => previous + 1)
            }
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}

export default Notifications;
