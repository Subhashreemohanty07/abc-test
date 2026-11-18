
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSend = async (e) => {
    e.preventDefault();

    if (!title.trim() || !message.trim()) {
      setError("Please enter a title and message.");
      return;
    }

    const confirmed = window.confirm(
      "Send this notification to ALL customers by bell and email?"
    );

    if (!confirmed) return;

    try {
      setSending(true);
      setError("");
      setResult(null);

      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Admin login required. Please log in again.");
      }

      const response = await fetch(
        `${API_URL}/api/notifications/admin/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            message: message.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to send notification."
        );
      }

      setResult(data);
      setTitle("");
      setMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container-fluid px-0">
      <div className="mb-4">
        <h5 className="fw-bold">Manage Notifications</h5>
        <p className="text-secondary small">
          Create announcements and send them to all customers.
        </p>
      </div>

      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-body p-3 p-md-4">
          <h6 className="fw-bold mb-4">
            <i
              className="bi bi-megaphone-fill me-2"
              style={{ color: "#fc2779" }}
            />
            Create Notification
          </h6>

          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {result && (
            <div className="alert alert-success">
              <strong>
                Notification processing completed!
              </strong>
              <div>
                Total customers: {result.totalCustomers}
              </div>
              <div>
                Bell notifications: {result.notificationsCreated}
              </div>
              <div>
                Emails accepted: {result.emailsSent}
              </div>
            </div>
          )}

          <form onSubmit={handleSend}>
            <div className="mb-3">
              <label className="form-label fw-semibold">
                Notification Title
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. New Year Special Sale!"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">
                Notification Message
              </label>
              <textarea
                className="form-control"
                rows={5}
                placeholder="Write your announcement..."
                value={message}
                maxLength={1000}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <div className="alert alert-light border small">
              <i className="bi bi-info-circle me-2" />
              This announcement will create a bell notification
              for all registered customers and attempt to send
              an email to each customer with an email address.
            </div>

            <button
              type="submit"
              className="btn text-white fw-semibold px-4"
              style={{ backgroundColor: "#fc2779" }}
              disabled={sending}
            >
              {sending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Sending...
                </>
              ) : (
                <>
                  <i className="bi bi-send-fill me-2" />
                  Send to All Customers
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminNotifications;
