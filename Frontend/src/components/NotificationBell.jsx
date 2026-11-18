
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function NotificationBell({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const containerRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/notifications?page=1&limit=5`,
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

      if (localStorage.getItem("token") !== token) return;

      setNotifications(
        Array.isArray(data.notifications)
          ? data.notifications
          : []
      );

      setUnreadCount(data.unreadCount ?? 0);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);

    const refresh = () => {
      setOpen(false);
      fetchNotifications();
    };

    window.addEventListener("authUpdated", refresh);
    window.addEventListener(
      "notificationsUpdated",
      fetchNotifications
    );

    return () => {
      clearInterval(interval);
      window.removeEventListener("authUpdated", refresh);
      window.removeEventListener(
        "notificationsUpdated",
        fetchNotifications
      );
    };
  }, [fetchNotifications]);

  // Close when clicking outside
  useEffect(() => {
    const closeOnOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
    };
  }, []);

  // Close using Escape key
  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // Mark one notification as read
  const handleNotificationClick = async (notification) => {
    const token = localStorage.getItem("token");

    if (!token || loading) return;

    setLoading(true);
    setError("");

    try {
      if (!notification.isRead) {
        const response = await fetch(
          `${API_URL}/api/notifications/${notification._id}/read`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to mark notification as read."
          );
        }

        setNotifications((previous) =>
          previous.map((item) =>
            item._id === notification._id
              ? { ...item, isRead: true }
              : item
          )
        );

        setUnreadCount((previous) =>
          Math.max(0, previous - 1)
        );

        window.dispatchEvent(
          new Event("notificationsUpdated")
        );
      }

      setOpen(false);

      if (
        notification.link?.startsWith("/") &&
        !notification.link.startsWith("//")
      ) {
        onNavigate?.();
        navigate(notification.link);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    const token = localStorage.getItem("token");

    if (!token || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/read-all`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to mark all as read."
        );
      }

      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          isRead: true,
        }))
      );

      setUnreadCount(0);

      window.dispatchEvent(
        new Event("notificationsUpdated")
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const icons = {
    cart: "bi-bag-heart",
    wishlist: "bi-heart",
    order: "bi-box-seam",
    price_drop: "bi-tags",
    promotion: "bi-gift",
  };

  // Shared notification content for desktop and mobile
  const renderNotificationContent = () => (
    <>
      {error && (
        <div className="alert alert-danger m-2 p-2 small">
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center text-muted p-4">
          No notifications yet
        </div>
      ) : (
        notifications.map((notification) => (
          <button
            key={notification._id}
            type="button"
            disabled={loading}
            onClick={() =>
              handleNotificationClick(notification)
            }
            className={`btn rounded-0 w-100 d-flex gap-3 p-3 border-0 border-bottom text-start ${
              notification.isRead
                ? "bg-white"
                : "bg-danger-subtle"
            }`}
          >
            <i
              className={`bi ${
                icons[notification.type] || "bi-bell"
              } text-danger fs-5 flex-shrink-0`}
            />

            <div className="flex-grow-1 overflow-hidden">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <strong className="small text-dark text-break">
                  {notification.title}
                </strong>

                
                {!notification.isRead && (
                <span
                    className="rounded-circle flex-shrink-0"
                    aria-label="Unread"
                    style={{
                    width: "8px",
                    height: "8px",
                    minWidth: "8px",
                    backgroundColor: "#fc2779",
                    display: "inline-block",
                    marginTop: "5px",
                    }}
                />
                )}

              </div>

              <p className="small text-secondary my-2 text-break">
                {notification.message}
              </p>

              <small className="text-muted">
                {notification.createdAt &&
                !Number.isNaN(
                  new Date(notification.createdAt).getTime()
                )
                  ? new Date(
                      notification.createdAt
                    ).toLocaleString()
                  : ""}
              </small>
            </div>
          </button>
        ))
      )}

      <button
        type="button"
        className="btn btn-light rounded-0 w-100 py-3 fw-semibold text-danger"
        onClick={() => {
          setOpen(false);
          onNavigate?.();
          navigate("/notifications");
        }}
      >
        See all notifications{" "}
        <i className="bi bi-arrow-right" />
      </button>
    </>
  );

  return (
    <div
      ref={containerRef}
      className="position-relative d-inline-block"
    >
      {/* NOTIFICATION BELL */}
      <button
        type="button"
        onClick={() => {
          setOpen((previous) => !previous);

          if (!open) {
            fetchNotifications();
          }
        }}
        className="btn border-0 bg-transparent position-relative px-3 py-2"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        title="Notifications"
      >
        <i className="bi bi-bell fs-4 text-dark" />

        {unreadCount > 0 && (
          <span
            className="position-absolute top-0 end-0 badge rounded-pill text-white"
            style={{
              backgroundColor: "#fc2779",
              fontSize: 11,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* DESKTOP DROPDOWN */}
      {open && (
        <div
          className="d-none d-lg-block position-absolute top-100 end-0 bg-white border rounded-3 shadow overflow-auto text-start"
          style={{
            width: "370px",
            maxHeight: "460px",
            zIndex: 9999,
          }}
        >
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
            <h6 className="m-0 fw-bold">
              Notifications
            </h6>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={loading}
                onClick={handleMarkAllRead}
                className="btn btn-link btn-sm text-decoration-none p-0"
                style={{ color: "#fc2779" }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {renderNotificationContent()}
        </div>
      )}

      {/* MOBILE OFFCANVAS */}
      {open && (
        <div className="d-lg-none">
          {/* BACKDROP */}
          <div
            className="offcanvas-backdrop fade show"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* PANEL */}
          <div
            className="offcanvas offcanvas-end show bg-white"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            tabIndex={-1}
            style={{
              visibility: "visible",
              width: "min(100vw, 380px)",
              zIndex: 1050,
            }}
          >
            <div className="offcanvas-header border-bottom">
              <h5 className="offcanvas-title fw-bold">
                Notifications
              </h5>

              <button
                type="button"
                className="btn-close"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              />
            </div>

            <div className="offcanvas-body p-0 overflow-auto">
              {unreadCount > 0 && (
                <div className="text-end p-3 border-bottom">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleMarkAllRead}
                    className="btn btn-link btn-sm text-decoration-none p-0"
                    style={{ color: "#fc2779" }}
                  >
                    Mark all as read
                  </button>
                </div>
              )}

              {renderNotificationContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
